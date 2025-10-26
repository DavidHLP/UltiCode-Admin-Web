<script setup lang="ts">
import { fetchAuditLogs, type AuditLogView } from '@/api/admin/audit-logs';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

const logs = ref<AuditLogView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(20);
const keyword = ref('');
const actionFilter = ref<string | null>(null);
const loading = ref(false);

const toast = useToast();

const actionOptions = [
    { label: '全部动作', value: null },
    { label: '登录成功', value: 'LOGIN_SUCCESS' },
    { label: '登录失败', value: 'LOGIN_FAILURE' },
    { label: '角色权限调整', value: 'ROLE_PERMISSION_UPDATED' },
    { label: '用户角色调整', value: 'USER_ROLE_CHANGED' },
    { label: '权限变更', value: 'SECURITY_POLICY_CHANGED' },
    { label: '令牌撤销', value: 'TOKEN_REVOKED' },
    { label: 'SSO 会话创建', value: 'SSO_SESSION_CREATED' },
    { label: 'SSO 会话撤销', value: 'SSO_SESSION_REVOKED' }
];

onMounted(() => {
    loadLogs();
});

async function loadLogs(targetPage = page.value) {
    loading.value = true;
    try {
        const response = await fetchAuditLogs({
            page: targetPage,
            size: size.value,
            action: actionFilter.value ?? undefined,
            keyword: keyword.value.trim() || undefined
        });
        logs.value = response.items ?? [];
        total.value = response.total ?? 0;
        page.value = response.page ?? targetPage;
        size.value = response.size ?? size.value;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载审计日志失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    page.value = 1;
    loadLogs(1);
}

function clearFilters() {
    keyword.value = '';
    actionFilter.value = null;
    onSearch();
}

function onPage(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadLogs(page.value);
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
                <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div class="grid gap-3 grid-cols-1 md:grid-cols-2 w-full md:w-auto">
                        <InputText v-model="keyword" placeholder="搜索对象ID、描述或操作者" @keyup.enter="onSearch" />
                        <Dropdown v-model="actionFilter" :options="actionOptions" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="查询" icon="pi pi-search" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                    </div>
                </div>

                <DataTable :value="logs" dataKey="id" :loading="loading" :paginator="true" :rows="size" :totalRecords="total" :first="(page - 1) * size" @page="onPage" responsiveLayout="scroll">
                    <Column field="createdAt" header="时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                    </Column>
                    <Column field="action" header="动作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <Tag :value="data.action" />
                        </template>
                    </Column>
                    <Column field="actorUsername" header="操作者" style="min-width: 10rem">
                        <template #body="{ data }"> {{ data.actorUsername || '-' }} (ID: {{ data.actorId ?? '-' }}) </template>
                    </Column>
                    <Column field="objectType" header="对象" style="min-width: 12rem">
                        <template #body="{ data }"> {{ data.objectType }} / {{ data.objectId ?? '-' }} </template>
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
