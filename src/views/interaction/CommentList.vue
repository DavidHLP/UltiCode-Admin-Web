<script setup lang="ts">
import {
    CommentStatus,
    fetchComment,
    fetchComments,
    updateComment,
    updateCommentStatus,
    type CommentDetail,
    type CommentQuery,
    type CommentStatusPayload,
    type CommentSummary,
    type CommentUpdatePayload
} from '@/api/interaction/comments';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { NDescriptions, NDescriptionsItem, NSpin, NTag } from 'naive-ui';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type EditableVisibility = 'public' | 'private' | 'internal' | string;
type StatusOption = { label: string; value: CommentStatus | string };
type ModeOption = { label: string; value: string };
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | undefined;

const comments = ref<CommentSummary[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const filters = ref<FiltersState>(createEmptyFilters());
const expandedRows = ref<Record<number, boolean>>({});
const detailsCache = ref<Record<number, CommentDetail>>({});
const detailLoading = ref<Record<number, boolean>>({});
const statusDialogVisible = ref(false);
const editDialogVisible = ref(false);

const currentComment = ref<CommentDetail | null>(null);
const statusForm = ref<{ status: CommentStatus | string; moderationNotes: string; moderationLevel: string }>({
    status: CommentStatus.Pending,
    moderationNotes: '',
    moderationLevel: ''
});
const editForm = ref<{ contentMd: string; contentRendered: string; visibility: EditableVisibility }>({
    contentMd: '',
    contentRendered: '',
    visibility: 'public'
});

const toast = useToast();

const statusOptions: StatusOption[] = [
    { label: '待审核', value: CommentStatus.Pending },
    { label: '已通过', value: CommentStatus.Approved },
    { label: '已驳回', value: CommentStatus.Rejected },
    { label: '隐藏', value: CommentStatus.Hidden }
];

const entityTypeOptions: ModeOption[] = [
    { label: '全部类型', value: '' },
    { label: '题目', value: 'problem' },
    { label: '比赛', value: 'contest' },
    { label: '提交', value: 'submission' },
    { label: '评论', value: 'comment' },
    { label: '讨论', value: 'discussion' }
];

const levelOptions: ModeOption[] = [
    { label: '全部风险', value: '' },
    { label: '低', value: 'low' },
    { label: '中', value: 'medium' },
    { label: '高', value: 'high' }
];

const visibilityOptions: ModeOption[] = [
    { label: '公开', value: 'public' },
    { label: '私密', value: 'private' },
    { label: '内部', value: 'internal' }
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
    await loadComments();
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
        entityId: exactFilter(),
        userId: exactFilter(),
        sensitiveOnly: exactFilter(),
        moderationLevel: exactFilter(),
        moderationNotes: textFilter()
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

function buildQueryFromFilters(): CommentQuery {
    const query: CommentQuery = {
        page: page.value,
        size: size.value
    };

    const noteKeyword = resolveStringFilter('moderationNotes');
    const globalKeyword = resolveStringFilter('global');
    if (noteKeyword) {
        query.keyword = noteKeyword;
    } else if (globalKeyword) {
        query.keyword = globalKeyword;
    }

    const status = resolveStringFilter('status');
    if (status) {
        query.status = status;
    }
    const entityType = resolveStringFilter('entityType');
    if (entityType) {
        query.entityType = entityType;
    }
    const moderationLevel = resolveStringFilter('moderationLevel');
    if (moderationLevel) {
        query.moderationLevel = moderationLevel;
    }
    const entityId = resolveNumberFilter('entityId');
    if (entityId !== undefined) {
        query.entityId = entityId;
    }
    const userId = resolveNumberFilter('userId');
    if (userId !== undefined) {
        query.userId = userId;
    }
    const sensitiveOnly = resolveStringFilter('sensitiveOnly');
    if (sensitiveOnly === 'true') {
        query.sensitiveOnly = true;
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
        loadComments();
    }, 300);
}

async function loadComments() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const params = buildQueryFromFilters();
        const data = await fetchComments(params, controller.signal);
        comments.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载评论列表失败',
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
        await loadComments();
    } finally {
        skipFilterWatch = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadComments();
}

async function onRowExpand(event: { data: CommentSummary }) {
    const commentId = event.data.id;
    if (detailsCache.value[commentId] || detailLoading.value[commentId]) {
        return;
    }
    detailLoading.value[commentId] = true;
    try {
        const detail = await fetchComment(commentId);
        detailsCache.value[commentId] = detail;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '获取评论详情失败',
            life: 4000
        });
        delete expandedRows.value[commentId];
    } finally {
        delete detailLoading.value[commentId];
    }
}

function onRowCollapse(event: { data: CommentSummary }) {
    delete detailLoading.value[event.data.id];
}

function getCommentDetail(commentId: number): CommentDetail | null {
    return detailsCache.value[commentId] ?? null;
}

async function openStatusDialog(comment: CommentSummary) {
    statusDialogVisible.value = true;
    try {
        const detail = await fetchComment(comment.id);
        currentComment.value = detail;
        statusForm.value = {
            status: detail.status,
            moderationNotes: detail.moderationNotes ?? '',
            moderationLevel: detail.moderationLevel ?? ''
        };
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '获取评论详情失败',
            life: 4000
        });
        statusDialogVisible.value = false;
    }
}

async function submitStatus() {
    if (!currentComment.value) {
        return;
    }
    const payload: CommentStatusPayload = {
        status: statusForm.value.status,
        moderationNotes: statusForm.value.moderationNotes?.trim() || undefined,
        moderationLevel: statusForm.value.moderationLevel?.trim() || undefined
    };
    try {
        const detail = await updateCommentStatus(currentComment.value.id, payload);
        currentComment.value = detail;
        detailsCache.value[currentComment.value.id] = detail;
        toast.add({ severity: 'success', summary: '操作成功', detail: '评论状态已更新', life: 3000 });
        statusDialogVisible.value = false;
        await loadComments();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '更新失败',
            detail: (error as Error)?.message ?? '更新评论状态失败',
            life: 4000
        });
    }
}

async function openEditDialog(comment: CommentSummary) {
    editDialogVisible.value = true;
    try {
        const detail = await fetchComment(comment.id);
        currentComment.value = detail;
        editForm.value = {
            contentMd: detail.contentMd,
            contentRendered: detail.contentRendered ?? '',
            visibility: (detail.visibility as EditableVisibility) ?? 'public'
        };
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '获取评论详情失败',
            life: 4000
        });
        editDialogVisible.value = false;
    }
}

async function submitEdit() {
    if (!currentComment.value) {
        return;
    }
    const content = editForm.value.contentMd.trim();
    if (!content) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '评论内容不能为空', life: 4000 });
        return;
    }
    const payload: CommentUpdatePayload = {
        contentMd: content,
        contentRendered: editForm.value.contentRendered?.trim() || undefined,
        visibility: editForm.value.visibility || undefined
    };
    try {
        const detail = await updateComment(currentComment.value.id, payload);
        currentComment.value = detail;
        detailsCache.value[currentComment.value.id] = detail;
        toast.add({ severity: 'success', summary: '更新成功', detail: '评论内容已更新', life: 3000 });
        editDialogVisible.value = false;
        await loadComments();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '更新失败',
            detail: (error as Error)?.message ?? '更新评论内容失败',
            life: 4000
        });
    }
}

function copyCommentId(comment: CommentSummary) {
    const info = `评论ID: ${comment.id}, 用户: ${comment.userId}, 实体: ${comment.entityType}#${comment.entityId}`;
    navigator.clipboard
        .writeText(String(comment.id))
        .then(() => {
            toast.add({
                severity: 'success',
                summary: '复制成功',
                detail: info,
                life: 3000
            });
        })
        .catch(() => {
            toast.add({
                severity: 'error',
                summary: '复制失败',
                detail: '无法访问剪贴板',
                life: 3000
            });
        });
}

function getStatusLabel(status: CommentStatus | string | undefined | null) {
    if (!status) {
        return '-';
    }
    return statusOptions.find((o) => o.value === status)?.label ?? String(status);
}

function getLevelLabel(level: string | undefined | null) {
    if (!level) {
        return '-';
    }
    return levelOptions.find((o) => o.value === level)?.label ?? level;
}

function getVisibilityLabel(visibility: string | undefined | null) {
    if (!visibility) {
        return '-';
    }
    return visibilityOptions.find((o) => o.value === visibility)?.label ?? visibility;
}

function getStatusSeverity(status: CommentStatus | string | undefined | null): TagSeverity {
    switch (status) {
        case CommentStatus.Approved:
            return 'success';
        case CommentStatus.Pending:
            return 'warning';
        case CommentStatus.Rejected:
            return 'danger';
        case CommentStatus.Hidden:
            return 'info';
        default:
            return 'info';
    }
}

function getLevelSeverity(level: string | undefined | null): TagSeverity {
    switch (level) {
        case 'low':
            return 'success';
        case 'medium':
            return 'warning';
        case 'high':
            return 'danger';
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
                    :value="comments"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['contentPreview', 'entityType', 'moderationNotes', 'moderationLevel']"
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
                                        placeholder="搜索内容 / 备注"
                                    />
                                </IconField>
                            </div>
                        </div>
                    </template>

                    <Column expander style="width: 3rem" />
                    <Column field="id" header="评论ID" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="flex items-center gap-2">
                                <span>{{ data.id }}</span>
                                <Button icon="pi pi-copy" text rounded severity="secondary" @click="copyCommentId(data)" />
                            </div>
                        </template>
                    </Column>
                    <Column field="entityType" header="实体类型" filterField="entityType" :showFilterMatchModes="false" style="min-width: 9rem">
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
                    <Column field="entityId" header="实体ID" filterField="entityId" :showFilterMatchModes="false" style="min-width: 9rem">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" :min="1" placeholder="实体ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="userId" header="用户ID" filterField="userId" :showFilterMatchModes="false" style="min-width: 9rem">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" :min="1" placeholder="用户ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="status" header="状态" filterField="status" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="getStatusLabel(data.status)" :severity="getStatusSeverity(data.status)" />
                        </template>
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
                    <Column field="visibility" header="可见性" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ getVisibilityLabel(data.visibility) }}
                        </template>
                    </Column>
                    <Column field="moderationLevel" header="风险等级" filterField="moderationLevel" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #body="{ data }">
                            <template v-if="data.moderationLevel">
                                <Tag :value="getLevelLabel(data.moderationLevel)" :severity="getLevelSeverity(data.moderationLevel)" />
                            </template>
                            <span v-else>-</span>
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="levelOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部风险"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="sensitiveFlag" header="敏感" filterField="sensitiveOnly" :showFilterMatchModes="false" style="min-width: 7rem">
                        <template #body="{ data }">
                            <Tag :value="data.sensitiveFlag ? '敏感' : '正常'" :severity="data.sensitiveFlag ? 'danger' : 'success'" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="[
                                    { label: '全部', value: null },
                                    { label: '仅敏感', value: 'true' }
                                ]"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="筛选敏感"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="contentPreview" header="内容预览" filterField="moderationNotes" :showFilterMatchModes="false" style="min-width: 18rem">
                        <template #body="{ data }">
                            <span class="block text-overflow-ellipsis whitespace-nowrap" style="max-width: 18rem">
                                {{ data.contentPreview ?? '-' }}
                            </span>
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="模糊搜索内容/备注" class="w-full" />
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" sortable style="min-width: 12rem" />
                    <Column header="操作" style="min-width: 12rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="审核"
                                icon="pi pi-shield-check"
                                size="small"
                                :model="[
                                    {
                                        label: '编辑内容',
                                        icon: 'pi pi-pencil',
                                        command: () => openEditDialog(data)
                                    },
                                    {
                                        label: '复制ID',
                                        icon: 'pi pi-copy',
                                        command: () => copyCommentId(data)
                                    }
                                ]"
                                @click="openStatusDialog(data)"
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
                            <template v-else-if="getCommentDetail(slotProps.data.id)">
                                <div class="flex flex-col gap-4">
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold">
                                                <i class="pi pi-info-circle mr-2" />概览
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="状态">
                                            <Tag
                                                :value="getStatusLabel(getCommentDetail(slotProps.data.id)!.status)"
                                                :severity="getStatusSeverity(getCommentDetail(slotProps.data.id)!.status)"
                                            />
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="风险等级">
                                            <template v-if="getCommentDetail(slotProps.data.id)!.moderationLevel">
                                                <Tag
                                                    :value="getLevelLabel(getCommentDetail(slotProps.data.id)!.moderationLevel)"
                                                    :severity="getLevelSeverity(getCommentDetail(slotProps.data.id)!.moderationLevel)"
                                                />
                                            </template>
                                            <span v-else>-</span>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="敏感">
                                            <Tag
                                                :value="getCommentDetail(slotProps.data.id)!.sensitiveFlag ? '敏感评论' : '普通评论'"
                                                :severity="getCommentDetail(slotProps.data.id)!.sensitiveFlag ? 'danger' : 'success'"
                                            />
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="可见性">
                                            {{ getVisibilityLabel(getCommentDetail(slotProps.data.id)!.visibility) }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="最后处理人">
                                            {{ getCommentDetail(slotProps.data.id)!.lastModeratedBy ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="处理时间">
                                            {{ getCommentDetail(slotProps.data.id)!.lastModeratedAt ?? '-' }}
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold">
                                                <i class="pi pi-file-edit mr-2" />评论内容
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="Markdown 原文">
                                            <pre class="whitespace-pre-wrap border rounded p-3 text-sm max-h-60 overflow-auto">
{{ getCommentDetail(slotProps.data.id)!.contentMd }}
</pre>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="渲染预览">
                                            <template v-if="getCommentDetail(slotProps.data.id)!.contentRendered">
                                                <div
                                                    class="border rounded p-3 text-sm max-h-60 overflow-auto bg-surface-50 dark:bg-surface-900"
                                                    v-html="getCommentDetail(slotProps.data.id)!.contentRendered"
                                                />
                                            </template>
                                            <span v-else class="text-500">无</span>
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold">
                                                <i class="pi pi-database mr-2" />主体信息
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="评论 ID">
                                            {{ getCommentDetail(slotProps.data.id)!.id }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="用户 ID">
                                            {{ getCommentDetail(slotProps.data.id)!.userId }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="父评论">
                                            {{ getCommentDetail(slotProps.data.id)!.parentId ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="实体类型">
                                            {{ getCommentDetail(slotProps.data.id)!.entityType }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="实体 ID">
                                            {{ getCommentDetail(slotProps.data.id)!.entityId }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="创建时间">
                                            {{ getCommentDetail(slotProps.data.id)!.createdAt }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="更新时间">
                                            {{ getCommentDetail(slotProps.data.id)!.updatedAt }}
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold">
                                                <i class="pi pi-shield mr-2" />敏感命中
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="命中词">
                                            <div v-if="getCommentDetail(slotProps.data.id)!.sensitiveHits?.length" class="flex flex-wrap gap-2">
                                                <Tag
                                                    v-for="hit in getCommentDetail(slotProps.data.id)!.sensitiveHits"
                                                    :key="hit"
                                                    :value="hit"
                                                    severity="danger"
                                                />
                                            </div>
                                            <span v-else>无</span>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="审核备注">
                                            <div class="whitespace-pre-wrap">
                                                {{ getCommentDetail(slotProps.data.id)!.moderationNotes ?? '-' }}
                                            </div>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="互动统计">
                                            <div
                                                v-if="getCommentDetail(slotProps.data.id)!.reactionStats && Object.keys(getCommentDetail(slotProps.data.id)!.reactionStats).length"
                                                class="flex flex-wrap gap-2"
                                            >
                                                <NTag
                                                    v-for="[reaction, count] in Object.entries(getCommentDetail(slotProps.data.id)!.reactionStats ?? {})"
                                                    :key="reaction"
                                                    type="info"
                                                    size="small"
                                                >
                                                    {{ reaction }}：{{ count }}
                                                </NTag>
                                            </div>
                                            <span v-else class="text-500">无互动反应</span>
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

    <Dialog v-model:visible="statusDialogVisible" modal header="审核评论" :style="{ width: '32rem' }">
        <template v-if="currentComment">
            <div class="flex flex-column gap-3">
                <Dropdown v-model="statusForm.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="选择状态" />
                <Dropdown v-model="statusForm.moderationLevel" :options="levelOptions" optionLabel="label" optionValue="value" placeholder="风险等级" />
                <Textarea v-model="statusForm.moderationNotes" placeholder="备注" rows="4" autoResize />
                <div class="flex justify-end gap-2 mt-3">
                    <Button label="取消" severity="secondary" @click="statusDialogVisible = false" />
                    <Button label="提交" icon="pi pi-check" @click="submitStatus" />
                </div>
            </div>
        </template>
        <template v-else>
            <div class="text-center py-6 text-500">请选择评论</div>
        </template>
    </Dialog>

    <Dialog v-model:visible="editDialogVisible" modal header="编辑评论" :style="{ width: '50vw' }">
        <template v-if="currentComment">
            <div class="flex flex-column gap-3">
                <Dropdown v-model="editForm.visibility" :options="visibilityOptions" optionLabel="label" optionValue="value" placeholder="可见性" />
                <Textarea v-model="editForm.contentMd" placeholder="评论内容 (Markdown)" rows="8" autoResize />
                <Textarea v-model="editForm.contentRendered" placeholder="渲染内容 (可选)" rows="4" autoResize />
                <div class="flex justify-end gap-2 mt-3">
                    <Button label="取消" severity="secondary" @click="editDialogVisible = false" />
                    <Button label="保存" icon="pi pi-save" @click="submitEdit" />
                </div>
            </div>
        </template>
        <template v-else>
            <div class="text-center py-6 text-500">请选择评论</div>
        </template>
    </Dialog>
</template>
