<script setup lang="ts">
import {
    fetchJudgeJobDetail,
    fetchJudgeJobs,
    fetchJudgeNodes,
    retryJudgeJob,
    type JudgeJobDetailView,
    type JudgeJobQuery,
    type JudgeJobView,
    type JudgeNodeView
} from '@/api/judge';
import SensitiveActionDialog, { type SensitiveActionDialogExpose } from '@/components/SensitiveActionDialog.vue';
import { useAuthStore } from '@/stores/auth';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();
const authStore = useAuthStore();
const sensitiveDialogRef = ref<SensitiveActionDialogExpose | null>(null);

async function requestSensitiveToken() {
    if (!sensitiveDialogRef.value) {
        return null;
    }
    return sensitiveDialogRef.value.requestToken();
}

const nodes = ref<JudgeNodeView[]>([]);
const nodeLoading = ref(false);
const nodeStatusFilter = ref<string | null>(null);
const nodeKeyword = ref('');

const jobs = ref<JudgeJobView[]>([]);
const jobLoading = ref(false);
const jobTotal = ref(0);
const jobPage = ref(1);
const jobSize = ref(20);
const jobStatusFilter = ref<string | null>(null);
const jobNodeFilter = ref<number | null>(null); // null=全部, -1=未分配, >0=节点
const jobKeyword = ref('');
const submissionIdFilter = ref('');

const jobDetailVisible = ref(false);
const jobDetailLoading = ref(false);
const jobDetail = ref<JudgeJobDetailView | null>(null);

const nodeFilterOptions = [
    { label: '全部状态', value: null },
    { label: '在线', value: 'online' },
    { label: '忙碌', value: 'busy' },
    { label: '下线', value: 'offline' },
    { label: '下线中', value: 'draining' }
];

const jobStatusOptions = [
    { label: '全部状态', value: null },
    { label: '排队中', value: 'queued' },
    { label: '执行中', value: 'running' },
    { label: '已完成', value: 'finished' },
    { label: '失败', value: 'failed' },
    { label: '已取消', value: 'canceled' }
];

const jobNodeOptions = computed(() => {
    const options: { label: string; value: number | null }[] = [
        { label: '全部节点', value: null },
        { label: '未分配', value: -1 }
    ];
    nodes.value.forEach((node) => {
        options.push({ label: `${node.name}`, value: node.id });
    });
    return options;
});

onMounted(() => {
    refreshNodes();
    loadJobs();
});

async function refreshNodes() {
    nodeLoading.value = true;
    try {
        nodes.value =
            (await fetchJudgeNodes({
                status: nodeStatusFilter.value ?? undefined,
                keyword: nodeKeyword.value.trim() || undefined
            })) ?? [];
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载节点失败',
            detail: (error as Error)?.message ?? '无法加载评测节点列表',
            life: 4000
        });
    } finally {
        nodeLoading.value = false;
    }
}

async function loadJobs(targetPage = jobPage.value) {
    jobLoading.value = true;
    try {
        const params: JudgeJobQuery = {
            page: targetPage,
            size: jobSize.value,
            status: jobStatusFilter.value ?? undefined,
            keyword: jobKeyword.value.trim() || undefined
        };
        if (jobNodeFilter.value === -1) {
            params.onlyUnassigned = true;
        } else if (jobNodeFilter.value && jobNodeFilter.value > 0) {
            params.nodeId = jobNodeFilter.value;
        }
        const submissionId = Number(submissionIdFilter.value.trim());
        if (!Number.isNaN(submissionId) && submissionId > 0) {
            params.submissionId = submissionId;
        }
        const response = await fetchJudgeJobs(params);
        jobs.value = response.items ?? [];
        jobTotal.value = response.total ?? 0;
        jobPage.value = response.page ?? targetPage;
        jobSize.value = response.size ?? jobSize.value;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载任务失败',
            detail: (error as Error)?.message ?? '无法加载评测任务',
            life: 4000
        });
    } finally {
        jobLoading.value = false;
    }
}

function onJobPage(event: { page: number; rows: number }) {
    jobPage.value = event.page + 1;
    jobSize.value = event.rows;
    loadJobs(jobPage.value);
}

function onSearchJobs() {
    jobPage.value = 1;
    loadJobs(1);
}

function clearJobFilters() {
    jobStatusFilter.value = null;
    jobNodeFilter.value = null;
    jobKeyword.value = '';
    submissionIdFilter.value = '';
    onSearchJobs();
}

function clearNodeFilters() {
    nodeStatusFilter.value = null;
    nodeKeyword.value = '';
    refreshNodes();
}

async function openJobDetail(job: JudgeJobView) {
    jobDetailVisible.value = true;
    jobDetailLoading.value = true;
    try {
        jobDetail.value = await fetchJudgeJobDetail(job.id);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '无法加载任务详情',
            life: 4000
        });
        jobDetailVisible.value = false;
    } finally {
        jobDetailLoading.value = false;
    }
}

async function retryJob(job: JudgeJobView) {
    if (!canRetry(job)) {
        return;
    }
    const confirmed = window.confirm(`确定要重新调度任务 #${job.id} 吗？`);
    if (!confirmed) {
        return;
    }
    const sensitiveToken = await requestSensitiveToken();
    if (!sensitiveToken) {
        return;
    }
    try {
        await retryJudgeJob(job.id, sensitiveToken);
        toast.add({
            severity: 'success',
            summary: '操作成功',
            detail: '任务已重新排队',
            life: 3000
        });
        await loadJobs();
        await refreshNodes();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '重试任务失败',
            life: 4000
        });
    } finally {
        authStore.clearSensitiveToken();
    }
}

function canRetry(job: JudgeJobView) {
    return job.status === 'failed' || job.status === 'canceled';
}

function nodeStatusSeverity(status?: string | null) {
    switch (status) {
        case 'online':
            return 'success';
        case 'busy':
            return 'info';
        case 'draining':
            return 'warn';
        case 'offline':
            return 'danger';
        default:
            return 'secondary';
    }
}

function jobStatusSeverity(status?: string) {
    switch (status) {
        case 'queued':
            return 'info';
        case 'running':
            return 'warn';
        case 'finished':
            return 'success';
        case 'failed':
            return 'danger';
        case 'canceled':
            return 'secondary';
        default:
            return 'info';
    }
}

function verdictSeverity(verdict?: string | null) {
    switch (verdict) {
        case 'AC':
            return 'success';
        case 'PD':
            return 'info';
        case 'WA':
        case 'PE':
            return 'warn';
        case 'TLE':
        case 'MLE':
        case 'RE':
        case 'CE':
        case 'IE':
            return 'danger';
        default:
            return 'secondary';
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
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

function runtimeEntries(node: JudgeNodeView) {
    const info = node.runtimeInfo || {};
    return Object.entries(info)
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => `${key}: ${String(value)}`);
}

async function copyText(payload: string, label: string) {
    if (!payload) {
        return;
    }
    try {
        await navigator.clipboard.writeText(payload);
        toast.add({
            severity: 'success',
            summary: '已复制',
            detail: `${label} 已复制到剪贴板`,
            life: 2000
        });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '复制失败',
            detail: (error as Error)?.message ?? '请手动复制内容',
            life: 3000
        });
    }
}

const selectedArtifactKind = (artifactKind: string) => {
    switch (artifactKind) {
        case 'compile_log':
            return 'info';
        case 'run_log':
        case 'stdout':
            return 'success';
        case 'stderr':
            return 'warn';
        case 'diff':
            return 'danger';
        default:
            return 'secondary';
    }
};
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div class="grid gap-3 grid-cols-1 md:grid-cols-3 w-full md:w-auto">
                        <Dropdown v-model="nodeStatusFilter" :options="nodeFilterOptions" optionLabel="label"
                            optionValue="value" placeholder="节点状态" class="w-full" />
                        <InputText v-model="nodeKeyword" placeholder="按名称搜索节点" @keyup.enter="refreshNodes" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="刷新" icon="pi pi-sync" :loading="nodeLoading" @click="refreshNodes" />
                        <Button label="重置" icon="pi pi-times" severity="secondary" @click="clearNodeFilters" />
                    </div>
                </div>
                <div v-if="nodes.length === 0" class="py-6 text-center text-surface-500 dark:text-surface-300">
                    暂无节点记录
                </div>
                <div v-else class="grid">
                    <div v-for="node in nodes" :key="node.id" class="col-12 md:col-6 lg:col-4">
                        <div class="node-card">
                            <div class="flex items-center justify-between mb-2">
                                <div class="text-lg font-semibold">{{ node.name }}</div>
                                <Tag :value="node.status" :severity="nodeStatusSeverity(node.status)" />
                            </div>
                            <div class="text-sm text-surface-500 dark:text-surface-300 mb-3">
                                最后心跳：{{ formatDate(node.lastHeartbeat) }}
                            </div>
                            <div class="grid text-center metrics">
                                <div>
                                    <span class="metric-label">排队</span>
                                    <span class="metric-value">{{ node.metrics?.queuedJobs ?? 0 }}</span>
                                </div>
                                <div>
                                    <span class="metric-label">运行</span>
                                    <span class="metric-value">{{ node.metrics?.runningJobs ?? 0 }}</span>
                                </div>
                                <div>
                                    <span class="metric-label text-red-500">失败</span>
                                    <span class="metric-value">{{ node.metrics?.failedJobs ?? 0 }}</span>
                                </div>
                                <div>
                                    <span class="metric-label">1h 完成</span>
                                    <span class="metric-value">{{ node.metrics?.finishedLastHour ?? 0 }}</span>
                                </div>
                            </div>
                            <div v-if="runtimeEntries(node).length" class="runtime-list">
                                <div v-for="entry in runtimeEntries(node)" :key="entry" class="runtime-item">
                                    {{ entry }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
                    <div class="grid gap-3 grid-cols-1 md:grid-cols-3 lg:grid-cols-4 w-full">
                        <Dropdown v-model="jobStatusFilter" :options="jobStatusOptions" optionLabel="label"
                            optionValue="value" placeholder="任务状态" class="w-full" />
                        <Dropdown v-model="jobNodeFilter" :options="jobNodeOptions" optionLabel="label"
                            optionValue="value" placeholder="所属节点" class="w-full" />
                        <InputText v-model="submissionIdFilter" placeholder="按提交 ID" />
                        <InputText v-model="jobKeyword" placeholder="按用户或题目关键字" @keyup.enter="onSearchJobs" />
                    </div>
                    <div class="flex gap-2 flex-wrap justify-end w-full md:w-auto">
                        <Button label="查询" icon="pi pi-search" @click="onSearchJobs" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearJobFilters" />
                    </div>
                </div>

                <DataTable :value="jobs" dataKey="id" :loading="jobLoading" responsiveLayout="scroll" :rows="jobSize"
                    :paginator="true" :totalRecords="jobTotal" :rowsPerPageOptions="[10, 20, 50]"
                    :first="(jobPage - 1) * jobSize" @page="onJobPage">
                    <Column field="id" header="任务 ID" style="min-width: 6rem" />
                    <Column field="submissionId" header="提交 ID" style="min-width: 6rem" />
                    <Column header="状态" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="data.status" :severity="jobStatusSeverity(data.status)" />
                        </template>
                    </Column>
                    <Column header="节点" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.node?.name ?? '未分配' }}
                        </template>
                    </Column>
                    <Column header="提交者" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.submission?.user?.username ?? '-' }}
                        </template>
                    </Column>
                    <Column header="题目" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.submission?.problem?.slug ?? '-' }}
                        </template>
                    </Column>
                    <Column header="语言" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ data.submission?.language?.displayName ?? '-' }}
                        </template>
                    </Column>
                    <Column header="判题结果" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="data.submission?.verdict ?? 'PD'"
                                :severity="verdictSeverity(data.submission?.verdict)" />
                        </template>
                    </Column>
                    <Column header="测试通过" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ data.testSummary?.passed ?? 0 }}/{{ data.testSummary?.total ?? 0 }}
                        </template>
                    </Column>
                    <Column header="创建时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                    </Column>
                    <Column header="操作" style="min-width: 12rem">
                        <template #body="{ data }">
                            <SplitButton label="详情" icon="pi pi-search" size="small" :model="[
                                {
                                    label: '重试任务',
                                    icon: 'pi pi-refresh',
                                    command: () => retryJob(data),
                                    disabled: !canRetry(data)
                                }
                            ]" @click="openJobDetail(data)" />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-surface-500 dark:text-surface-300">
                            暂无任务
                        </div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="jobDetailVisible" header="任务详情" :modal="true" :style="{ width: '70vw' }"
        :breakpoints="{ '960px': '95vw' }" :dismissableMask="true">
        <div v-if="jobDetailLoading" class="py-6 text-center">
            <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" animationDuration=".5s" />
        </div>
        <template v-else-if="jobDetail">
            <div class="detail-section">
                <h5>基本信息</h5>
                <div class="detail-grid">
                    <div><span>任务 ID：</span>{{ jobDetail.job.id }}</div>
                    <div><span>状态：</span>
                        <Tag :value="jobDetail.job.status" :severity="jobStatusSeverity(jobDetail.job.status)" />
                    </div>
                    <div><span>节点：</span>{{ jobDetail.job.node?.name ?? '未分配' }}</div>
                    <div><span>优先级：</span>{{ jobDetail.job.priority }}</div>
                    <div><span>创建时间：</span>{{ formatDate(jobDetail.job.createdAt) }}</div>
                    <div><span>开始时间：</span>{{ formatDate(jobDetail.job.startedAt) }}</div>
                    <div><span>完成时间：</span>{{ formatDate(jobDetail.job.finishedAt) }}</div>
                </div>
            </div>

            <div class="detail-section">
                <h5>提交信息</h5>
                <div v-if="jobDetail.job.submission" class="detail-grid">
                    <div><span>提交 ID：</span>{{ jobDetail.job.submission.id }}</div>
                    <div><span>提交者：</span>{{ jobDetail.job.submission.user?.username ?? '-' }}</div>
                    <div><span>题目：</span>{{ jobDetail.job.submission.problem?.slug ?? '-' }}</div>
                    <div><span>语言：</span>{{ jobDetail.job.submission.language?.displayName ?? '-' }}</div>
                    <div><span>判题结果：</span>
                        <Tag :value="jobDetail.job.submission.verdict"
                            :severity="verdictSeverity(jobDetail.job.submission.verdict)" />
                    </div>
                    <div><span>得分：</span>{{ jobDetail.job.submission.score ?? '-' }}</div>
                    <div><span>耗时：</span>{{ jobDetail.job.submission.timeMs ?? '-' }} ms</div>
                    <div><span>内存：</span>{{ jobDetail.job.submission.memoryKb ?? '-' }} KB</div>
                </div>
                <div v-else class="text-surface-500 dark:text-surface-300 text-sm">缺少提交信息</div>
            </div>

            <div class="detail-section">
                <h5>测试结果</h5>
                <DataTable :value="jobDetail.tests" dataKey="id" :rows="5" :paginator="true" responsiveLayout="scroll">
                    <Column field="testcaseId" header="用例 ID" style="min-width: 6rem" />
                    <Column field="groupName" header="测试组" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag v-if="data.groupName" :value="data.groupName"
                                :severity="data.sampleGroup ? 'info' : 'secondary'" />
                            <span v-else>-</span>
                        </template>
                    </Column>
                    <Column header="顺序" field="orderIndex" style="min-width: 6rem" />
                    <Column header="判定" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="data.verdict" :severity="verdictSeverity(data.verdict)" />
                        </template>
                    </Column>
                    <Column header="耗时 (ms)" field="timeMs" style="min-width: 8rem" />
                    <Column header="内存 (KB)" field="memoryKb" style="min-width: 8rem" />
                    <Column header="得分" field="score" style="min-width: 6rem" />
                    <Column header="Message" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ data.message || '-' }}
                        </template>
                    </Column>
                </DataTable>
            </div>

            <div class="detail-section">
                <h5>日志与附件</h5>
                <div v-if="jobDetail.artifacts.length === 0" class="text-sm text-surface-500 dark:text-surface-300">
                    暂无附件
                </div>
                <div v-else class="artifact-list">
                    <div v-for="artifact in jobDetail.artifacts" :key="artifact.id" class="artifact-item">
                        <div class="flex justify-between items-center mb-2">
                            <div class="font-semibold">{{ artifact.kind }}</div>
                            <Tag :value="artifact.kind" :severity="selectedArtifactKind(artifact.kind)" />
                        </div>
                        <div class="text-sm text-surface-500 dark:text-surface-300 mb-1">
                            文件 ID：{{ artifact.fileId ?? '-' }} ｜ 大小：{{ artifact.sizeBytes ?? '-' }} bytes
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button label="复制路径" icon="pi pi-copy" size="small" outlined
                                @click="copyText(artifact.storageKey || '', '存储路径')" />
                            <Button label="复制哈希" icon="pi pi-clone" size="small" outlined
                                @click="copyText(artifact.sha256 || '', 'SHA256')" />
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </Dialog>

    <SensitiveActionDialog ref="sensitiveDialogRef" />
</template>

<style scoped>
.node-card {
    border: 1px solid var(--surface-border);
    border-radius: 12px;
    padding: 1.25rem;
    height: 100%;
}

.metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.metric-label {
    display: block;
    font-size: 0.875rem;
    color: var(--text-color-secondary);
}

.metric-value {
    font-size: 1.25rem;
    font-weight: 600;
}

.runtime-list {
    border-top: 1px dashed var(--surface-border);
    padding-top: 0.75rem;
    font-size: 0.875rem;
    color: var(--text-color-secondary);
}

.runtime-item+.runtime-item {
    margin-top: 0.25rem;
}

.detail-section {
    margin-bottom: 1.5rem;
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.5rem 1rem;
    font-size: 0.95rem;
}

.detail-grid span {
    color: var(--text-color-secondary);
    margin-right: 0.5rem;
}

.artifact-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
}

.artifact-item {
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    padding: 0.75rem;
}
</style>
