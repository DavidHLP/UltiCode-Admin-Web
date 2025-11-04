<script setup lang="ts">
import { fetchAuditLogs, type AuditLogQuery, type AuditLogView } from '@/api/admin/audit-logs';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref, watch } from 'vue';

const logs = ref<AuditLogView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);

const toast = useToast();

const actionOptions = [
    { label: '登录成功', value: 'LOGIN_SUCCESS' },
    { label: '登录失败', value: 'LOGIN_FAILURE' },
    { label: '角色权限调整', value: 'ROLE_PERMISSION_UPDATED' },
    { label: '用户角色调整', value: 'USER_ROLE_CHANGED' },
    { label: '权限变更', value: 'SECURITY_POLICY_CHANGED' },
    { label: '令牌撤销', value: 'TOKEN_REVOKED' },
    { label: 'SSO 会话创建', value: 'SSO_SESSION_CREATED' },
    { label: 'SSO 会话撤销', value: 'SSO_SESSION_REVOKED' }
];

let debounceTimer: NodeJS.Timeout | null = null;
let abortController: AbortController | null = null;
let skipFilterWatch = false;

function createEmptyFilters(): FiltersState {
    const containsFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }]
    });
    const equalsFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }]
    });

    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        action: { value: null, matchMode: FilterMatchMode.EQUALS },
        actorId: equalsFilter(),
        actorUsername: containsFilter(),
        objectType: containsFilter(),
        objectId: containsFilter(),
        createdAt: { value: null, matchMode: FilterMatchMode.BETWEEN }
    };
}

function isOperatorFilter(meta: FilterValue | undefined): meta is DataTableOperatorFilterMetaData {
    return !!meta && typeof meta === 'object' && 'constraints' in meta;
}

function resolveRawFilterValue(field: string): unknown {
    const meta = filters.value[field];
    if (!meta) {
        return undefined;
    }
    if (isOperatorFilter(meta)) {
        const [constraint] = meta.constraints ?? [];
        return constraint?.value;
    }
    return meta.value;
}

function resolveStringFilter(field: string): string | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === null || raw === undefined) {
        return undefined;
    }
    const value = typeof raw === 'string' ? raw : String(raw);
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function resolveNumberFilter(field: string): number | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === null || raw === undefined || raw === '') {
        return undefined;
    }
    const parsed =
            typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveDateRangeFilter(field: string): [string | undefined, string | undefined] | undefined {
    const raw = resolveRawFilterValue(field);
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const [startRaw, endRaw] = raw;
    const start = normalizeDateValue(startRaw);
    const end = normalizeDateValue(endRaw);
    if (!start && !end) {
        return undefined;
    }
    return [start, end];
}

function normalizeDateValue(value: unknown): string | undefined {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return undefined;
    }
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildQueryFromFilters(): AuditLogQuery {
    const query: AuditLogQuery = {
        page: page.value,
        size: size.value
    };
    const keyword = resolveStringFilter('global');
    if (keyword) {
        query.keyword = keyword;
    }
    const action = resolveStringFilter('action');
    if (action) {
        query.action = action;
    }
    const actorId = resolveNumberFilter('actorId');
    if (actorId !== undefined) {
        query.actorId = actorId;
    }
    const actorUsername = resolveStringFilter('actorUsername');
    if (actorUsername) {
        query.actorUsername = actorUsername;
    }
    const objectType = resolveStringFilter('objectType');
    if (objectType) {
        query.objectType = objectType;
    }
    const objectId = resolveStringFilter('objectId');
    if (objectId) {
        query.objectId = objectId;
    }
    const createdRange = resolveDateRangeFilter('createdAt');
    if (createdRange) {
        const [start, end] = createdRange;
        if (start) {
            query.createdAtStart = start;
        }
        if (end) {
            query.createdAtEnd = end;
        }
    }
    return query;
}

watch(
    filters,
    () => {
        if (skipFilterWatch) {
            return;
        }
        debouncedSearch();
    },
    { deep: true }
);

onMounted(() => {
    loadLogs();
});

onUnmounted(() => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    if (abortController) {
        abortController.abort();
    }
});

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadLogs();
    }, 300);
}

async function loadLogs() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const query = buildQueryFromFilters();
        const response = await fetchAuditLogs(query, controller.signal);
        logs.value = response.items ?? [];
        total.value = response.total ?? 0;
        if (response.page !== undefined && Number(response.page) !== page.value) {
            page.value = Number(response.page);
        }
        if (response.size !== undefined && Number(response.size) !== size.value) {
            size.value = Number(response.size);
        }
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
            return;
        }
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载审计日志失败',
            life: 4000
        });
    } finally {
        if (abortController === controller) {
            loading.value = false;
            abortController = null;
        }
    }
}

async function clearFilters() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    skipFilterWatch = true;
    filters.value = createEmptyFilters();
    page.value = 1;
    try {
        await loadLogs();
    } finally {
        skipFilterWatch = false;
    }
}

function onPage(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadLogs();
}

function formatDate(value?: string | null) {
    if (!value) {
        return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="logs"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :totalRecords="total"
                    :rowsPerPageOptions="[20, 50, 100]"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
                    :globalFilterFields="['actorUsername', 'objectType', 'objectId', 'description']"
                    @page="onPage"
                    responsiveLayout="scroll"
                    showGridlines
                >
                    <template #header>
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <Button type="button" label="重置" icon="pi pi-filter-slash" outlined @click="clearFilters" />
                                <IconField>
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText
                                        v-model="(filters['global'] as DataTableFilterMetaData).value"
                                        placeholder="搜索操作者、对象或描述"
                                    />
                                </IconField>
                            </div>
                        </div>
                    </template>
                    <Column field="createdAt" header="时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                        <template #filter="{ filterModel }">
                            <DatePicker
                                v-model="filterModel.value"
                                selectionMode="range"
                                dateFormat="yy-mm-dd"
                                placeholder="选择日期范围"
                                showIcon
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="action" header="动作" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #body="{ data }">
                            <Tag :value="data.action" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="actionOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="选择动作"
                                :showClear="true"
                            />
                        </template>
                    </Column>
                    <Column field="actorId" header="操作者ID" style="min-width: 8rem" :showFilterMatchModes="false">
                        <template #body="{ data }">
                            {{ data.actorId ?? '-' }}
                        </template>
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" class="w-full" />
                        </template>
                    </Column>
                    <Column field="actorUsername" header="操作者" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.actorUsername || '-' }}
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="输入操作者" class="w-full" />
                        </template>
                    </Column>
                    <Column field="objectType" header="对象类型" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.objectType }}
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="输入对象类型" class="w-full" />
                        </template>
                    </Column>
                    <Column field="objectId" header="对象ID" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.objectId ?? '-' }}
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="输入对象ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="description" header="描述" style="min-width: 16rem">
                        <template #body="{ data }">
                            {{ data.description || '-' }}
                        </template>
                    </Column>
                    <Column field="ipAddress" header="来源 IP" style="min-width: 10rem" />
                    <template #empty>
                        <div class="py-6 text-center text-surface-500 dark:text-surface-300">暂无审计日志</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>
</template>

<style scoped>
.card {
    padding-bottom: 1.5rem;
}
</style>
