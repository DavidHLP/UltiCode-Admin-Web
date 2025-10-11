<script setup lang="ts">
import { createRole, deleteRole, fetchRoles, updateRole, type QueryRolesPayload, type Role, type UpsertRolePayload } from '@/api/role';
import { emitErrorToast, emitSuccessToast } from '@/utils/toast';
import { useConfirm } from 'primevue/useconfirm';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

interface StatusOption {
    label: string;
    value: number | null;
}

interface LoadRolesOptions {
    silent?: boolean;
}

interface RoleForm {
    roleId?: number | string;
    roleName: string;
    status: number | null;
    remark: string;
}

const roles = ref<Role[]>([]);
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

const confirm = useConfirm();

let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestToken = 0;

const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const dialogLoading = ref(false);
const form = reactive<RoleForm>(getEmptyForm());
const formErrors = reactive<{ roleName?: string; status?: string }>({});

const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新建角色' : '编辑角色'));
const isEditMode = computed(() => dialogMode.value === 'edit');

async function loadRoles(paramsOverride: Partial<QueryRolesPayload> = {}, options: LoadRolesOptions = {}) {
    const { silent = false } = options;
    const requestId = ++requestToken;
    let loadingTimer: ReturnType<typeof setTimeout> | undefined;

    if (!silent) {
        loadingTimer = setTimeout(() => {
            loading.value = true;
        }, 120);
    }

    const payload: QueryRolesPayload = {
        page: currentPage.value,
        pageSize: rows.value,
        keyword: keyword.value.trim() || undefined,
        status: selectedStatus.value ?? undefined,
        ...paramsOverride
    };

    try {
        const data = await fetchRoles(payload);
        if (requestId !== requestToken) {
            return;
        }

        const normalizedRecords = normalizePageRecords(data);
        roles.value = normalizedRecords.length > 0 ? normalizedRecords : (data.records ?? []);

        const normalizedTotal = extractNumericField(data, ['total', 'count', 'length'], roles.value.length);
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
            console.error('获取角色列表失败:', error);
            emitErrorToast('获取角色列表失败，请稍后重试');
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

function normalizePageRecords(source: unknown): Role[] {
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

function extractArray(value: unknown): Role[] {
    if (Array.isArray(value)) {
        if (value.length === 2 && typeof value[0] === 'string' && value[0].includes('java.util.ArrayList') && Array.isArray(value[1])) {
            return value[1] as Role[];
        }
        if (value.every((item) => typeof item === 'object' || item === null)) {
            return value as Role[];
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
    loadRoles({ page: currentPage.value, pageSize: rows.value });
}

function handleKeywordInput(value: string | undefined) {
    keyword.value = value ?? '';
    currentPage.value = 1;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadRoles({ page: currentPage.value });
    }, 300);
}

function handleStatusChange(value: number | null | undefined) {
    selectedStatus.value = value ?? null;
    currentPage.value = 1;
    loadRoles({ page: currentPage.value });
}

function refresh() {
    loadRoles({}, { silent: true });
}

function clearFilters() {
    keyword.value = '';
    selectedStatus.value = null;
    currentPage.value = 1;
    loadRoles({ page: currentPage.value });
}

function getEmptyForm(): RoleForm {
    return {
        roleId: undefined,
        roleName: '',
        status: 1,
        remark: ''
    };
}

function resetForm(record?: Role) {
    const base = getEmptyForm();
    if (record) {
        base.roleId = record.id;
        base.roleName = record.roleName ?? '';
        base.status = record.status ?? null;
        base.remark = record.remark ?? '';
    }
    Object.assign(form, base);
    clearFormErrors();
}

function clearFormErrors() {
    formErrors.roleName = undefined;
    formErrors.status = undefined;
}

function openCreateDialog() {
    dialogMode.value = 'create';
    resetForm();
    dialogVisible.value = true;
}

function openEditDialog(record: Role) {
    dialogMode.value = 'edit';
    resetForm(record);
    dialogVisible.value = true;
}

function onDialogHide() {
    resetForm();
}

function validateForm(): boolean {
    clearFormErrors();
    let valid = true;

    if (!form.roleName.trim()) {
        formErrors.roleName = '请输入角色名称';
        valid = false;
    }

    if (form.status === null || form.status === undefined) {
        formErrors.status = '请选择状态';
        valid = false;
    }

    return valid;
}

function buildPayload(): UpsertRolePayload {
    return {
        roleName: form.roleName.trim(),
        status: form.status ?? 1,
        remark: form.remark.trim() || null
    };
}

async function submitForm() {
    if (!validateForm()) {
        return;
    }

    dialogLoading.value = true;

    try {
        const payload = buildPayload();
        if (dialogMode.value === 'create') {
            await createRole(payload);
            emitSuccessToast('新建角色成功');
            currentPage.value = 1;
            await loadRoles({ page: 1 });
        } else if (form.roleId !== undefined) {
            await updateRole(form.roleId, payload);
            emitSuccessToast('更新角色成功');
            await loadRoles({ page: currentPage.value });
        }
        dialogVisible.value = false;
    } catch (error) {
        console.error('保存角色失败:', error);
        emitErrorToast('保存角色失败，请稍后重试');
    } finally {
        dialogLoading.value = false;
    }
}

function confirmDeleteRole(record: Role) {
    confirm.require({
        message: `确认删除角色「${record.roleName}」吗？`,
        header: '删除角色',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: '取消',
        acceptLabel: '删除',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await deleteRole(record.id);
                emitSuccessToast('删除角色成功');
                if (roles.value.length <= 1 && currentPage.value > 1) {
                    currentPage.value -= 1;
                }
                await loadRoles({ page: currentPage.value });
            } catch (error) {
                console.error('删除角色失败:', error);
                emitErrorToast('删除角色失败，请稍后重试');
            }
        }
    });
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
    loadRoles();
});

onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <ConfirmDialog />
                <div class="font-semibold text-xl mb-4">角色列表</div>
                <DataTable
                    :value="roles"
                    dataKey="id"
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
                                    <InputText :modelValue="keyword" placeholder="搜索角色名称" @update:modelValue="handleKeywordInput" />
                                </IconField>
                                <Select :modelValue="selectedStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="筛选状态" showClear class="w-12rem" @update:modelValue="handleStatusChange" />
                            </div>
                            <div class="flex items-center gap-2">
                                <Button icon="pi pi-refresh" label="刷新" severity="secondary" outlined :loading="loading" @click="refresh" />
                                <Button icon="pi pi-plus" label="新建角色" severity="success" outlined @click="openCreateDialog" />
                            </div>
                        </div>
                    </template>
                    <template #empty> 暂无角色数据 </template>
                    <template #loading> 正在加载角色，请稍候… </template>

                    <Column field="id" header="ID" style="width: 6rem" sortable>
                        <template #body="{ data }">
                            <span class="font-medium text-sm">{{ data.id }}</span>
                        </template>
                    </Column>

                    <Column field="roleName" header="角色名称" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span class="font-semibold">{{ data.roleName }}</span>
                        </template>
                    </Column>

                    <Column field="status" header="状态" style="width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="resolveStatusMeta(data.status).label" :severity="resolveStatusMeta(data.status).severity" rounded />
                        </template>
                    </Column>

                    <Column field="remark" header="备注" style="min-width: 16rem">
                        <template #body="{ data }">
                            <span>{{ data.remark || '未填写' }}</span>
                        </template>
                    </Column>

                    <Column field="createTime" header="创建时间" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ formatDate(data.createTime) }}</span>
                        </template>
                    </Column>

                    <Column field="updateTime" header="更新时间" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ formatDate(data.updateTime) }}</span>
                        </template>
                    </Column>

                    <Column header="操作" style="width: 10rem" bodyClass="text-right">
                        <template #body="{ data }">
                            <div class="flex justify-end gap-2">
                                <Button icon="pi pi-pencil" label="编辑" severity="secondary" text size="small" @click="openEditDialog(data)" />
                                <Button icon="pi pi-trash" label="删除" severity="danger" text size="small" @click="confirmDeleteRole(data)" />
                            </div>
                        </template>
                    </Column>

                    <template #footer>
                        <div class="flex flex-wrap justify-between gap-2 text-sm text-color-secondary">
                            <span>共 {{ totalRecords }} 个角色</span>
                            <span>每页 {{ rows }} 条</span>
                        </div>
                    </template>
                </DataTable>

                <Dialog v-model:visible="dialogVisible" :modal="true" :header="dialogTitle" :style="{ width: '460px' }" :closable="!dialogLoading" :draggable="false" contentClass="p-0" @hide="onDialogHide">
                    <form class="flex flex-col gap-5 p-6" @submit.prevent="submitForm">
                        <div class="grid gap-5">
                            <div class="flex flex-col w-full">
                                <label for="roleName" class="text-sm font-medium text-color-secondary">角色名称</label>
                                <InputGroup>
                                    <InputGroupAddon>
                                        <i class="pi pi-shield text-color-secondary" />
                                    </InputGroupAddon>
                                    <InputText id="roleName" v-model.trim="form.roleName" :invalid="!!formErrors.roleName" placeholder="请输入角色名称" class="w-full" />
                                </InputGroup>
                                <Transition name="fade">
                                    <small v-if="formErrors.roleName" class="block mt-1 text-xs text-red-500">
                                        {{ formErrors.roleName }}
                                    </small>
                                </Transition>
                            </div>

                            <FloatLabel class="w-full" variant="on">
                                <Select id="status" v-model="form.status" :options="statusFormOptions" optionLabel="label" optionValue="value" display="chip" :invalid="!!formErrors.status" class="w-full" />
                                <label for="status">状态</label>
                            </FloatLabel>
                            <Transition name="fade">
                                <small v-if="formErrors.status" class="block -mt-3 text-xs text-red-500">
                                    {{ formErrors.status }}
                                </small>
                            </Transition>

                            <FloatLabel class="w-full" variant="on">
                                <Textarea id="remark" v-model.trim="form.remark" autoResize rows="3" class="w-full" />
                                <label for="remark">备注</label>
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
