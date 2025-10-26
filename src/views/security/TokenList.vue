<script setup lang="ts">
import { fetchAuthTokens, revokeAuthToken, type AuthTokenView } from '@/api/admin/auth-tokens';
import SensitiveActionDialog, { type SensitiveActionDialogExpose } from '@/components/SensitiveActionDialog.vue';
import { useAuthStore } from '@/stores/auth';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const tokens = ref<AuthTokenView[]>([]);
const loading = ref(false);
const userIdFilter = ref('');
const kindFilter = ref<string | null>(null);
const revokedFilter = ref<'all' | 'active' | 'revoked'>('active');

const kindOptions = [
    { label: '全部类型', value: null },
    { label: '访问令牌', value: 'access' },
    { label: '刷新令牌', value: 'refresh' },
    { label: '敏感操作令牌', value: 'api' }
];

const revokedOptions = [
    { label: '仅显示有效', value: 'active' },
    { label: '仅显示已撤销', value: 'revoked' },
    { label: '全部', value: 'all' }
];

const toast = useToast();
const authStore = useAuthStore();
const sensitiveDialogRef = ref<SensitiveActionDialogExpose | null>(null);

async function requestSensitiveToken() {
    if (!sensitiveDialogRef.value) {
        return null;
    }
    return sensitiveDialogRef.value.requestToken();
}

onMounted(() => {
    loadTokens();
});

async function loadTokens() {
    loading.value = true;
    try {
        const params: { userId?: number; kind?: string; revoked?: boolean } = {};
        if (userIdFilter.value.trim()) {
            const parsed = Number(userIdFilter.value.trim());
            if (!Number.isNaN(parsed)) {
                params.userId = parsed;
            }
        }
        if (kindFilter.value) {
            params.kind = kindFilter.value;
        }
        if (revokedFilter.value === 'active') {
            params.revoked = false;
        } else if (revokedFilter.value === 'revoked') {
            params.revoked = true;
        }
        tokens.value = await fetchAuthTokens(params);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载令牌失败',
            life: 4000
        });
    } finally {
        loading.value = false;
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
    const sensitiveToken = await requestSensitiveToken();
    if (!sensitiveToken) {
        return;
    }
    try {
        await revokeAuthToken(token.id, sensitiveToken);
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
        authStore.clearSensitiveToken();
    }
}

function onSearch() {
    loadTokens();
}

function clearFilters() {
    userIdFilter.value = '';
    kindFilter.value = null;
    revokedFilter.value = 'active';
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
                <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div class="grid gap-3 grid-cols-1 md:grid-cols-3 w-full md:w-auto">
                        <span class="p-input-icon-left">
                            <InputText v-model="userIdFilter" placeholder="按用户ID过滤" />
                        </span>
                        <Dropdown v-model="kindFilter" :options="kindOptions" optionLabel="label" optionValue="value"
                            placeholder="按类型过滤" class="w-full" />
                        <Dropdown v-model="revokedFilter" :options="revokedOptions" optionLabel="label"
                            optionValue="value" class="w-full" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="查询" icon="pi pi-search" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                    </div>
                </div>

                <DataTable :value="tokens" dataKey="id" :loading="loading" responsiveLayout="scroll">
                    <Column field="id" header="ID" style="min-width: 6rem" />
                    <Column field="userId" header="用户ID" style="min-width: 8rem" />
                    <Column field="kind" header="类型" style="min-width: 10rem">
                        <template #body="{ data }">
                            <Tag :value="data.kind" severity="info" />
                        </template>
                    </Column>
                    <Column header="状态" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="tokenStatusLabel(data)" :severity="tokenSeverity(data)" />
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                    </Column>
                    <Column field="expiresAt" header="过期时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.expiresAt) }}
                        </template>
                    </Column>
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <SplitButton label="撤销" icon="pi pi-ban" severity="danger" size="small" :model="[]"
                                :disabled="data.revoked" @click="revoke(data)" />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-surface-500 dark:text-surface-300">暂无令牌数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <SensitiveActionDialog ref="sensitiveDialogRef" />
</template>
