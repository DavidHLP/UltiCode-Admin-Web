<script setup lang="ts">
import {
    fetchAuthTokens,
    revokeAuthToken,
    type AuthTokenPage,
    type AuthTokenQuery,
    type AuthTokenView
} from '@/api/admin/auth-tokens';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref, watch } from 'vue';

const tokens = ref<AuthTokenView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);

const toast = useToast();

const kindOptions = [
    { label: '访问令牌', value: 'access' },
    { label: '刷新令牌', value: 'refresh' },
    { label: '敏感操作令牌', value: 'api' }
];

const statusOptions = [
    { label: '有效', value: false },
    { label: '已撤销', value: true }
];

let debounceTimer: NodeJS.Timeout | null = null;
let abortController: AbortController | null = null;
let skipFilterWatch = false;

function createEmptyFilters(): FiltersState {
    const equalsFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }]
    });

    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        userId: equalsFilter(),
        kind: { value: null, matchMode: FilterMatchMode.EQUALS },
        revoked: { value: null, matchMode: FilterMatchMode.EQUALS },
        createdAt: { value: null, matchMode: FilterMatchMode.BETWEEN },
        expiresAt: { value: null, matchMode: FilterMatchMode.BETWEEN }
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

function resolveBooleanFilter(field: string): boolean | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === null || raw === undefined || raw === '') {
        return undefined;
    }
    if (typeof raw === 'boolean') {
        return raw;
    }
    if (typeof raw === 'string') {
        const normalized = raw.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }
    return undefined;
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

function buildQueryFromFilters(): AuthTokenQuery {
    const query: AuthTokenQuery = {
        page: page.value,
        size: size.value
    };
    const globalKeyword = resolveStringFilter('global');
    if (globalKeyword) {
        query.keyword = globalKeyword;
    }
    const userId = resolveNumberFilter('userId');
    if (userId !== undefined) {
        query.userId = userId;
    }
    const kind = resolveStringFilter('kind');
    if (kind) {
        query.kind = kind;
    }
    const revoked = resolveBooleanFilter('revoked');
    if (revoked !== undefined) {
        query.revoked = revoked;
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
    const expiresRange = resolveDateRangeFilter('expiresAt');
    if (expiresRange) {
        const [start, end] = expiresRange;
        if (start) {
            query.expiresAtStart = start;
        }
        if (end) {
            query.expiresAtEnd = end;
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
    loadTokens();
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
        loadTokens();
    }, 300);
}

async function loadTokens() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const query = buildQueryFromFilters();
        const data: AuthTokenPage = await fetchAuthTokens(query, controller.signal);
        tokens.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (data.page !== undefined && Number(data.page) !== page.value) {
            page.value = Number(data.page);
        }
        if (data.size !== undefined && Number(data.size) !== size.value) {
            size.value = Number(data.size);
        }
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
            return;
        }
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载令牌失败',
            life: 4000
        });
    } finally {
        if (abortController === controller) {
            loading.value = false;
            abortController = null;
        }
    }
}

async function revoke(token: AuthTokenView) {
    if (token.revoked) {
        return;
    }
    const confirmed = window.confirm(`确定要撤销令牌 #${token.id} 吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await revokeAuthToken(token.id);
        toast.add({ severity: 'success', summary: '撤销成功', detail: '令牌已撤销', life: 3000 });
        await loadTokens();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '撤销失败',
            detail: (error as Error)?.message ?? '撤销令牌失败',
            life: 4000
        });
    } finally {
        /* noop */
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
        await loadTokens();
    } finally {
        skipFilterWatch = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadTokens();
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
        minute: '2-digit'
    }).format(date);
}

function tokenSeverity(item: AuthTokenView) {
    if (item.revoked) {
        return 'danger';
    }
    if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
        return 'warn';
    }
    return 'success';
}

function tokenStatusLabel(item: AuthTokenView) {
    if (item.revoked) {
        return '已撤销';
    }
    if (item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) {
        return '已过期';
    }
    return '有效';
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="tokens"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['id', 'userId', 'kind']"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
                    @page="onPageChange"
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
                                        placeholder="搜索用户ID或类型"
                                    />
                                </IconField>
                            </div>
                        </div>
                    </template>
                    <Column field="id" header="ID" style="min-width: 6rem" />
                    <Column field="userId" header="用户ID" style="min-width: 8rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" placeholder="输入用户ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="kind" header="类型" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #body="{ data }">
                            <Tag :value="data.kind" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="kindOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部类型"
                                :showClear="true"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column header="状态" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="tokenStatusLabel(data)" :severity="tokenSeverity(data)" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="statusOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部状态"
                                :showClear="true"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" style="min-width: 12rem">
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
                    <Column field="expiresAt" header="过期时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.expiresAt) }}
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
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="撤销"
                                icon="pi pi-ban"
                                size="small"
                                :model="[
                                    {
                                        label: '无更多操作'
                                    }
                                ]"
                                :disabled="data.revoked"
                                @click="revoke(data)"
                            />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-surface-500 dark:text-surface-300">暂无令牌数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>
</template>
