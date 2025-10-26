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
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

// ---------- 基础 ----------
const toast = useToast();
const authStore = useAuthStore();
const sensitiveDialogRef = ref<SensitiveActionDialogExpose | null>(null);

async function requestSensitiveToken() {
    if (!sensitiveDialogRef.value) return null;
    return sensitiveDialogRef.value.requestToken();
}

// ---------- 公共工具 ----------
function formatDate(value?: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
}

function nodeStatusSeverity(status?: string | null) {
    switch (status) {
        case 'online': return 'success';
        case 'busy': return 'info';
        case 'draining': return 'warn';
        case 'offline': return 'danger';
        default: return 'secondary';
    }
}

function jobStatusSeverity(status?: string) {
    switch (status) {
        case 'queued': return 'info';
        case 'running': return 'warn';
        case 'finished': return 'success';
        case 'failed': return 'danger';
        case 'canceled': return 'secondary';
        default: return 'info';
    }
}

function verdictSeverity(verdict?: string | null) {
    switch (verdict) {
        case 'AC': return 'success';
        case 'PD': return 'info';
        case 'WA':
        case 'PE': return 'warn';
        case 'TLE':
        case 'MLE':
        case 'RE':
        case 'CE':
        case 'IE': return 'danger';
        default: return 'secondary';
    }
}

const selectedArtifactKind = (artifactKind: string) => {
    switch (artifactKind) {
        case 'compile_log': return 'info';
        case 'run_log':
        case 'stdout': return 'success';
        case 'stderr': return 'warn';
        case 'diff': return 'danger';
        default: return 'secondary';
    }
};

async function copyText(payload: string, label: string) {
    if (!payload) return;
    try {
        await navigator.clipboard.writeText(payload);
        toast.add({ severity: 'success', summary: '已复制', detail: `${label} 已复制到剪贴板`, life: 2000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: '复制失败', detail: (error as Error)?.message ?? '请手动复制内容', life: 3000 });
    }
}

// ---------- 节点（Tab 1） ----------
const nodeFilters = reactive({
    status: null as string | null,
    keyword: ''
});
const nodeLoading = ref(false);
const nodes = ref<JudgeNodeView[]>([]);
const nodeAutoRefresh = ref(false);
const nodeRefreshMs = ref(15000);
let nodeTimer: number | null = null;

const nodeFilterOptions = [
    { label: '全部状态', value: null },
    { label: '在线', value: 'online' },
    { label: '忙碌', value: 'busy' },
    { label: '下线', value: 'offline' },
    { label: '下线中', value: 'draining' }
];

function runtimeEntries(node: JudgeNodeView) {
    const info = node.runtimeInfo || {};
    return Object.entries(info)
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => `${key}: ${String(value)}`);
}

async function refreshNodes() {
    nodeLoading.value = true;
    try {
        nodes.value = (await fetchJudgeNodes({
            status: nodeFilters.status ?? undefined,
            keyword: nodeFilters.keyword.trim() || undefined
        })) ?? [];
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载节点失败', detail: (error as Error)?.message ?? '无法加载评测节点列表', life: 4000 });
    } finally {
        nodeLoading.value = false;
    }
}
function clearNodeFilters() {
    nodeFilters.status = null;
    nodeFilters.keyword = '';
    refreshNodes();
}
function setupNodeAutoRefresh() {
    if (nodeTimer) {
        window.clearInterval(nodeTimer);
        nodeTimer = null;
    }
    if (nodeAutoRefresh.value) {
        // @ts-expect-error setInterval typing
        nodeTimer = window.setInterval(refreshNodes, nodeRefreshMs.value);
    }
}
watch([() => nodeAutoRefresh.value, () => nodeRefreshMs.value], setupNodeAutoRefresh);

// 节点关键字防抖
let nodeDebounce: number | null = null;
watch(() => nodeFilters.keyword, () => {
    if (nodeDebounce) window.clearTimeout(nodeDebounce);
    // @ts-expect-error setTimeout typing
    nodeDebounce = window.setTimeout(refreshNodes, 400);
});

// ---------- 任务（Tab 2） ----------
const jobLoading = ref(false);
const jobs = ref<JudgeJobView[]>([]);
const jobTotal = ref(0);
const jobPage = ref(1);
const jobSize = ref(20);
const jobAutoRefresh = ref(false);
const jobRefreshMs = ref(15000);
let jobTimer: number | null = null;

const jobFilters = reactive({
    status: null as string | null,
    nodeId: null as number | null, // null=全部, -1=未分配, >0=节点
    submissionId: '',
    keyword: ''
});
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
    nodes.value.forEach(n => options.push({ label: n.name, value: n.id }));
    return options;
});

async function loadJobs(targetPage = jobPage.value) {
    jobLoading.value = true;
    try {
        const params: JudgeJobQuery = {
            page: targetPage,
            size: jobSize.value,
            status: jobFilters.status ?? undefined,
            keyword: jobFilters.keyword.trim() || undefined
        };
        if (jobFilters.nodeId === -1) {
            params.onlyUnassigned = true;
        } else if (jobFilters.nodeId && jobFilters.nodeId > 0) {
            params.nodeId = jobFilters.nodeId;
        }
        const sid = Number(jobFilters.submissionId.trim());
        if (!Number.isNaN(sid) && sid > 0) params.submissionId = sid;

        const response = await fetchJudgeJobs(params);
        jobs.value = response.items ?? [];
        jobTotal.value = response.total ?? 0;
        jobPage.value = response.page ?? targetPage;
        jobSize.value = response.size ?? jobSize.value;
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载任务失败', detail: (error as Error)?.message ?? '无法加载评测任务', life: 4000 });
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
    jobFilters.status = null;
    jobFilters.nodeId = null;
    jobFilters.keyword = '';
    jobFilters.submissionId = '';
    onSearchJobs();
}
// 任务关键字防抖
let jobDebounce: number | null = null;
watch(() => jobFilters.keyword, () => {
    if (jobDebounce) window.clearTimeout(jobDebounce);
    // @ts-expect-error
    jobDebounce = window.setTimeout(() => { jobPage.value = 1; loadJobs(1); }, 400);
});

function canRetry(job: JudgeJobView) {
    return job.status === 'failed' || job.status === 'canceled';
}

async function retryJob(job: JudgeJobView) {
    if (!canRetry(job)) return;
    const confirmed = window.confirm(`确定要重新调度任务 #${job.id} 吗？`);
    if (!confirmed) return;
    const sensitiveToken = await requestSensitiveToken();
    if (!sensitiveToken) return;

    try {
        await retryJudgeJob(job.id, sensitiveToken);
        toast.add({ severity: 'success', summary: '操作成功', detail: '任务已重新排队', life: 3000 });
        await loadJobs();
        await refreshNodes();
    } catch (error) {
        toast.add({ severity: 'error', summary: '操作失败', detail: (error as Error)?.message ?? '重试任务失败', life: 4000 });
    } finally {
        authStore.clearSensitiveToken();
    }
}

function setupJobAutoRefresh() {
    if (jobTimer) {
        window.clearInterval(jobTimer);
        jobTimer = null;
    }
    if (jobAutoRefresh.value) {
        // @ts-expect-error
        jobTimer = window.setInterval(() => loadJobs(jobPage.value), jobRefreshMs.value);
    }
}
watch([() => jobAutoRefresh.value, () => jobRefreshMs.value], setupJobAutoRefresh);

// 批量重试
const selectedJobs = ref<JudgeJobView[]>([]);
async function retrySelected() {
    const candidates = selectedJobs.value.filter(canRetry);
    if (candidates.length === 0) {
        toast.add({ severity: 'info', summary: '无可重试任务', detail: '请选择失败或已取消的任务', life: 2500 });
        return;
    }
    const confirmed = window.confirm(`确定批量重试 ${candidates.length} 个任务吗？`);
    if (!confirmed) return;

    const sensitiveToken = await requestSensitiveToken();
    if (!sensitiveToken) return;

    try {
        for (const job of candidates) {
            await retryJudgeJob(job.id, sensitiveToken);
        }
        toast.add({ severity: 'success', summary: '批量重试完成', detail: '选中任务已重新排队', life: 3000 });
        selectedJobs.value = [];
        await loadJobs();
        await refreshNodes();
    } catch (error) {
        toast.add({ severity: 'error', summary: '批量操作失败', detail: (error as Error)?.message ?? '请尝试逐个重试', life: 4000 });
    } finally {
        authStore.clearSensitiveToken();
    }
}

// ---------- 右侧详情（Sidebar） ----------
const detailVisible = ref(false);
const detailLoading = ref(false);
const jobDetail = ref<JudgeJobDetailView | null>(null);

async function openJobDetail(job: JudgeJobView) {
    detailVisible.value = true;
    detailLoading.value = true;
    try {
        jobDetail.value = await fetchJudgeJobDetail(job.id);
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '无法加载任务详情', life: 4000 });
        detailVisible.value = false;
    } finally {
        detailLoading.value = false;
    }
}

// ---------- 生命周期 ----------
onMounted(() => {
    refreshNodes();
    loadJobs();
    setupNodeAutoRefresh();
    setupJobAutoRefresh();
});
onBeforeUnmount(() => {
    if (nodeTimer) window.clearInterval(nodeTimer);
    if (jobTimer) window.clearInterval(jobTimer);
});
</script>

<template>
    <div class="p-4 space-y-4">
        <TabView>
            <!-- 节点 -->
            <TabPanel header="节点">
                <Toolbar class="rounded-2xl shadow-sm">
                    <template #start>
                        <div class="grid gap-3 grid-cols-1 md:grid-cols-3 w-full md:w-auto">
                            <Dropdown v-model="nodeFilters.status" :options="nodeFilterOptions" optionLabel="label"
                                optionValue="value" placeholder="节点状态" class="w-full" />
                            <InputText v-model="nodeFilters.keyword" placeholder="按名称搜索节点" />
                            <div class="flex items-center gap-3">
                                <ToggleButton v-model="nodeAutoRefresh" onLabel="自动刷新" offLabel="自动刷新"
                                    :onIcon="'pi pi-sync'" :offIcon="'pi pi-sync'" />
                                <InputNumber v-model="nodeRefreshMs" :min="5000" :step="5000" inputId="node-refresh"
                                    suffix=" ms" placeholder="刷新间隔" style="width: 10rem" />
                            </div>
                        </div>
                    </template>
                    <template #end>
                        <div class="flex gap-2 flex-wrap">
                            <Button label="刷新" icon="pi pi-sync" :loading="nodeLoading" @click="refreshNodes" />
                            <Button label="重置" icon="pi pi-times" severity="secondary" @click="clearNodeFilters" />
                        </div>
                    </template>
                </Toolbar>

                <div v-if="nodes.length === 0" class="py-6">
                    <Message severity="secondary" class="w-full">暂无节点记录</Message>
                </div>

                <DataView v-else :value="nodes" layout="grid" :rows="12" :paginator="false" class="mt-3">
                    <template #grid="slotProps">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div v-for="node in slotProps.items" :key="node.id" class="">
                                <Panel :header="node.name" toggleable class="rounded-2xl">
                                    <div class="flex items-center justify-between mb-3">
                                        <div class="text-sm text-surface-500 dark:text-surface-300">
                                            最后心跳：{{ formatDate(node.lastHeartbeat) }}
                                        </div>
                                        <Tag :value="node.status" :severity="nodeStatusSeverity(node.status)" />
                                    </div>

                                    <div class="grid grid-cols-4 gap-2 text-center mb-3">
                                        <div>
                                            <span class="block text-xs text-muted-color">排队</span>
                                            <span class="text-lg font-semibold">{{ node.metrics?.queuedJobs ?? 0
                                            }}</span>
                                        </div>
                                        <div>
                                            <span class="block text-xs text-muted-color">运行</span>
                                            <span class="text-lg font-semibold">{{ node.metrics?.runningJobs ?? 0
                                            }}</span>
                                        </div>
                                        <div>
                                            <span class="block text-xs text-red-500">失败</span>
                                            <span class="text-lg font-semibold">{{ node.metrics?.failedJobs ?? 0
                                            }}</span>
                                        </div>
                                        <div>
                                            <span class="block text-xs text-muted-color">1h 完成</span>
                                            <span class="text-lg font-semibold">{{ node.metrics?.finishedLastHour ?? 0
                                            }}</span>
                                        </div>
                                    </div>

                                    <Divider class="my-2" />
                                    <div v-if="runtimeEntries(node).length" class="space-y-1 text-sm text-muted-color">
                                        <div v-for="entry in runtimeEntries(node)" :key="entry"
                                            class="flex items-center gap-2">
                                            <i class="pi pi-info-circle"></i>
                                            <span>{{ entry }}</span>
                                        </div>
                                    </div>
                                    <div v-else class="text-sm text-muted-color">无运行时信息</div>
                                </Panel>
                            </div>
                        </div>
                    </template>
                </DataView>
            </TabPanel>

            <!-- 任务 -->
            <TabPanel header="任务">
                <Fieldset legend="筛选与控制" toggleable class="rounded-2xl">
                    <div class="flex flex-wrap items-end justify-between gap-3">
                        <div class="grid gap-3 grid-cols-1 md:grid-cols-3 lg:grid-cols-4 w-full">
                            <Dropdown v-model="jobFilters.status" :options="jobStatusOptions" optionLabel="label"
                                optionValue="value" placeholder="任务状态" class="w-full" />
                            <Dropdown v-model="jobFilters.nodeId" :options="jobNodeOptions" optionLabel="label"
                                optionValue="value" placeholder="所属节点" class="w-full" />
                            <InputText v-model="jobFilters.submissionId" placeholder="按提交 ID" />
                            <InputText v-model="jobFilters.keyword" placeholder="按用户或题目关键字"
                                @keyup.enter="onSearchJobs" />
                        </div>
                        <div class="flex items-center gap-3 flex-wrap">
                            <ToggleButton v-model="jobAutoRefresh" onLabel="自动刷新" offLabel="自动刷新" :onIcon="'pi pi-sync'"
                                :offIcon="'pi pi-sync'" />
                            <InputNumber v-model="jobRefreshMs" :min="5000" :step="5000" suffix=" ms" placeholder="刷新间隔"
                                style="width: 10rem" />
                            <Button label="查询" icon="pi pi-search" @click="onSearchJobs" />
                            <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearJobFilters" />
                            <Button label="批量重试" icon="pi pi-refresh" severity="warn"
                                :disabled="selectedJobs.length === 0 || !selectedJobs.some(canRetry)"
                                @click="retrySelected" />
                        </div>
                    </div>
                </Fieldset>

                <DataTable :value="jobs" dataKey="id" v-model:selection="selectedJobs" selectionMode="multiple"
                    :loading="jobLoading" responsiveLayout="scroll" :rows="jobSize" :paginator="true"
                    :totalRecords="jobTotal" :rowsPerPageOptions="[10, 20, 50]" :first="(jobPage - 1) * jobSize"
                    @page="onJobPage" class="mt-3 rounded-2xl">
                    <Column selectionMode="multiple" headerStyle="width:3rem" />

                    <Column field="id" header="任务 ID" style="min-width: 7rem" />
                    <Column field="submissionId" header="提交 ID" style="min-width: 7rem" />

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
            </TabPanel>
        </TabView>

        <!-- 右侧详情 -->
        <Sidebar v-model:visible="detailVisible" position="right" :dismissable="true" :modal="true"
            :showCloseIcon="true" style="width: 60vw" class="p-sidebar-lg">
            <template #header>
                <div class="flex items-center gap-2">
                    <i class="pi pi-list"></i>
                    <span>任务详情</span>
                </div>
            </template>

            <div v-if="detailLoading" class="py-6 text-center">
                <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" animationDuration=".5s" />
            </div>

            <template v-else-if="jobDetail">
                <Panel header="基本信息" toggleable class="rounded-2xl mb-4">
                    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div><span class="text-muted-color mr-2">任务 ID：</span>{{ jobDetail.job.id }}</div>
                        <div><span class="text-muted-color mr-2">状态：</span>
                            <Tag :value="jobDetail.job.status" :severity="jobStatusSeverity(jobDetail.job.status)" />
                        </div>
                        <div><span class="text-muted-color mr-2">节点：</span>{{ jobDetail.job.node?.name ?? '未分配' }}</div>
                        <div><span class="text-muted-color mr-2">优先级：</span>{{ jobDetail.job.priority }}</div>
                        <div><span class="text-muted-color mr-2">创建时间：</span>{{ formatDate(jobDetail.job.createdAt) }}
                        </div>
                        <div><span class="text-muted-color mr-2">开始时间：</span>{{ formatDate(jobDetail.job.startedAt) }}
                        </div>
                        <div><span class="text-muted-color mr-2">完成时间：</span>{{ formatDate(jobDetail.job.finishedAt) }}
                        </div>
                    </div>
                </Panel>

                <Panel header="提交信息" toggleable class="rounded-2xl mb-4">
                    <div v-if="jobDetail.job.submission" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        <div><span class="text-muted-color mr-2">提交 ID：</span>{{ jobDetail.job.submission.id }}</div>
                        <div><span class="text-muted-color mr-2">提交者：</span>{{ jobDetail.job.submission.user?.username
                            ?? '-' }}</div>
                        <div><span class="text-muted-color mr-2">题目：</span>{{ jobDetail.job.submission.problem?.slug ??
                            '-' }}</div>
                        <div><span class="text-muted-color mr-2">语言：</span>{{
                            jobDetail.job.submission.language?.displayName ?? '-' }}</div>
                        <div><span class="text-muted-color mr-2">判题结果：</span>
                            <Tag :value="jobDetail.job.submission.verdict"
                                :severity="verdictSeverity(jobDetail.job.submission.verdict)" />
                        </div>
                        <div><span class="text-muted-color mr-2">得分：</span>{{ jobDetail.job.submission.score ?? '-' }}
                        </div>
                        <div><span class="text-muted-color mr-2">耗时：</span>{{ jobDetail.job.submission.timeMs ?? '-' }}
                            ms</div>
                        <div><span class="text-muted-color mr-2">内存：</span>{{ jobDetail.job.submission.memoryKb ?? '-'
                        }} KB</div>
                    </div>
                    <div v-else class="text-muted-color text-sm">缺少提交信息</div>
                </Panel>

                <Panel header="测试结果" toggleable class="rounded-2xl mb-4">
                    <DataTable :value="jobDetail.tests" dataKey="id" :rows="5" :paginator="true"
                        responsiveLayout="scroll">
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
                </Panel>

                <Panel header="日志与附件" toggleable class="rounded-2xl">
                    <div v-if="jobDetail.artifacts.length === 0" class="text-sm text-muted-color">暂无附件</div>
                    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div v-for="artifact in jobDetail.artifacts" :key="artifact.id" class="border rounded-xl p-3">
                            <div class="flex justify-between items-center mb-2">
                                <div class="font-semibold">{{ artifact.kind }}</div>
                                <Tag :value="artifact.kind" :severity="selectedArtifactKind(artifact.kind)" />
                            </div>
                            <div class="text-sm text-muted-color mb-2">
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
                </Panel>
            </template>
        </Sidebar>

        <SensitiveActionDialog ref="sensitiveDialogRef" />
    </div>
</template>

<style scoped>
/* 尽量采用 PrimeVue + Tailwind；仅保留极少量样式钩子 */
.text-muted-color {
    color: var(--text-color-secondary);
}
</style>
