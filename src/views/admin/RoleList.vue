<script setup lang="ts">
import {
    createRole,
    deleteRole,
    fetchRoleList,
    fetchRolePermissionOptions,
    updateRole,
    type PermissionDto,
    type RoleCreatePayload,
    type RoleQuery,
    type RoleUpdatePayload,
    type RoleView
} from '@/api/admin/role';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

interface RoleForm {
    code: string;
    name: string;
    remark: string;
    permissionIds: number[];
}

const roles = ref<RoleView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);
const permissionLoading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const toast = useToast();

const form = ref<RoleForm>({
    code: '',
    name: '',
    remark: '',
    permissionIds: []
});

const allPermissions = ref<PermissionDto[]>([]);
const permissionOptions = computed(() =>
    allPermissions.value.map((permission) => ({
        ...permission,
        label: permission.name ? `${permission.name}（${permission.code}）` : permission.code
    }))
);

let abortController: AbortController | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
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
        remark: textFilter(),
        permissionIds: { value: [], matchMode: FilterMatchMode.IN }
    };
}

function isOperatorFilterMeta(
    meta: FilterValue | undefined
): meta is DataTableOperatorFilterMetaData {
    return !!meta && typeof meta === 'object' && 'constraints' in meta;
}

function resolveRawFilterValue(field: string): unknown {
    const meta = filters.value[field];
    if (!meta) {
        return undefined;
    }
    if (isOperatorFilterMeta(meta)) {
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

function resolveNumberArrayFilter(field: string): number[] | undefined {
    const raw = resolveRawFilterValue(field);
    if (!Array.isArray(raw)) {
        if (raw === null || raw === undefined || raw === '') {
            return undefined;
        }
        const parsed = Number(raw);
        return Number.isNaN(parsed) ? undefined : [parsed];
    }
    const values = raw
        .map((item) => {
            if (item === null || item === undefined || item === '') {
                return null;
            }
            const parsed = Number(item);
            return Number.isNaN(parsed) ? null : parsed;
        })
        .filter((item): item is number => item !== null);
    return values.length > 0 ? values : undefined;
}

function buildQueryFromFilters(): RoleQuery {
    const query: RoleQuery = {
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
    const remarkFilter = resolveStringFilter('remark');
    if (remarkFilter) {
        query.remark = remarkFilter;
    }
    const permissionFilter = resolveNumberArrayFilter('permissionIds');
    if (permissionFilter && permissionFilter.length > 0) {
        query.permissionIds = permissionFilter;
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

onMounted(async () => {
    await loadPermissionOptions();
    await loadRoles();
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
        loadRoles();
    }, 300);
}

async function loadRoles() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const query = buildQueryFromFilters();
        const data = await fetchRoleList(query, controller.signal);
        roles.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (data.page !== undefined && Number(data.page) !== page.value) {
            page.value = Number(data.page);
        }
        if (data.size !== undefined && Number(data.size) !== size.value) {
            size.value = Number(data.size);
        }
    } catch (error) {
        if ((error as any)?.name === 'AbortError' || (error as any)?.name === 'CanceledError') {
            return;
        }
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载角色列表失败',
            life: 4000
        });
    } finally {
        if (abortController === controller) {
            loading.value = false;
            abortController = null;
        }
    }
}

async function loadPermissionOptions() {
    permissionLoading.value = true;
    try {
        allPermissions.value = await fetchRolePermissionOptions();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载权限列表失败',
            life: 4000
        });
    } finally {
        permissionLoading.value = false;
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
        await loadRoles();
    } finally {
        skipFilterWatch = false;
    }
}

function openCreate() {
    editingId.value = null;
    form.value = {
        code: '',
        name: '',
        remark: '',
        permissionIds: []
    };
    dialogVisible.value = true;
}

function openEdit(role: RoleView) {
    editingId.value = role.id;
    form.value = {
        code: role.code,
        name: role.name,
        remark: role.remark ?? '',
        permissionIds: role.permissions?.map((permission) => permission.id) ?? []
    };
    dialogVisible.value = true;
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    const code = form.value.code.trim();
    if (!code) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入角色编码', life: 4000 });
        return;
    }
    const name = form.value.name.trim();
    if (!name) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入角色名称', life: 4000 });
        return;
    }
    const remarkRaw = form.value.remark?.trim();
    const remark = remarkRaw === undefined || remarkRaw === '' ? null : remarkRaw;
    const permissionIds = form.value.permissionIds && form.value.permissionIds.length > 0 ? Array.from(new Set(form.value.permissionIds)) : [];

    saving.value = true;
    try {
        if (editingId.value === null) {
            const payload: RoleCreatePayload = { code, name, remark, permissionIds };
            await createRole(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '角色已创建', life: 3000 });
        } else {
            const payload: RoleUpdatePayload = { code, name, remark, permissionIds };
            await updateRole(editingId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '角色信息已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadRoles();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存角色失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function removeRole(role: RoleView) {
    const confirmed = window.confirm(`确定要删除角色「${role.name}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteRole(role.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '角色已删除', life: 3000 });
        await loadRoles();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除角色失败',
            life: 4000
        });
    } finally {
        /* noop */
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadRoles();
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
                    :value="roles"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['code', 'name', 'remark']"
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
                                        placeholder="搜索角色编码或名称"
                                    />
                                </IconField>
                            </div>
                            <Button label="新建角色" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>
                    <Column field="code" header="角色编码" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入角色编码" class="w-full" />
                        </template>
                    </Column>
                    <Column field="name" header="角色名称" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入角色名称" class="w-full" />
                        </template>
                    </Column>
                    <Column field="remark" header="备注" style="min-width: 14rem" :showFilterMatchModes="false">
                        <template #body="{ data }">
                            {{ data.remark || '-' }}
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入备注关键词" class="w-full" />
                        </template>
                    </Column>
                    <Column header="拥有权限" filterField="permissionIds" style="min-width: 18rem" :showFilterMatchModes="false" :filterMenuStyle="{ width: '18rem' }">
                        <template #body="{ data }">
                            <div v-if="data.permissions?.length" class="flex flex-wrap gap-2">
                                <Tag v-for="permission in data.permissions" :key="permission.id" :value="permission.code" :title="permission.name" />
                            </div>
                            <span v-else>-</span>
                        </template>
                        <template #filter="{ filterModel }">
                            <MultiSelect
                                v-model="filterModel.value"
                                :options="permissionOptions"
                                optionLabel="label"
                                optionValue="id"
                                placeholder="选择权限"
                                display="chip"
                                filter
                                :loading="permissionLoading"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                    </Column>
                    <Column field="updatedAt" header="更新时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.updatedAt) }}
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
                                        label: '删除角色',
                                        icon: 'pi pi-trash',
                                        command: () => removeRole(data)
                                    }
                                ]"
                                @click="openEdit(data)"
                            />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建角色' : '编辑角色'" :style="{ width: '28rem' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" @hide="closeDialog">
        <form class="form-grid" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="code">角色编码</label>
                <InputText id="code" v-model="form.code" placeholder="如 admin" autofocus class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="name">角色名称</label>
                <InputText id="name" v-model="form.name" placeholder="如 管理员" class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="remark">备注</label>
                <Textarea id="remark" v-model="form.remark" autoResize :rows="3" placeholder="填写角色说明" class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="permissions">关联权限</label>
                <MultiSelect
                    id="permissions"
                    v-model="form.permissionIds"
                    :options="permissionOptions"
                    optionLabel="label"
                    optionValue="id"
                    display="chip"
                    placeholder="选择可访问的权限"
                    filter
                    :filterFields="['code', 'name']"
                    :loading="permissionLoading"
                    :disabled="permissionLoading && !permissionOptions.length"
                    class="w-full"
                />
                <small class="text-xs text-color-secondary">可多选，支持按编码或名称过滤。</small>
            </div>
            <div class="flex justify-end gap-2 mt-3">
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

.form-grid {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}
</style>
