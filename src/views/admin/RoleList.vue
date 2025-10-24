<script setup lang="ts">
import {
    createRole,
    deleteRole,
    fetchRoleList,
    updateRole,
    type RoleCreatePayload,
    type RoleUpdatePayload,
    type RoleView
} from '@/api/admin/role';
import { useAuthStore } from '@/stores/auth';
import { useSensitiveDialog } from '@/composables/useSensitiveDialog';
import InputOtp from 'primevue/inputotp';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

interface RoleForm {
    code: string;
    name: string;
    remark: string;
}

const roles = ref<RoleView[]>([]);
const keyword = ref('');
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const toast = useToast();
const authStore = useAuthStore();
const {
    visible: twoFactorDialogVisible,
    code: twoFactorCode,
    loading: twoFactorLoading,
    errorMessage: twoFactorError,
    open: requestSensitiveToken,
    confirm: confirmSensitiveToken,
    cancel: cancelSensitiveToken
} = useSensitiveDialog(toast);

const form = ref<RoleForm>({
    code: '',
    name: '',
    remark: ''
});

onMounted(() => {
    loadRoles();
});

async function loadRoles() {
    loading.value = true;
    try {
        const query = keyword.value.trim();
        roles.value = await fetchRoleList(query ? { keyword: query } : undefined);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载角色列表失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    loadRoles();
}

function clearFilters() {
    keyword.value = '';
    loadRoles();
}

function openCreate() {
    editingId.value = null;
    form.value = {
        code: '',
        name: '',
        remark: ''
    };
    dialogVisible.value = true;
}

function openEdit(role: RoleView) {
    editingId.value = role.id;
    form.value = {
        code: role.code,
        name: role.name,
        remark: role.remark ?? ''
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

    const sensitiveToken = await acquireSensitiveToken();
    if (!sensitiveToken) {
        return;
    }
    saving.value = true;
    try {
        if (editingId.value === null) {
            const payload: RoleCreatePayload = { code, name, remark };
            await createRole(payload, sensitiveToken);
            toast.add({ severity: 'success', summary: '创建成功', detail: '角色已创建', life: 3000 });
        } else {
            const payload: RoleUpdatePayload = { code, name, remark };
            await updateRole(editingId.value, payload, sensitiveToken);
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
        authStore.clearSensitiveToken();
    }
}

async function removeRole(role: RoleView) {
    const confirmed = window.confirm(`确定要删除角色「${role.name}」吗？`);
    if (!confirmed) {
        return;
    }
    const sensitiveToken = await acquireSensitiveToken();
    if (!sensitiveToken) {
        return;
    }
    try {
        await deleteRole(role.id, sensitiveToken);
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
        authStore.clearSensitiveToken();
    }
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

async function acquireSensitiveToken(): Promise<string | null> {
    return await requestSensitiveToken();
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputText v-model="keyword" placeholder="搜索角色编码或名称" @keyup.enter="onSearch"
                            style="min-width: 18rem" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                        <Button label="新建角色" icon="pi pi-plus" severity="success" @click="openCreate" />
                    </div>
                </div>

                <DataTable :value="roles" dataKey="id" :loading="loading" responsiveLayout="scroll">
                    <Column field="code" header="角色编码" style="min-width: 10rem" />
                    <Column field="name" header="角色名称" style="min-width: 10rem" />
                    <Column field="remark" header="备注" style="min-width: 14rem">
                        <template #body="{ data }">
                            {{ data.remark || '-' }}
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
                            <div class="flex gap-2">
                                <Button label="编辑" icon="pi pi-pencil" text @click="openEdit(data)" />
                                <Button label="删除" icon="pi pi-trash" text severity="danger"
                                    @click="removeRole(data)" />
                            </div>
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建角色' : '编辑角色'"
        :style="{ width: '28rem' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" @hide="closeDialog">
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
            <div class="flex justify-end gap-2 mt-3">
                <Button type="button" label="取消" severity="secondary" @click="closeDialog" />
                <Button type="submit" label="保存" icon="pi pi-check" :loading="saving" />
            </div>
        </form>
    </Dialog>

    <Dialog v-model:visible="twoFactorDialogVisible" modal header="二次验证"
        :style="{ width: '22rem' }" :draggable="false">
        <div class="space-y-3">
            <p class="text-sm text-surface-500 dark:text-surface-300">
                为确保安全，请输入绑定的 6 位二次验证码。
            </p>
            <div class="flex justify-center">
                <InputOtp v-model="twoFactorCode" :length="6" mask class="otp-input" />
            </div>
            <p v-if="twoFactorError" class="text-xs text-red-500 text-center">{{ twoFactorError }}</p>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="取消" severity="secondary" @click="cancelSensitiveToken" />
                <Button label="确认" icon="pi pi-shield" :loading="twoFactorLoading" @click="confirmSensitiveToken" />
            </div>
        </div>
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

.otp-input :deep(.p-inputotp-input) {
    width: 3rem;
    height: 3rem;
    font-size: 1.25rem;
    text-align: center;
}
</style>
