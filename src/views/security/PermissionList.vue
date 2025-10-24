<script setup lang="ts">
import {
    createPermission,
    deletePermission,
    fetchPermissions,
    updatePermission,
    type PermissionCreatePayload,
    type PermissionUpdatePayload,
    type PermissionView
} from '@/api/admin/permissions';
import { useSensitiveDialog } from '@/composables/useSensitiveDialog';
import { useAuthStore } from '@/stores/auth';
import InputOtp from 'primevue/inputotp';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const permissions = ref<PermissionView[]>([]);
const keyword = ref('');
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const form = ref<PermissionCreatePayload>({ code: '', name: '' });

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

onMounted(() => {
    loadPermissions();
});

async function loadPermissions() {
    loading.value = true;
    try {
        const params = keyword.value.trim() ? { keyword: keyword.value.trim() } : undefined;
        permissions.value = await fetchPermissions(params);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载权限列表失败',
            life: 4000
        });
    } finally {
        loading.value = false;
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
    const sensitiveToken = await requestSensitiveToken();
    if (!sensitiveToken) {
        return;
    }
    saving.value = true;
    try {
        if (editingId.value === null) {
            const payload: PermissionCreatePayload = { code, name };
            await createPermission(payload, sensitiveToken);
            toast.add({ severity: 'success', summary: '创建成功', detail: '权限已创建', life: 3000 });
        } else {
            const payload: PermissionUpdatePayload = { code, name };
            await updatePermission(editingId.value, payload, sensitiveToken);
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
        authStore.clearSensitiveToken();
    }
}

async function removePermission(item: PermissionView) {
    const confirmed = window.confirm(`确定要删除权限「${item.code}」吗？`);
    if (!confirmed) {
        return;
    }
    const sensitiveToken = await requestSensitiveToken();
    if (!sensitiveToken) {
        return;
    }
    try {
        await deletePermission(item.id, sensitiveToken);
        toast.add({ severity: 'success', summary: '删除成功', detail: '权限已删除', life: 3000 });
        await loadPermissions();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除权限失败',
            life: 4000
        });
    } finally {
        authStore.clearSensitiveToken();
    }
}

function onSearch() {
    loadPermissions();
}

function clearFilters() {
    keyword.value = '';
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
                <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputText v-model="keyword" placeholder="搜索权限编码或名称" @keyup.enter="onSearch"
                            style="min-width: 18rem" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="查询" icon="pi pi-search" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                        <Button label="新建权限" icon="pi pi-plus" severity="success" @click="openCreate" />
                    </div>
                </div>

                <DataTable :value="permissions" dataKey="id" :loading="loading" responsiveLayout="scroll">
                    <Column field="code" header="权限编码" style="min-width: 12rem" />
                    <Column field="name" header="权限名称" style="min-width: 12rem" />
                    <Column field="createdAt" header="创建时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                    </Column>
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button label="编辑" icon="pi pi-pencil" text @click="openEdit(data)" />
                                <Button label="删除" icon="pi pi-trash" severity="danger" text
                                    @click="removePermission(data)" />
                            </div>
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-surface-500 dark:text-surface-300">暂无权限数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建权限' : '编辑权限'"
        :style="{ width: '24rem' }" @hide="closeDialog">
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

    <Dialog v-model:visible="twoFactorDialogVisible" modal header="二次验证"
        :style="{ width: '22rem' }" :draggable="false">
        <div class="space-y-3">
            <p class="text-sm text-surface-500 dark:text-surface-300">请输入 6 位二次验证码以确认操作。</p>
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

.otp-input :deep(.p-inputotp-input) {
    width: 3rem;
    height: 3rem;
    font-size: 1.25rem;
    text-align: center;
}
</style>
