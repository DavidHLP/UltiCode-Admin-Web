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
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { NDescriptions, NDescriptionsItem, NSpin } from 'naive-ui';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type DecisionOption = { label: string; value: ModerationDecisionPayload['decision'] };
type StatusOption = { label: string; value: string };
type RiskOption = { label: string; value: string };
type SourceOption = { label: string; value: string };
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;

const tasks = ref<ModerationTaskSummary[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const filters = ref<FiltersState>(createEmptyFilters());
const expandedRows = ref<Record<number, boolean>>({});
const detailsCache = ref<Record<number, ModerationTaskDetail>>({});
const detailLoading = ref<Record<number, boolean>>({});

const assignDialogVisible = ref(false);
const decisionDialogVisible = ref(false);
const actionLoading = ref(false);

const currentDetail = ref<ModerationTaskDetail | null>(null);
const assignForm = ref<{ reviewerId: number | null; notes: string }>({ reviewerId: null, notes: '' });
const decisionForm = ref<{ decision: ModerationDecisionPayload['decision']; notes: string; moderationLevel: string }>({
    decision: 'approve',
    notes: '',
    moderationLevel: ''
});

const toast = useToast();

const statusOptions: StatusOption[] = [
    { label: '全部状态', value: '' },
    { label: '待审核', value: 'pending' },
    { label: '审核中', value: 'in_review' },
    { label: '已通过', value: 'approved' },
    { label: '已驳回', value: 'rejected' },
    { label: '已升级', value: 'escalated' }
];

const entityTypeOptions: SourceOption[] = [
    { label: '全部类型', value: '' },
    { label: '评论', value: 'comment' },
    { label: '讨论', value: 'discussion' },
    { label: '题目', value: 'problem' },
    { label: '比赛', value: 'contest' }
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

let abortController: AbortController | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let skipFilterWatch = false;

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
    await loadTasks();
});

onBeforeUnmount(() => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
});

function createEmptyFilters(): FiltersState {
    const textFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }]
    });
    const exactFilter = (): DataTableFilterMetaData => ({
        value: null,
        matchMode: FilterMatchMode.EQUALS
    });

    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        status: exactFilter(),
        entityType: exactFilter(),
        reviewerId: exactFilter(),
        riskLevel: exactFilter(),
        source: exactFilter(),
        keyword: textFilter()
    };
}

function isOperatorFilterMeta(meta: FilterValue | undefined): meta is DataTableOperatorFilterMetaData {
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

function buildQueryFromFilters(): ModerationTaskQuery {
    const query: ModerationTaskQuery = {
        page: page.value,
        size: size.value
    };

    const keywordFilter = resolveStringFilter('keyword');
    const globalFilter = resolveStringFilter('global');
    if (keywordFilter) {
        query.keyword = keywordFilter;
    } else if (globalFilter) {
        query.keyword = globalFilter;
    }

    const status = resolveStringFilter('status');
    if (status) {
        query.status = status;
    }
    const entityType = resolveStringFilter('entityType');
    if (entityType) {
        query.entityType = entityType;
    }
    const riskLevel = resolveStringFilter('riskLevel');
    if (riskLevel) {
        query.riskLevel = riskLevel;
    }
    const source = resolveStringFilter('source');
    if (source) {
        query.source = source;
    }
    const reviewerId = resolveNumberFilter('reviewerId');
    if (reviewerId !== undefined) {
        query.reviewerId = reviewerId;
    }

    return query;
}

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        expandedRows.value = {};
        loadTasks();
    }, 300);
}

async function loadTasks() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const params = buildQueryFromFilters();
        const data = await fetchModerationTasks(params, controller.signal);
        tasks.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (data.page !== undefined && Number(data.page) !== page.value) {
            page.value = Number(data.page);
        }
        if (data.size !== undefined && Number(data.size) !== size.value) {
            size.value = Number(data.size);
        }
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
            return;
        }
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载审核任务失败',
            life: 4000
        });
    } finally {
        if (abortController === controller) {
            loading.value = false;
            abortController = null;
        }
    }
}

async function clearFilters() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    skipFilterWatch = true;
    filters.value = createEmptyFilters();
    expandedRows.value = {};
    page.value = 1;
    try {
        await loadTasks();
    } finally {
        skipFilterWatch = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadTasks();
}

async function ensureTaskDetail(taskId: number, force = false): Promise<ModerationTaskDetail | null> {
    if (!force && detailsCache.value[taskId]) {
        return detailsCache.value[taskId];
    }
    detailLoading.value[taskId] = true;
    try {
        const detail = await fetchModerationTask(taskId);
        detailsCache.value[taskId] = detail;
        return detail;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '获取任务详情失败',
            life: 4000
        });
        return null;
    } finally {
        delete detailLoading.value[taskId];
    }
}

async function onRowExpand(event: { data: ModerationTaskSummary }) {
    await ensureTaskDetail(event.data.id);
}

function onRowCollapse(event: { data: ModerationTaskSummary }) {
    delete detailLoading.value[event.data.id];
}

function getTaskDetail(taskId: number): ModerationTaskDetail | null {
    return detailsCache.value[taskId] ?? null;
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
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '认领任务失败',
            life: 4000
        });
    } finally {
        actionLoading.value = false;
    }
}

async function openAssignDialog(task: ModerationTaskSummary) {
    const detail = await ensureTaskDetail(task.id);
    currentDetail.value =
            detail ??
            ({
                task,
                comment: {
                    id: task.entityId,
                    entityType: task.entityType,
                    entityId: task.entityId
                } as CommentDetail,
                actions: []
            } as ModerationTaskDetail);
    assignForm.value = { reviewerId: task.reviewerId ?? null, notes: '' };
    assignDialogVisible.value = true;
}

async function submitAssign() {
    if (!currentDetail.value) {
        return;
    }
    const payload: ModerationAssignPayload = {
        reviewerId: assignForm.value.reviewerId ?? undefined,
        notes: assignForm.value.notes?.trim() || undefined
    };
    actionLoading.value = true;
    try {
        const detail = await assignModerationTask(currentDetail.value.task.id, payload);
        detailsCache.value[detail.task.id] = detail;
        toast.add({ severity: 'success', summary: '操作成功', detail: '任务已指派', life: 3000 });
        assignDialogVisible.value = false;
        await loadTasks();
        expandedRows.value[detail.task.id] = true;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '指派任务失败',
            life: 4000
        });
    } finally {
        actionLoading.value = false;
    }
}

async function openDecisionDialog(task: ModerationTaskSummary) {
    const detail = await ensureTaskDetail(task.id);
    if (!detail) {
        return;
    }
    currentDetail.value = detail;
    decisionForm.value = {
        decision: 'approve',
        notes: '',
        moderationLevel: detail.comment.moderationLevel ?? ''
    };
    decisionDialogVisible.value = true;
}

async function submitDecision() {
    if (!currentDetail.value) {
        return;
    }
    const payload: ModerationDecisionPayload = {
        decision: decisionForm.value.decision,
        notes: decisionForm.value.notes?.trim() || undefined,
        moderationLevel: decisionForm.value.moderationLevel?.trim() || undefined
    };
    actionLoading.value = true;
    try {
        const detail = await decideModerationTask(currentDetail.value.task.id, payload);
        detailsCache.value[detail.task.id] = detail;
        toast.add({ severity: 'success', summary: '处理成功', detail: '审核结果已提交', life: 3000 });
        decisionDialogVisible.value = false;
        await loadTasks();
        expandedRows.value[detail.task.id] = true;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '处理失败',
            detail: (error as Error)?.message ?? '提交审核结果失败',
            life: 4000
        });
    } finally {
        actionLoading.value = false;
    }
}

function openDetail(task: ModerationTaskSummary) {
    expandedRows.value[task.id] = true;
    ensureTaskDetail(task.id);
}

function getRiskSeverity(level?: string | null) {
    switch (level) {
        case 'high':
            return 'danger';
        case 'medium':
            return 'warning';
        case 'low':
            return 'success';
        default:
            return 'info';
    }
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="tasks"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['entityType', 'source', 'riskLevel']"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :first="paginationFirst"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
                    v-model:expandedRows="expandedRows"
                    @page="onPageChange"
                    @rowExpand="onRowExpand"
                    @rowCollapse="onRowCollapse"
                    responsiveLayout="scroll"
                    showGridlines
                >
                    <template #header>
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <Button type="button" label="重置筛选" icon="pi pi-filter-slash" outlined @click="clearFilters" />
                                <IconField>
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText
                                        v-model="(filters['global'] as DataTableFilterMetaData).value"
                                        placeholder="搜索关键词 / 备注"
                                    />
                                </IconField>
                            </div>
                        </div>
                    </template>

                    <Column expander style="width: 3rem" />
                    <Column field="id" header="任务ID" style="min-width: 8rem" />
                    <Column field="entityType" header="实体类型" filterField="entityType" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="entityTypeOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部类型"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="entityId" header="实体ID" style="min-width: 8rem" />
                    <Column field="status" header="状态" filterField="status" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="statusOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部状态"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="riskLevel" header="风险" filterField="riskLevel" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag v-if="data.riskLevel" :value="data.riskLevel" :severity="getRiskSeverity(data.riskLevel)" />
                            <span v-else>-</span>
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="riskOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部风险"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="source" header="来源" filterField="source" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="sourceOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部来源"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="reviewerId" header="审核员" filterField="reviewerId" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" :min="1" placeholder="审核员ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="priority" header="优先级" style="min-width: 6rem" />
                    <Column field="createdAt" header="创建时间" sortable style="min-width: 12rem" />
                    <Column header="操作" style="min-width: 14rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="审核"
                                icon="pi pi-check-circle"
                                size="small"
                                :model="[
                                    {
                                        label: '指派',
                                        icon: 'pi pi-user-edit',
                                        command: () => openAssignDialog(data)
                                    },
                                    {
                                        label: '认领',
                                        icon: 'pi pi-user-plus',
                                        command: () => takeTask(data),
                                        disabled: actionLoading
                                    },
                                    {
                                        label: '查看详情',
                                        icon: 'pi pi-info-circle',
                                        command: () => openDetail(data)
                                    }
                                ]"
                                :disabled="actionLoading"
                                @click="openDecisionDialog(data)"
                            />
                        </template>
                    </Column>

                    <template #expansion="slotProps">
                        <div class="p-4 bg-surface-50 dark:bg-surface-900">
                            <template v-if="detailLoading[slotProps.data.id]">
                                <div class="flex justify-center items-center py-8">
                                    <NSpin size="medium" />
                                </div>
                            </template>
                            <template v-else-if="getTaskDetail(slotProps.data.id)">
                                <div class="flex flex-col gap-4">
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold">
                                                <i class="pi pi-info-circle mr-2" />任务信息
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="任务ID">
                                            {{ getTaskDetail(slotProps.data.id)!.task.id }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="状态">
                                            {{ getTaskDetail(slotProps.data.id)!.task.status }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="优先级">
                                            {{ getTaskDetail(slotProps.data.id)!.task.priority }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="来源">
                                            {{ getTaskDetail(slotProps.data.id)!.task.source }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="风险">
                                            {{ getTaskDetail(slotProps.data.id)!.task.riskLevel ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="审核员">
                                            {{ getTaskDetail(slotProps.data.id)!.task.reviewerId ?? '-' }}
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold">
                                                <i class="pi pi-comments mr-2" />关联评论
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="评论ID">
                                            {{ getTaskDetail(slotProps.data.id)!.comment.id }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="用户ID">
                                            {{ getTaskDetail(slotProps.data.id)!.comment.userId }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="实体类型">
                                            {{ getTaskDetail(slotProps.data.id)!.comment.entityType }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="状态">
                                            {{ getTaskDetail(slotProps.data.id)!.comment.status }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="风险等级">
                                            {{ getTaskDetail(slotProps.data.id)!.comment.moderationLevel ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="敏感标记">
                                            {{ getTaskDetail(slotProps.data.id)!.comment.sensitiveFlag ? '是' : '否' }}
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold">
                                                <i class="pi pi-history mr-2" />操作记录
                                            </div>
                                        </template>
                                        <NDescriptionsItem v-if="getTaskDetail(slotProps.data.id)!.actions?.length" label="">
                                            <ul class="list-none p-0 m-0 flex flex-col gap-2">
                                                <li v-for="action in getTaskDetail(slotProps.data.id)!.actions" :key="action.id" class="border rounded p-3 text-sm">
                                                    <div class="flex justify-between items-center mb-2">
                                                        <span class="font-medium">{{ action.action }}</span>
                                                        <span class="text-500">{{ action.createdAt }}</span>
                                                    </div>
                                                    <div class="text-500">
                                                        审核员：{{ action.operatorId ?? '-' }}<br />
                                                        备注：{{ action.remarks ?? '-' }}
                                                    </div>
                                                </li>
                                            </ul>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem v-else label="">
                                            <span class="text-500">暂无操作记录</span>
                                        </NDescriptionsItem>
                                    </NDescriptions>
                                </div>
                            </template>
                            <template v-else>
                                <div class="text-center py-6 text-500">
                                    <Button label="加载详情" icon="pi pi-download" @click="onRowExpand({ data: slotProps.data })" />
                                </div>
                            </template>
                        </div>
                    </template>

                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="assignDialogVisible" modal header="指派任务" :style="{ width: '28rem' }" @hide="actionLoading = false">
        <template v-if="currentDetail">
            <div class="flex flex-column gap-3">
                <InputNumber v-model="assignForm.reviewerId" :min="1" placeholder="审核员ID (可选)" class="w-full" />
                <Textarea v-model="assignForm.notes" placeholder="指派备注 (可选)" rows="4" autoResize />
                <div class="flex justify-end gap-2">
                    <Button label="取消" severity="secondary" @click="assignDialogVisible = false" />
                    <Button label="确认指派" icon="pi pi-save" :loading="actionLoading" @click="submitAssign" />
                </div>
            </div>
        </template>
        <template v-else>
            <div class="text-center py-6 text-500">请选择任务</div>
        </template>
    </Dialog>

    <Dialog v-model:visible="decisionDialogVisible" modal header="处理审核任务" :style="{ width: '32rem' }" @hide="actionLoading = false">
        <template v-if="currentDetail">
            <div class="flex flex-column gap-3">
                <Dropdown
                    v-model="decisionForm.decision"
                    :options="decisionOptions"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="选择处理结果"
                />
                <InputText v-model="decisionForm.moderationLevel" placeholder="风险等级 (可选)" />
                <Textarea v-model="decisionForm.notes" placeholder="处理备注 (可选)" rows="4" autoResize />
                <div class="flex justify-end gap-2 mt-2">
                    <Button label="取消" severity="secondary" @click="decisionDialogVisible = false" />
                    <Button label="提交" icon="pi pi-check" :loading="actionLoading" @click="submitDecision" />
                </div>
            </div>
        </template>
        <template v-else>
            <div class="text-center py-6 text-500">请选择任务</div>
        </template>
    </Dialog>
</template>
