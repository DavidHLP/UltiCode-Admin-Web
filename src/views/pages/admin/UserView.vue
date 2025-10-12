<script setup lang="ts">
import { getRoleList, type Role } from '@/api/admin/role';
import { createUser, deleteUser, fetchUsers, updateUser, type QueryUsersPayload, type UpsertUserPayload, type UserRecord } from '@/api/admin/users';
import { emitErrorToast, emitSuccessToast } from '@/utils/toast';
import { useConfirm } from 'primevue/useconfirm';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

interface StatusOption {
    label: string;
    value: number | null;
}

interface LoadUsersOptions {
    silent?: boolean;
}

const users = ref<UserRecord[]>([]);
const loading = ref(false);
const totalRecords = ref(0);
const currentPage = ref(1);
const rows = ref(10);
const keyword = ref('');
const selectedStatus = ref<number | null>(null);
const rowsPerPageOptions = [10, 20, 50];

const statusOptions: StatusOption[] = [
    { label: '全部状态', value: null },
    { label: '启用', value: 1 },
    { label: '禁用', value: 0 }
];

const statusFormOptions = computed(() => statusOptions.filter((option) => option.value !== null));

interface UserForm {
    userId?: number | string;
    username: string;
    email: string;
    password: string;
    status: number | null;
    introduction: string;
    address: string;
    roles: Array<number | string>;
}

const confirm = useConfirm();

let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestToken = 0;

const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const dialogLoading = ref(false);
const form = reactive<UserForm>(getEmptyForm());
const formErrors = reactive<{ username?: string; email?: string; password?: string; status?: string; roles?: string }>({});
const roleOptions = ref<Role[]>([]);
const rolesLoading = ref(false);

const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新建用户' : '编辑用户'));
const isEditMode = computed(() => dialogMode.value === 'edit');

async function loadUsers(paramsOverride: Partial<QueryUsersPayload> = {}, options: LoadUsersOptions = {}) {
    const { silent = false } = options;
    const requestId = ++requestToken;
    let loadingTimer: ReturnType<typeof setTimeout> | undefined;

    if (!silent) {
        loadingTimer = setTimeout(() => {
            loading.value = true;
        }, 120);
    }

    const payload: QueryUsersPayload = {
        page: currentPage.value,
        pageSize: rows.value,
        keyword: keyword.value.trim() || undefined,
        status: selectedStatus.value ?? undefined,
        ...paramsOverride
    };

    try {
        const data = await fetchUsers(payload);
        if (requestId !== requestToken) {
            return;
        }
        const normalizedRecords = normalizePageRecords(data);
        users.value = normalizedRecords.length > 0 ? normalizedRecords : (data.records ?? []);

        const normalizedTotal = extractNumericField(data, ['total', 'count', 'length'], normalizedRecords.length);
        totalRecords.value = normalizedTotal;

        const normalizedCurrent = extractNumericField(data, ['current', 'pageNum', 'page'], currentPage.value);
        if (normalizedCurrent) {
            currentPage.value = normalizedCurrent;
        }

        const normalizedSize = extractNumericField(data, ['size', 'pageSize', 'limit'], rows.value);
        if (normalizedSize) {
            rows.value = normalizedSize;
        }
    } catch (error) {
        if (requestId === requestToken) {
            console.error('获取用户列表失败:', error);
            emitErrorToast('获取用户列表失败，请稍后重试');
        }
    } finally {
        if (requestId === requestToken) {
            if (loadingTimer) {
                clearTimeout(loadingTimer);
            }
            if (!silent) {
                loading.value = false;
            } else if (loading.value) {
                loading.value = false;
            }
        }
    }
}

function normalizePageRecords(source: unknown): UserRecord[] {
    const candidates: unknown[] = [];

    if (source && typeof source === 'object') {
        const recordSource = source as Record<string, unknown>;
        candidates.push(recordSource.records);
        candidates.push(recordSource.list);
        candidates.push(recordSource['java.util.ArrayList']);
        candidates.push(...Object.values(recordSource).filter((value) => Array.isArray(value)));
    }

    candidates.push(source);

    for (const candidate of candidates) {
        const normalized = extractArray(candidate);
        if (normalized.length) {
            return normalized;
        }
    }

    return [];
}

function extractArray(value: unknown): UserRecord[] {
    if (Array.isArray(value)) {
        if (value.length === 2 && typeof value[0] === 'string' && value[0].includes('java.util.ArrayList') && Array.isArray(value[1])) {
            return value[1] as UserRecord[];
        }
        if (value.every((item) => typeof item === 'object' || item === null)) {
            return value as UserRecord[];
        }
    }
    return [];
}

function extractNumericField(source: unknown, keys: string[], fallback: number): number {
    if (source && typeof source === 'object') {
        const objectSource = source as Record<string, unknown>;
        for (const key of keys) {
            const value = objectSource[key];
            const numeric = normalizeNumber(value);
            if (numeric !== undefined) {
                return numeric;
            }
        }
    }
    const numeric = normalizeNumber(source);
    return numeric !== undefined ? numeric : fallback;
}

function normalizeNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return undefined;
}

function handlePageChange(event: { page: number; rows: number }) {
    currentPage.value = event.page + 1;
    rows.value = event.rows;
    loadUsers({ page: currentPage.value, pageSize: rows.value });
}

function handleKeywordInput(value: string | undefined) {
    keyword.value = value ?? '';
    currentPage.value = 1;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadUsers({ page: currentPage.value });
    }, 300);
}

function handleStatusChange(value: number | null | undefined) {
    selectedStatus.value = value ?? null;
    currentPage.value = 1;
    loadUsers({ page: currentPage.value });
}

function refresh() {
    loadUsers({}, { silent: true });
}

function clearFilters() {
    keyword.value = '';
    selectedStatus.value = null;
    currentPage.value = 1;
    loadUsers({ page: currentPage.value });
}

function getEmptyForm(): UserForm {
    return {
        userId: undefined,
        username: '',
        email: '',
        password: '',
        status: 1,
        introduction: '',
        address: '',
        roles: []
    };
}

function resetForm(record?: UserRecord) {
    const base = getEmptyForm();
    if (record) {
        base.userId = record.userId;
        base.username = record.username ?? '';
        base.email = record.email ?? '';
        base.status = record.status ?? null;
        base.introduction = record.introduction ?? '';
        base.address = record.address ?? '';
        const rolesFromRecord = extractrolesFromRecord(record);
        base.roles = rolesFromRecord;
    }
    Object.assign(form, base);
    clearFormErrors();
}

function clearFormErrors() {
    formErrors.username = undefined;
    formErrors.email = undefined;
    formErrors.password = undefined;
    formErrors.status = undefined;
    formErrors.roles = undefined;
}

function openCreateDialog() {
    dialogMode.value = 'create';
    resetForm();
    ensureRolesLoaded();
    dialogVisible.value = true;
}

function openEditDialog(record: UserRecord) {
    dialogMode.value = 'edit';
    resetForm(record);
    ensureRolesLoaded();
    dialogVisible.value = true;
}

function onDialogHide() {
    resetForm();
}

function validateForm(): boolean {
    clearFormErrors();
    let valid = true;

    if (!form.username.trim()) {
        formErrors.username = '请输入用户名';
        valid = false;
    }

    if (form.email && !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(form.email)) {
        formErrors.email = '请输入有效的邮箱地址';
        valid = false;
    }

    if (dialogMode.value === 'create') {
        if (!form.password.trim()) {
            formErrors.password = '请输入初始密码';
            valid = false;
        } else if (form.password.trim().length < 6) {
            formErrors.password = '密码至少为 6 位字符';
            valid = false;
        }
    }

    if (form.status === null || form.status === undefined) {
        formErrors.status = '请选择状态';
        valid = false;
    }

    if (!rolesLoading.value && roleOptions.value.length && form.roles.length === 0) {
        formErrors.roles = '请选择至少一个角色';
        valid = false;
    }

    return valid;
}

function resolveSelectedRoles(): Role[] {
    if (!form.roles.length) {
        return [];
    }

    return form.roles
        .map((identifier) => {
            const normalized = String(identifier);
            return roleOptions.value.find((role) => String(role.id) === normalized);
        })
        .filter((role): role is Role => Boolean(role));
}

function buildPayload(): UpsertUserPayload {
    const payload: UpsertUserPayload = {
        username: form.username.trim(),
        email: form.email.trim() || null,
        introduction: form.introduction.trim() || null,
        address: form.address.trim() || null,
        status: form.status,
        roles: (() => {
            const selected = resolveSelectedRoles();
            return selected.length ? selected : null;
        })()
    };

    if (dialogMode.value === 'create') {
        payload.password = form.password.trim();
    }

    return payload;
}

async function submitForm() {
    if (!validateForm()) {
        return;
    }

    dialogLoading.value = true;

    try {
        const payload = buildPayload();
        if (dialogMode.value === 'create') {
            await createUser(payload);
            emitSuccessToast('新建用户成功');
            currentPage.value = 1;
            await loadUsers({ page: 1 });
        } else if (form.userId !== undefined) {
            console.log('Updating user with ID:', form.userId, 'Payload:', payload);
            await updateUser(form.userId, payload);
            emitSuccessToast('更新用户成功');
            await loadUsers({ page: currentPage.value });
        }
        dialogVisible.value = false;
    } catch (error) {
        console.error('保存用户失败:', error);
        emitErrorToast('保存用户失败，请稍后重试');
    } finally {
        dialogLoading.value = false;
    }
}

function confirmDeleteUser(record: UserRecord) {
    confirm.require({
        message: `确认删除用户「${record.username}」吗？`,
        header: '删除用户',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: '取消',
        acceptLabel: '删除',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deleteUser(record.userId);
                emitSuccessToast('删除用户成功');
                if (users.value.length <= 1 && currentPage.value > 1) {
                    currentPage.value -= 1;
                }
                await loadUsers({ page: currentPage.value });
            } catch (error) {
                console.error('删除用户失败:', error);
                emitErrorToast('删除用户失败，请稍后重试');
            }
        }
    });
}

function resolveRoles(record: UserRecord): Role[] {
    const many = Array.isArray(record.roles) ? record.roles : record.role ? [record.role] : [];
    return many.filter((role): role is Role => Boolean(role));
}

function resolveStatusMeta(status?: number | null) {
    if (status === 1) {
        return { label: '启用', severity: 'success' as const };
    }
    if (status === 0) {
        return { label: '禁用', severity: 'danger' as const };
    }
    return { label: '未知', severity: 'secondary' as const };
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

function formatDate(value?: string | null) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return dateTimeFormatter.format(parsed);
}

onMounted(() => {
    loadUsers();
    loadRoles();
});

async function loadRoles() {
    if (rolesLoading.value) return;
    rolesLoading.value = true;
    try {
        const response = await getRoleList();
        roleOptions.value = Array.isArray(response) ? response : [];
    } catch (error) {
        console.error('获取角色列表失败:', error);
        emitErrorToast('获取角色列表失败，请稍后重试');
    } finally {
        rolesLoading.value = false;
    }
}

function ensureRolesLoaded() {
    if (!roleOptions.value.length && !rolesLoading.value) {
        loadRoles();
    }
}

function extractrolesFromRecord(record: UserRecord): Array<number | string> {
    const sources = Array.isArray(record.roles) ? record.roles : record.role ? [record.role] : [];
    return sources.map((role) => extractRoleId(role)).filter((id): id is number | string => id !== undefined && id !== null);
}

function extractRoleId(role: unknown): number | string | undefined {
    if (!role || typeof role !== 'object') {
        return undefined;
    }
    const roleObj = role as Record<string, unknown>;
    const idCandidate = roleObj.id ?? roleObj.roleId ?? roleObj.value;
    if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) {
        return idCandidate;
    }
    if (typeof idCandidate === 'string' && idCandidate.trim() !== '') {
        return idCandidate;
    }
    return undefined;
}

onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <ConfirmDialog />
                <div class="font-semibold text-xl mb-4">用户列表</div>
                <DataTable
                    :value="users"
                    dataKey="userId"
                    :loading="loading"
                    :rowHover="true"
                    :paginator="true"
                    :rows="rows"
                    :rowsPerPageOptions="rowsPerPageOptions"
                    :lazy="true"
                    :totalRecords="totalRecords"
                    :first="(currentPage - 1) * rows"
                    showGridlines
                    @page="handlePageChange"
                >
                    <template #header>
                        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div class="flex flex-wrap items-center gap-3">
                                <Button type="button" icon="pi pi-filter-slash" label="重置" outlined @click="clearFilters" />
                                <IconField iconPosition="left">
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText :modelValue="keyword" placeholder="搜索用户名 / 邮箱" @update:modelValue="handleKeywordInput" />
                                </IconField>
                                <Select :modelValue="selectedStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="筛选状态" showClear class="w-12rem" @update:modelValue="handleStatusChange" />
                            </div>
                            <div class="flex items-center gap-2">
                                <Button icon="pi pi-refresh" label="刷新" severity="secondary" outlined :loading="loading" @click="refresh" />
                                <Button icon="pi pi-user-plus" label="新建用户" severity="success" outlined @click="openCreateDialog" />
                            </div>
                        </div>
                    </template>
                    <template #empty> 暂无用户数据 </template>
                    <template #loading> 正在加载用户，请稍候… </template>

                    <Column field="userId" header="ID" style="width: 6rem" sortable>
                        <template #body="{ data }">
                            <span class="font-medium text-sm">{{ data.userId }}</span>
                        </template>
                    </Column>

                    <Column header="用户" field="username" style="min-width: 16rem">
                        <template #body="{ data }">
                            <div class="flex items-center gap-3">
                                <Avatar v-if="data.avatar" :image="data.avatar" size="large" shape="circle" class="shadow-sm" />
                                <Avatar v-else :label="data.username?.charAt(0)?.toUpperCase() || '?'" size="large" shape="circle" class="bg-primary text-white" />
                                <div class="flex flex-col gap-1">
                                    <span class="font-semibold">{{ data.username }}</span>
                                    <small class="text-color-secondary">
                                        {{ data.introduction || '用户未填写' }}
                                    </small>
                                </div>
                            </div>
                        </template>
                    </Column>

                    <Column field="email" header="邮箱" style="min-width: 16rem">
                        <template #body="{ data }">
                            <span>{{ data.email || '用户未填写' }}</span>
                        </template>
                    </Column>

                    <Column field="address" header="地址" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ data.address || '用户未填写' }}</span>
                        </template>
                    </Column>

                    <Column header="角色" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="flex flex-wrap gap-2">
                                <Tag v-for="role in resolveRoles(data)" :key="role.id || role.roleName" :value="role.roleName" severity="info" rounded />
                                <span v-if="resolveRoles(data).length === 0" class="text-color-secondary">未分配</span>
                            </div>
                        </template>
                    </Column>

                    <Column field="status" header="状态" style="width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="resolveStatusMeta(data.status).label" :severity="resolveStatusMeta(data.status).severity" rounded />
                        </template>
                    </Column>

                    <Column field="lastLogin" header="最近登录" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ formatDate(data.lastLogin) }}</span>
                            <small v-if="data.lastLoginIp" class="ml-2 text-color-secondary">IP: {{ data.lastLoginIp }}</small>
                        </template>
                    </Column>

                    <Column field="createTime" header="创建时间" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ formatDate(data.createTime) }}</span>
                        </template>
                    </Column>

                    <Column header="操作" style="width: 10rem" bodyClass="text-right">
                        <template #body="{ data }">
                            <div class="flex justify-end gap-2">
                                <Button icon="pi pi-pencil" label="编辑" severity="secondary" text size="small" @click="openEditDialog(data)" />
                                <Button icon="pi pi-trash" label="删除" severity="danger" text size="small" @click="confirmDeleteUser(data)" />
                            </div>
                        </template>
                    </Column>

                    <template #footer>
                        <div class="flex flex-wrap justify-between gap-2 text-sm text-color-secondary">
                            <span>共 {{ totalRecords }} 位用户</span>
                            <span>每页 {{ rows }} 条</span>
                        </div>
                    </template>
                </DataTable>

                <Dialog v-model:visible="dialogVisible" :modal="true" :header="dialogTitle" :style="{ width: '520px' }" :closable="!dialogLoading" :draggable="false" contentClass="p-0" @hide="onDialogHide">
                    <form class="flex flex-col gap-5 p-6" @submit.prevent="submitForm">
                        <div class="grid gap-5 md:grid-cols-2">
                            <!-- 用户名（不使用 FloatLabel） -->
                            <div class="flex flex-col w-full">
                                <label for="username" class="text-sm font-medium text-color-secondary">用户名</label>
                                <InputGroup>
                                    <InputGroupAddon>
                                        <i class="pi pi-user text-color-secondary" />
                                    </InputGroupAddon>
                                    <InputText id="username" v-model.trim="form.username" :invalid="!!formErrors.username" placeholder="请输入用户名" class="w-full" />
                                </InputGroup>
                                <Transition name="fade">
                                    <small v-if="formErrors.username" class="block mt-1 text-xs text-red-500">
                                        {{ formErrors.username }}
                                    </small>
                                </Transition>
                            </div>

                            <!-- 地址（不使用 FloatLabel） -->
                            <div class="flex flex-col w-full">
                                <label for="address" class="text-sm font-medium text-color-secondary">地址</label>
                                <InputGroup>
                                    <InputGroupAddon>
                                        <i class="pi pi-map-marker text-color-secondary" />
                                    </InputGroupAddon>
                                    <InputText id="address" v-model.trim="form.address" placeholder="请输入地址" class="w-full" />
                                </InputGroup>
                            </div>
                            <!-- 状态（FloatLabel） -->
                            <FloatLabel class="flex flex-col w-full" variant="on">
                                <Select id="status" v-model="form.status" :options="statusFormOptions" optionLabel="label" optionValue="value" display="chip" :invalid="!!formErrors.status" class="w-full" />
                                <label for="status">状态</label>
                            </FloatLabel>

                            <!-- 角色（FloatLabel） -->
                            <FloatLabel class="flex flex-col w-full" variant="on">
                                <MultiSelect id="roles" v-model="form.roles" :options="roleOptions" optionLabel="roleName" optionValue="id" display="chip" :loading="rolesLoading" :disabled="rolesLoading && !roleOptions.length" class="w-full" />
                                <label for="roles">角色</label>
                            </FloatLabel>

                            <!-- 初始化密码（仅创建时显示） -->
                            <div v-if="!isEditMode" class="flex flex-col w-full">
                                <label for="password" class="text-sm font-medium text-color-secondary">初始化密码</label>
                                <Password id="password" v-model.trim="form.password" placeholder="请输入初始密码" :toggleMask="true" fluid :feedback="false" :invalid="!!formErrors.password" autocomplete="new-password" />
                                <Transition name="fade">
                                    <small v-if="formErrors.password" class="block mt-1 text-xs text-red-500">
                                        {{ formErrors.password }}
                                    </small>
                                </Transition>
                            </div>

                            <!-- 邮箱 -->
                            <div class="flex flex-col w-full">
                                <label for="email" class="text-sm font-medium text-color-secondary">邮箱</label>
                                <InputGroup>
                                    <InputGroupAddon>
                                        <i class="pi pi-envelope text-color-secondary" />
                                    </InputGroupAddon>
                                    <InputText id="email" v-model.trim="form.email" type="email" :invalid="!!formErrors.email" placeholder="请输入邮箱地址" autocomplete="email" class="w-full" />
                                </InputGroup>
                                <Transition name="fade">
                                    <small v-if="formErrors.email" class="block mt-1 text-xs text-red-500">
                                        {{ formErrors.email }}
                                    </small>
                                </Transition>
                            </div>

                            <!-- 个人简介（FloatLabel） -->
                            <FloatLabel class="md:col-span-2 w-full" variant="on">
                                <Textarea id="introduction" v-model.trim="form.introduction" autoResize rows="3" class="w-full" />
                                <label for="introduction">个人简介</label>
                            </FloatLabel>
                        </div>

                        <Divider class="my-1" />

                        <div class="flex justify-end gap-2 mt-2">
                            <Button type="button" label="取消" severity="secondary" outlined :disabled="dialogLoading" @click="dialogVisible = false" />
                            <Button type="submit" label="保存" :loading="dialogLoading" />
                        </div>
                    </form>
                </Dialog>
            </div>
        </div>
    </div>
</template>

<style scoped>
.text-color-secondary {
    color: var(--text-color-secondary);
}
</style>
