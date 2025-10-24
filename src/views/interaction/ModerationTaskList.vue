<script setup lang="ts">
import type { CommentDetail, ModerationTaskSummary } from '@/api/interaction/comments';
import {
    assignModerationTask,
    decideModerationTask,
    fetchModerationTask,
    fetchModerationTasks,
    takeModerationTask,
    type ModerationAssignPayload,
    type ModerationDecisionPayload,
    type ModerationTaskDetail,
    type ModerationTaskQuery
} from '@/api/interaction/moderation';
import { NDescriptions, NDescriptionsItem, NSpin } from 'naive-ui';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

type DecisionOption = { label: string; value: ModerationDecisionPayload['decision'] };

type StatusOption = { label: string; value: string };

type RiskOption = { label: string; value: string };

type SourceOption = { label: string; value: string };

const tasks = ref<ModerationTaskSummary[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const statusFilter = ref('');
const riskFilter = ref('');
const sourceFilter = ref('');
const reviewerFilter = ref<number | null>(null);

const expandedRows = ref<Record<number, boolean>>({});
const detailsCache = ref<Record<number, ModerationTaskDetail>>({});
const detailLoading = ref<Record<number, boolean>>({});
const assignDialogVisible = ref(false);
const decisionDialogVisible = ref(false);
const actionLoading = ref(false);

const currentDetail = ref<ModerationTaskDetail | null>(null);
const assignForm = ref<{ reviewerId: number | null; notes: string }>({ reviewerId: null, notes: '' });
const decisionForm = ref<{ decision: ModerationDecisionPayload['decision']; notes: string; moderationLevel: string }>(
    {
        decision: 'approve',
        notes: '',
        moderationLevel: ''
    }
);

const toast = useToast();

const statusOptions: StatusOption[] = [
    { label: '全部状态', value: '' },
    { label: '待审核', value: 'pending' },
    { label: '审核中', value: 'in_review' },
    { label: '已通过', value: 'approved' },
    { label: '已驳回', value: 'rejected' },
    { label: '已升级', value: 'escalated' }
];

const riskOptions: RiskOption[] = [
    { label: '全部风险', value: '' },
    { label: '低', value: 'low' },
    { label: '中', value: 'medium' },
    { label: '高', value: 'high' }
];

const sourceOptions: SourceOption[] = [
    { label: '全部来源', value: '' },
    { label: '自动触发', value: 'auto' },
    { label: '用户举报', value: 'user_report' },
    { label: '手动创建', value: 'manual' },
    { label: '升级复审', value: 'escalated' }
];

const decisionOptions: DecisionOption[] = [
    { label: '通过', value: 'approve' },
    { label: '驳回', value: 'reject' },
    { label: '升级', value: 'escalate' }
];

const paginationFirst = computed(() => (page.value - 1) * size.value);

onMounted(() => {
    loadTasks();
});

async function loadTasks() {
    loading.value = true;
    try {
        const params: ModerationTaskQuery = {
            page: page.value,
            size: size.value,
            status: statusFilter.value || undefined,
            riskLevel: riskFilter.value || undefined,
            source: sourceFilter.value || undefined,
            reviewerId: reviewerFilter.value ?? undefined
        };
        const data = await fetchModerationTasks(params);
        tasks.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (typeof data.page === 'number') {
            page.value = Math.max(1, Number(data.page));
        }
        if (typeof data.size === 'number' && Number(data.size) > 0) {
            size.value = Number(data.size);
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '加载审核任务失败', life: 4000 });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    page.value = 1;
    loadTasks();
}

function resetFilters() {
    statusFilter.value = '';
    riskFilter.value = '';
    sourceFilter.value = '';
    reviewerFilter.value = null;
    page.value = 1;
    loadTasks();
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadTasks();
}

async function onRowExpand(event: { data: ModerationTaskSummary }) {
    const taskId = event.data.id;
    if (detailsCache.value[taskId]) return;
    detailLoading.value[taskId] = true;
    try {
        const detail = await fetchModerationTask(taskId);
        detailsCache.value[taskId] = detail;
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '获取任务详情失败', life: 4000 });
        delete expandedRows.value[taskId];
    } finally {
        delete detailLoading.value[taskId];
    }
}

function onRowCollapse(_event: { data: ModerationTaskSummary }) {
    // 可选：清理缓存
}

function getTaskDetail(taskId: number): ModerationTaskDetail | null {
    return detailsCache.value[taskId] ?? null;
}

async function openDetail(task: ModerationTaskSummary) {
    expandedRows.value[task.id] = true;
    if (!detailsCache.value[task.id]) {
        detailLoading.value[task.id] = true;
        try {
            const detail = await fetchModerationTask(task.id);
            detailsCache.value[task.id] = detail;
        } catch (error) {
            toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '获取任务详情失败', life: 4000 });
        } finally {
            delete detailLoading.value[task.id];
        }
    }
}

async function takeTask(task: ModerationTaskSummary) {
    actionLoading.value = true;
    try {
        const detail = await takeModerationTask(task.id);
        detailsCache.value[task.id] = detail;
        toast.add({ severity: 'success', summary: '认领成功', detail: '任务已认领', life: 3000 });
        await loadTasks();
        expandedRows.value[task.id] = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: '操作失败', detail: (error as Error)?.message ?? '认领任务失败', life: 4000 });
    } finally {
        actionLoading.value = false;
    }
}

function openAssignDialog(task: ModerationTaskSummary) {
    assignDialogVisible.value = true;
    assignForm.value = { reviewerId: task.reviewerId ?? null, notes: '' };
    currentDetail.value = {
        task,
        comment: {
            id: task.entityId,
            entityType: task.entityType,
            entityId: task.entityId,
            userId: 0,
            parentId: null,
            status: task.status,
            visibility: 'public',
            contentMd: '',
            contentRendered: '',
            sensitiveHits: [],
            sensitiveFlag: false,
            moderationLevel: task.riskLevel,
            moderationNotes: task.notes ?? '',
            lastModeratedBy: task.reviewerId ?? undefined,
            lastModeratedAt: task.reviewedAt ?? undefined,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            reactionStats: {},
            contentPreview: '',
            moderationTask: task
        },
        actions: []
    } as ModerationTaskDetail;
}

async function submitAssign(taskId: number) {
    const payload: ModerationAssignPayload = {
        reviewerId: assignForm.value.reviewerId ?? undefined,
        notes: assignForm.value.notes?.trim() || undefined
    };
    actionLoading.value = true;
    try {
        const detail = await assignModerationTask(taskId, payload);
        detailsCache.value[taskId] = detail;
        toast.add({ severity: 'success', summary: '指派成功', detail: '任务已指派', life: 3000 });
        assignDialogVisible.value = false;
        await loadTasks();
    } catch (error) {
        toast.add({ severity: 'error', summary: '操作失败', detail: (error as Error)?.message ?? '指派任务失败', life: 4000 });
    } finally {
        actionLoading.value = false;
    }
}

async function openDecisionDialog(task: ModerationTaskSummary) {
    decisionDialogVisible.value = true;
    actionLoading.value = true;
    try {
        const detail = await fetchModerationTask(task.id);
        currentDetail.value = detail;
        decisionForm.value = { decision: 'approve', notes: '', moderationLevel: detail.task.riskLevel ?? '' };
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '获取任务详情失败', life: 4000 });
        decisionDialogVisible.value = false;
    } finally {
        actionLoading.value = false;
    }
}

async function submitDecision(taskId: number) {
    const payload: ModerationDecisionPayload = {
        decision: decisionForm.value.decision,
        notes: decisionForm.value.notes?.trim() || undefined,
        moderationLevel: decisionForm.value.moderationLevel?.trim() || undefined
    };
    actionLoading.value = true;
    try {
        const detail = await decideModerationTask(taskId, payload);
        detailsCache.value[taskId] = detail;
        toast.add({ severity: 'success', summary: '审核完成', detail: '审核结果已提交', life: 3000 });
        decisionDialogVisible.value = false;
        expandedRows.value[taskId] = true;
        await loadTasks();
    } catch (error) {
        toast.add({ severity: 'error', summary: '操作失败', detail: (error as Error)?.message ?? '提交审核结果失败', life: 4000 });
    } finally {
        actionLoading.value = false;
    }
}

function formatCommentPreview(comment: CommentDetail | undefined) {
    if (!comment?.contentMd) return '-';
    return comment.contentMd.length > 80 ? `${comment.contentMd.slice(0, 80)}...` : comment.contentMd;
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label"
                            optionValue="value" placeholder="任务状态" style="width: 10rem" />
                        <Dropdown v-model="riskFilter" :options="riskOptions" optionLabel="label" optionValue="value"
                            placeholder="风险等级" style="width: 10rem" />
                        <Dropdown v-model="sourceFilter" :options="sourceOptions" optionLabel="label"
                            optionValue="value" placeholder="来源" style="width: 10rem" />
                        <InputNumber v-model="reviewerFilter" placeholder="审核人ID" :min="1" inputId="reviewer-filter" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="resetFilters" />
                    </div>
                </div>

                <DataTable :value="tasks" :loading="loading" :paginator="true" :lazy="true" :rows="size"
                    :totalRecords="total" :rowsPerPageOptions="[10, 20, 50]" :first="paginationFirst" dataKey="id"
                    responsiveLayout="scroll" @page="onPageChange" @rowExpand="onRowExpand" @rowCollapse="onRowCollapse"
                    v-model:expandedRows="expandedRows">
                    <Column expander style="width: 3rem" />
                    <Column field="id" header="任务ID" sortable />
                    <Column field="status" header="状态" sortable />
                    <Column field="riskLevel" header="风险" sortable />
                    <Column field="priority" header="优先级" sortable />
                    <Column field="source" header="来源" sortable />
                    <Column field="reviewerId" header="审核人" sortable />
                    <Column field="entityType" header="实体类型" sortable />
                    <Column field="entityId" header="实体ID" sortable />
                    <Column field="createdAt" header="创建时间" sortable />
                    <Column field="updatedAt" header="更新时间" sortable />
                    <Column header="操作">
                        <template #body="slotProps">
                            <SplitButton label="审核" icon="pi pi-check" severity="info" size="small" :model="[
                                {
                                    label: '认领任务',
                                    icon: 'pi pi-user-plus',
                                    command: () => takeTask(slotProps.data)
                                },
                                {
                                    label: '指派任务',
                                    icon: 'pi pi-share-alt',
                                    command: () => openAssignDialog(slotProps.data)
                                },
                                {
                                    label: '查看详情',
                                    icon: 'pi pi-eye',
                                    command: () => openDetail(slotProps.data)
                                }
                            ]" @click="openDecisionDialog(slotProps.data)" />
                        </template>
                    </Column>

                    <!-- 全部用 Descriptions 展示 -->
                    <template #expansion="slotProps">
                        <div class="p-4 bg-surface-50 dark:bg-surface-900">
                            <template v-if="detailLoading[slotProps.data.id]">
                                <div class="flex justify-center items-center py-8">
                                    <NSpin size="medium" />
                                </div>
                            </template>

                            <template v-else-if="getTaskDetail(slotProps.data.id)">
                                <div class="flex flex-col gap-4">
                                    <!-- 任务状态 -->
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i
                                                    class="pi pi-info-circle mr-2"></i>任务状态</div>
                                        </template>
                                        <NDescriptionsItem label="任务ID">{{ getTaskDetail(slotProps.data.id)!.task.id }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="状态">{{ getTaskDetail(slotProps.data.id)!.task.status
                                        }}</NDescriptionsItem>
                                        <NDescriptionsItem label="风险等级">{{
                                            getTaskDetail(slotProps.data.id)!.task.riskLevel ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="优先级">{{
                                            getTaskDetail(slotProps.data.id)!.task.priority ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="来源">{{ getTaskDetail(slotProps.data.id)!.task.source
                                        }}</NDescriptionsItem>
                                        <NDescriptionsItem label="创建时间">{{
                                            getTaskDetail(slotProps.data.id)!.task.createdAt }}</NDescriptionsItem>
                                    </NDescriptions>

                                    <!-- 审核与实体信息 -->
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i class="pi pi-user mr-2"></i>审核与实体信息
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="审核人ID">{{
                                            getTaskDetail(slotProps.data.id)!.task.reviewerId ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="完成时间">{{
                                            getTaskDetail(slotProps.data.id)!.task.reviewedAt ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="实体类型">{{
                                            getTaskDetail(slotProps.data.id)!.task.entityType }}</NDescriptionsItem>
                                        <NDescriptionsItem label="实体ID">{{
                                            getTaskDetail(slotProps.data.id)!.task.entityId }}</NDescriptionsItem>
                                        <NDescriptionsItem label="更新时间" :span="2">{{
                                            getTaskDetail(slotProps.data.id)!.task.updatedAt }}</NDescriptionsItem>
                                        <NDescriptionsItem label="备注" :span="3">
                                            <div class="whitespace-pre-wrap">{{
                                                getTaskDetail(slotProps.data.id)!.task.notes || '无' }}</div>
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <!-- 评论内容 -->
                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i class="pi pi-comment mr-2"></i>评论内容
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="Markdown 原文">
                                            <pre
                                                class="whitespace-pre-wrap bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded p-3 text-sm max-h-60 overflow-auto">
            {{ getTaskDetail(slotProps.data.id)!.comment?.contentMd ?? '-' }}</pre>
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <!-- 审核记录 -->
                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i class="pi pi-history mr-2"></i>审核记录
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="记录列表">
                                            <template v-if="(getTaskDetail(slotProps.data.id)!.actions ?? []).length">
                                                <div class="flex flex-col gap-2">
                                                    <div v-for="(act, idx) in getTaskDetail(slotProps.data.id)!.actions"
                                                        :key="idx" class="text-sm">
                                                        <div class="font-medium">{{ act.createdAt }} · {{ act.action }}
                                                        </div>
                                                        <div class="text-500">操作人：{{ act.operatorId }}<span
                                                                v-if="act.remarks"> ｜ 备注：{{ act.remarks }}</span></div>
                                                    </div>
                                                </div>
                                            </template>
                                            <span v-else class="text-500">无</span>
                                        </NDescriptionsItem>
                                    </NDescriptions>
                                </div>
                            </template>
                        </div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="assignDialogVisible" modal header="指派任务" :style="{ width: '28rem' }">
        <div class="flex flex-column gap-3">
            <InputNumber v-model="assignForm.reviewerId" placeholder="审核人ID" :min="1" inputId="assign-reviewer" />
            <Textarea v-model="assignForm.notes" rows="4" placeholder="指派备注" autoResize />
            <div class="flex justify-end gap-2">
                <Button label="取消" severity="secondary" @click="assignDialogVisible = false" />
                <Button label="确认" icon="pi pi-check" :loading="actionLoading"
                    @click="currentDetail && submitAssign(currentDetail.task.id)" />
            </div>
        </div>
    </Dialog>

    <Dialog v-model:visible="decisionDialogVisible" modal header="审核决策" :style="{ width: '32rem' }">
        <div class="flex flex-column gap-3">
            <Dropdown v-model="decisionForm.decision" :options="decisionOptions" optionLabel="label" optionValue="value"
                placeholder="审核结果" />
            <InputText v-model="decisionForm.moderationLevel" placeholder="风险等级 (可选)" />
            <Textarea v-model="decisionForm.notes" rows="4" placeholder="审核备注" autoResize />
            <div class="flex justify-end gap-2">
                <Button label="取消" severity="secondary" @click="decisionDialogVisible = false" />
                <Button label="提交" icon="pi pi-send" :loading="actionLoading"
                    @click="currentDetail && submitDecision(currentDetail.task.id)" />
            </div>
        </div>
    </Dialog>
</template>
