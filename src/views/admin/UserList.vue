<script setup lang="ts">
import { fetchRoleOptions, type RoleDto } from '@/api/admin/role';
import type { UserView } from '@/api/admin/users';
import { createUser, fetchUsers, updateUser, type UserCreatePayload, type UserQuery, type UserUpdatePayload } from '@/api/admin/users';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

interface UserForm {
    username: string;
    email: string;
    password: string;
    avatarUrl: string;
    bio: string;
    status: number;
    roleIds: number[];
}

const users = ref<UserView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;

const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const roles = ref<RoleDto[]>([]);
const editingId = ref<number | null>(null);
const toast = useToast();

// 请求控制
let abortController: AbortController | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

const form = ref<UserForm>({
    username: '',
    email: '',
    password: '',
    avatarUrl: '',
    bio: '',
    status: 1,
    roleIds: []
});

const statusOptions = [
    { label: '启用', value: 1 },
    { label: '禁用', value: 0 }
];

function createEmptyFilters(): FiltersState {
    const textFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }]
    });

    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        username: textFilter(),
        email: textFilter(),
        status: { value: null, matchMode: FilterMatchMode.EQUALS },
        roleIds: { value: [], matchMode: FilterMatchMode.IN }
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

function resolveNumberFilter(field: string): number | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === null || raw === undefined || raw === '') {
        return undefined;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? undefined : parsed;
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

function buildQueryFromFilters(): UserQuery {
    const query: UserQuery = {
        page: page.value,
        size: size.value
    };
    const globalKeyword = resolveStringFilter('global');
    if (globalKeyword) {
        query.keyword = globalKeyword;
    }
    const usernameFilter = resolveStringFilter('username');
    if (usernameFilter) {
        query.username = usernameFilter;
    }
    const emailFilter = resolveStringFilter('email');
    if (emailFilter) {
        query.email = emailFilter;
    }
    const statusFilterValue = resolveNumberFilter('status');
    if (statusFilterValue !== undefined) {
        query.status = statusFilterValue;
    }
    const roleFilterValue = resolveNumberArrayFilter('roleIds');
    if (roleFilterValue) {
        query.roleIds = roleFilterValue;
    }
    return query;
}

const roleOptions = computed(() => roles.value.map((role) => ({ label: role.name, value: role.id })));

let skipFilterWatch = false;

// 监听过滤条件变化，自动触发服务端搜索（带防抖）
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
    await loadRoles();
    await loadUsers();
});

onUnmounted(() => {
    // 清理定时器和取消未完成的请求
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    if (abortController) {
        abortController.abort();
    }
});

// 防抖搜索函数
function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadUsers();
    }, 300);
}

async function loadUsers() {
    // 取消之前的请求
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const query = buildQueryFromFilters();
        const data = await fetchUsers(query, controller.signal);
        users.value = data.items ?? [];
        total.value = data.total ?? 0;
        // 只在服务端返回的 page 与当前 page 不同时才更新（避免不必要的响应式触发）
        if (data.page !== undefined && Number(data.page) !== page.value) {
            page.value = Number(data.page);
        }
        if (data.size !== undefined && Number(data.size) !== size.value) {
            size.value = Number(data.size);
        }
    } catch (error: any) {
        // 忽略取消的请求错误
        if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
            return;
        }
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载用户列表失败',
            life: 4000
        });
    } finally {
        if (abortController === controller) {
            loading.value = false;
            abortController = null;
        }
    }
}

async function loadRoles() {
    // 如果已经加载过角色，直接返回
    if (roles.value.length > 0) {
        return;
    }

    try {
        roles.value = await fetchRoleOptions();
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '警告',
            detail: (error as Error)?.message ?? '获取角色列表失败',
            life: 4000
        });
        roles.value = [];
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
        await loadUsers();
    } finally {
        skipFilterWatch = false;
    }
}

function openCreate() {
    editingId.value = null;
    form.value = {
        username: '',
        email: '',
        password: '',
        avatarUrl: '',
        bio: '',
        status: 1,
        roleIds: []
    };
    dialogVisible.value = true;
}

function openEdit(user: UserView) {
    editingId.value = user.id;
    form.value = {
        username: user.username,
        email: user.email,
        password: '',
        avatarUrl: user.avatarUrl ?? '',
        bio: user.bio ?? '',
        status: user.status ?? 1,
        roleIds: user.roles?.map((role) => role.id) ?? []
    };
    dialogVisible.value = true;
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    if (!form.value.username.trim()) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入用户名', life: 4000 });
        return;
    }
    if (!form.value.email.trim()) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入邮箱', life: 4000 });
        return;
    }
    const isCreate = editingId.value === null;
    if (isCreate && !form.value.password.trim()) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入密码', life: 4000 });
        return;
    }

    saving.value = true;
    try {
        if (isCreate) {
            const payload: UserCreatePayload = {
                username: form.value.username.trim(),
                email: form.value.email.trim(),
                password: form.value.password.trim(),
                avatarUrl: form.value.avatarUrl?.trim() || undefined,
                bio: form.value.bio?.trim() || undefined,
                status: form.value.status,
                roleIds: form.value.roleIds
            };
            await createUser(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '用户已创建', life: 3000 });
        } else {
            const payload: UserUpdatePayload = {
                username: form.value.username.trim(),
                email: form.value.email.trim(),
                avatarUrl: form.value.avatarUrl?.trim() || undefined,
                bio: form.value.bio?.trim() || undefined,
                status: form.value.status,
                roleIds: form.value.roleIds
            };
            if (form.value.password.trim()) {
                payload.password = form.value.password.trim();
            }
            await updateUser(editingId.value!, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '用户信息已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadUsers();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '提交失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadUsers();
}

function statusSeverity(status: number | undefined | null) {
    return status === 1 ? 'success' : 'danger';
}

function statusLabel(status: number | undefined | null) {
    return status === 1 ? '启用' : '禁用';
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
                    :value="users"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['username', 'email']"
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
                                        placeholder="搜索用户名或邮箱"
                                    />
                                </IconField>
                            </div>
                            <Button label="新建用户" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>
                    <Column field="username" header="用户名" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入用户名" class="w-full" />
                        </template>
                    </Column>
                    <Column field="email" header="邮箱" style="min-width: 14rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入邮箱" class="w-full" />
                        </template>
                    </Column>
                    <Column header="角色" filterField="roleIds" :showFilterMatchModes="false" :filterMenuStyle="{ width: '18rem' }" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="flex flex-wrap gap-2">
                                <Tag v-for="role in data.roles" :key="role.id" :value="role.name" />
                                <span v-if="!data.roles?.length">-</span>
                            </div>
                        </template>
                        <template #filter="{ filterModel }">
                            <MultiSelect v-model="filterModel.value" :options="roleOptions" optionLabel="label" optionValue="value" placeholder="选择角色" display="chip" class="w-full" />
                        </template>
                    </Column>
                    <Column field="status" header="状态" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown v-model="filterModel.value" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="全部状态" :showClear="true" class="w-full" />
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                    </Column>
                    <Column field="lastLoginAt" header="最近登录" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.lastLoginAt) }}
                        </template>
                    </Column>
                    <Column header="操作" style="min-width: 8rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="编辑"
                                icon="pi pi-pencil"
                                size="small"
                                :model="[
                                    {
                                        label: '新建用户',
                                        icon: 'pi pi-plus',
                                        command: () => openCreate()
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

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建用户' : '编辑用户'" :style="{ width: '32rem' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" @hide="closeDialog">
        <form class="grid form-grid" @submit.prevent="submitForm">
            <div class="col-12 md:col-6">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block" for="username">用户名</label>
                    <InputText id="username" v-model="form.username" placeholder="请输入用户名" autofocus class="w-full" />
                </div>
            </div>
            <div class="col-12 md:col-6">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block" for="email">邮箱</label>
                    <InputText id="email" v-model="form.email" placeholder="请输入邮箱" class="w-full" />
                </div>
            </div>
            <div class="col-12 md:col-6">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block" for="password">密码</label>
                    <Password id="password" v-model="form.password" toggleMask :feedback="false" :placeholder="editingId === null ? '请输入初始密码' : '留空则不修改密码'" class="w-full" inputClass="w-full" />
                </div>
            </div>
            <div class="col-12 md:col-6">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block" for="avatar">头像链接</label>
                    <InputText id="avatar" v-model="form.avatarUrl" placeholder="https://example.com/avatar.png" class="w-full" />
                </div>
            </div>
            <div class="col-12">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block" for="bio">个人简介</label>
                    <Textarea id="bio" v-model="form.bio" autoResize :rows="3" placeholder="填写个人简介" class="w-full" />
                </div>
            </div>
            <div class="col-12 md:col-6">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block">状态</label>
                    <Dropdown v-model="form.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>
            </div>
            <div class="col-12 md:col-6">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block">角色</label>
                    <MultiSelect v-model="form.roleIds" :options="roleOptions" optionLabel="label" optionValue="value" display="chip" placeholder="选择角色" class="w-full" />
                </div>
            </div>
            <div class="col-12 flex justify-end gap-2 mt-2">
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
}

.form-grid {
    gap: 1.5rem;
}
</style>
