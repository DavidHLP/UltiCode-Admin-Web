<script setup lang="ts">
import {
    createPermission,
    deletePermission,
    fetchPermissions,
    updatePermission,
    type PermissionCreatePayload,
    type PermissionQuery,
    type PermissionUpdatePayload,
    type PermissionView
} from '@/api/admin/permissions';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref, watch } from 'vue';

const permissions = ref<PermissionView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<PermissionCreatePayload>({ code: '', name: '' });

const toast = useToast();

let debounceTimer: NodeJS.Timeout | null = null;
let abortController: AbortController | null = null;
let skipFilterWatch = false;

function createEmptyFilters(): FiltersState {
    const textFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }]
    });

    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        code: textFilter(),
        name: textFilter(),
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
    if (typeof raw !== 'string') {
        return undefined;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
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

function buildQueryFromFilters(): PermissionQuery {
    const query: PermissionQuery = {
        page: page.value,
        size: size.value
    };
    const globalKeyword = resolveStringFilter('global');
    if (globalKeyword) {
        query.keyword = globalKeyword;
    }
    const codeFilter = resolveStringFilter('code');
    if (codeFilter) {
        query.code = codeFilter;
    }
    const nameFilter = resolveStringFilter('name');
    if (nameFilter) {
        query.name = nameFilter;
    }
    const createdAtRange = resolveDateRangeFilter('createdAt');
    if (createdAtRange) {
        const [start, end] = createdAtRange;
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
    loadPermissions();
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
        loadPermissions();
    }, 300);
}

async function loadPermissions() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const query = buildQueryFromFilters();
        const data = await fetchPermissions(query, controller.signal);
        permissions.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载权限列表失败',
            life: 4000
        });
    } finally {
        if (abortController === controller) {
            loading.value = false;
            abortController = null;
        }
    }
}

function openCreate() {
    editingId.value = null;
    form.value = { code: '', name: '' };
    dialogVisible.value = true;
}

function openEdit(item: PermissionView) {
    editingId.value = item.id;
    form.value = { code: item.code, name: item.name };
    dialogVisible.value = true;
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    const code = form.value.code.trim();
    if (!code) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入权限编码', life: 4000 });
        return;
    }
    const name = form.value.name.trim();
    if (!name) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入权限名称', life: 4000 });
        return;
    }
    saving.value = true;
    try {
        if (editingId.value === null) {
            const payload: PermissionCreatePayload = { code, name };
            await createPermission(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '权限已创建', life: 3000 });
        } else {
            const payload: PermissionUpdatePayload = { code, name };
            await updatePermission(editingId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '权限已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadPermissions();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存权限失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function removePermission(item: PermissionView) {
    const confirmed = window.confirm(`确定要删除权限「${item.code}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deletePermission(item.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '权限已删除', life: 3000 });
        await loadPermissions();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除权限失败',
            life: 4000
        });
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
        await loadPermissions();
    } finally {
        skipFilterWatch = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadPermissions();
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
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="permissions"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['code', 'name']"
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
                                        placeholder="搜索权限编码或名称"
                                    />
                                </IconField>
                            </div>
                            <Button label="新建权限" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>
                    <Column field="code" header="权限编码" style="min-width: 12rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入权限编码" class="w-full" />
                        </template>
                    </Column>
                    <Column field="name" header="权限名称" style="min-width: 12rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入权限名称" class="w-full" />
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
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="编辑"
                                icon="pi pi-pencil"
                                size="small"
                                :model="[
                                    {
                                        label: '删除权限',
                                        icon: 'pi pi-trash',
                                        command: () => removePermission(data)
                                    }
                                ]"
                                @click="openEdit(data)"
                            />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-surface-500 dark:text-surface-300">暂无权限数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建权限' : '编辑权限'" :style="{ width: '24rem' }" @hide="closeDialog">
        <form class="flex flex-col gap-4" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="code">权限编码</label>
                <InputText id="code" v-model="form.code" placeholder="如 user.manage" autofocus class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="name">权限名称</label>
                <InputText id="name" v-model="form.name" placeholder="如 管理用户" class="w-full" />
            </div>
            <div class="flex justify-end gap-2">
                <Button type="button" label="取消" severity="secondary" @click="closeDialog" />
                <Button type="submit" label="保存" icon="pi pi-check" :loading="saving" />
            </div>
        </form>
    </Dialog>
</template>

<style scoped>
.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
</style>
