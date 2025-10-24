<script setup lang="ts">
import type { CommentDetail, CommentQuery, CommentStatusPayload, CommentSummary, CommentUpdatePayload } from '@/api/interaction/comments';
import { CommentStatus, fetchComment, fetchComments, updateComment, updateCommentStatus } from '@/api/interaction/comments';
import { NDescriptions, NDescriptionsItem, NSpin, NTag } from 'naive-ui';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

type EditableVisibility = 'public' | 'private' | 'internal' | string;

type StatusOption = { label: string; value: CommentStatus | string };

type ModeOption = { label: string; value: string };

const comments = ref<CommentSummary[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const statusFilter = ref<string>('');
const entityTypeFilter = ref<string>('');
const keyword = ref('');
const sensitiveOnly = ref(false);
const moderationLevelFilter = ref('');
const entityIdFilter = ref<number | null>(null);
const userIdFilter = ref<number | null>(null);

const expandedRows = ref<Record<number, boolean>>({});
const detailsCache = ref<Record<number, CommentDetail>>({});
const statusDialogVisible = ref(false);
const editDialogVisible = ref(false);
const detailLoading = ref<Record<number, boolean>>({});

const currentComment = ref<CommentDetail | null>(null);
const statusForm = ref<{
    status: CommentStatus | string;
    moderationNotes: string;
    moderationLevel: string;
}>({
    status: CommentStatus.Pending,
    moderationNotes: '',
    moderationLevel: ''
});

const editForm = ref<{
    contentMd: string;
    contentRendered: string;
    visibility: EditableVisibility;
}>({
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

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | undefined;

function getStatusLabel(status: CommentStatus | string | undefined | null) {
    if (!status) return '-';
    return statusOptions.find((o) => o.value === status)?.label ?? String(status);
}

function getLevelLabel(level: string | undefined | null) {
    if (!level) return '-';
    return levelOptions.find((o) => o.value === level)?.label ?? level;
}

function getVisibilityLabel(visibility: string | undefined | null) {
    if (!visibility) return '-';
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

onMounted(() => {
    loadComments();
});

async function loadComments() {
    loading.value = true;
    try {
        const params: CommentQuery = {
            page: page.value,
            size: size.value,
            status: statusFilter.value || undefined,
            entityType: entityTypeFilter.value || undefined,
            entityId: entityIdFilter.value ?? undefined,
            userId: userIdFilter.value ?? undefined,
            sensitiveOnly: sensitiveOnly.value || undefined,
            keyword: keyword.value?.trim() || undefined,
            moderationLevel: moderationLevelFilter.value || undefined
        };
        const data = await fetchComments(params);
        comments.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (typeof data.page === 'number') page.value = Math.max(1, Number(data.page));
        if (typeof data.size === 'number' && Number(data.size) > 0) size.value = Number(data.size);
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '加载评论列表失败', life: 4000 });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    page.value = 1;
    loadComments();
}

function resetFilters() {
    statusFilter.value = '';
    entityTypeFilter.value = '';
    moderationLevelFilter.value = '';
    keyword.value = '';
    sensitiveOnly.value = false;
    entityIdFilter.value = null;
    userIdFilter.value = null;
    page.value = 1;
    loadComments();
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadComments();
}

async function onRowExpand(event: { data: CommentSummary }) {
    const commentId = event.data.id;
    if (detailsCache.value[commentId]) return;
    detailLoading.value[commentId] = true;
    try {
        const detail = await fetchComment(commentId);
        detailsCache.value[commentId] = detail;
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '获取评论详情失败', life: 4000 });
        delete expandedRows.value[commentId];
    } finally {
        delete detailLoading.value[commentId];
    }
}

function onRowCollapse(event: { data: CommentSummary }) {
    // 可按需清理缓存
}

async function toggleDetail(comment: CommentSummary) {
    const commentId = comment.id;
    if (expandedRows.value[commentId]) {
        delete expandedRows.value[commentId];
        return;
    }
    if (detailsCache.value[commentId]) {
        expandedRows.value[commentId] = true;
        return;
    }
    detailLoading.value[commentId] = true;
    try {
        const detail = await fetchComment(commentId);
        detailsCache.value[commentId] = detail;
        expandedRows.value[commentId] = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '获取评论详情失败', life: 4000 });
    } finally {
        delete detailLoading.value[commentId];
    }
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
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '获取评论详情失败', life: 4000 });
        statusDialogVisible.value = false;
    }
}

async function submitStatus() {
    if (!currentComment.value) return;
    const payload: CommentStatusPayload = {
        status: statusForm.value.status,
        moderationNotes: statusForm.value.moderationNotes?.trim() || undefined,
        moderationLevel: statusForm.value.moderationLevel?.trim() || undefined
    };
    try {
        const detail = await updateCommentStatus(currentComment.value.id, payload);
        currentComment.value = detail;
        if (detailsCache.value[currentComment.value.id]) detailsCache.value[currentComment.value.id] = detail;
        toast.add({ severity: 'success', summary: '操作成功', detail: '评论状态已更新', life: 3000 });
        statusDialogVisible.value = false;
        await loadComments();
    } catch (error) {
        toast.add({ severity: 'error', summary: '更新失败', detail: (error as Error)?.message ?? '更新评论状态失败', life: 4000 });
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
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '获取评论详情失败', life: 4000 });
        editDialogVisible.value = false;
    }
}

async function submitEdit() {
    if (!currentComment.value) return;
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
        if (detailsCache.value[currentComment.value.id]) detailsCache.value[currentComment.value.id] = detail;
        toast.add({ severity: 'success', summary: '更新成功', detail: '评论内容已更新', life: 3000 });
        editDialogVisible.value = false;
        await loadComments();
    } catch (error) {
        toast.add({ severity: 'error', summary: '更新失败', detail: (error as Error)?.message ?? '更新评论内容失败', life: 4000 });
    }
}

function copyCommentId(comment: CommentSummary) {
    const info = `评论ID: ${comment.id}, 用户: ${comment.userId}, 实体: ${comment.entityType}#${comment.entityId}`;
    navigator.clipboard.writeText(String(comment.id)).then(() => {
        toast.add({
            severity: 'success',
            summary: '复制成功',
            detail: info,
            life: 3000
        });
    }).catch(() => {
        toast.add({
            severity: 'error',
            summary: '复制失败',
            detail: '无法访问剪贴板',
            life: 3000
        });
    });
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputText v-model="keyword" placeholder="搜索内容或备注" style="min-width: 16rem"
                            @keyup.enter="onSearch" />
                        <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label"
                            optionValue="value" placeholder="审核状态" style="width: 10rem" />
                        <Dropdown v-model="entityTypeFilter" :options="entityTypeOptions" optionLabel="label"
                            optionValue="value" placeholder="实体类型" style="width: 10rem" />
                        <Dropdown v-model="moderationLevelFilter" :options="levelOptions" optionLabel="label"
                            optionValue="value" placeholder="风险等级" style="width: 10rem" />
                        <InputNumber v-model="entityIdFilter" placeholder="实体ID" :min="1" inputId="entity-id-filter" />
                        <InputNumber v-model="userIdFilter" placeholder="用户ID" :min="1" inputId="user-id-filter" />
                        <div class="flex items-center gap-2">
                            <Checkbox v-model="sensitiveOnly" inputId="sensitiveOnly" binary />
                            <label for="sensitiveOnly">仅敏感</label>
                        </div>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="resetFilters" />
                    </div>
                </div>

                <DataTable :value="comments" :loading="loading" :rows="size" :lazy="true" :paginator="true"
                    :totalRecords="total" dataKey="id" :rowsPerPageOptions="[10, 20, 50]" :first="paginationFirst"
                    responsiveLayout="scroll" @page="onPageChange" @rowExpand="onRowExpand" @rowCollapse="onRowCollapse"
                    v-model:expandedRows="expandedRows">
                    <Column expander style="width: 3rem" />
                    <Column field="id" header="ID" sortable />
                    <Column field="entityType" header="类型" sortable />
                    <Column field="entityId" header="实体ID" sortable />
                    <Column field="userId" header="用户ID" sortable />
                    <Column field="status" header="状态" sortable>
                        <template #body="slotProps">
                            <Tag :value="getStatusLabel(slotProps.data.status)"
                                :severity="getStatusSeverity(slotProps.data.status)" />
                        </template>
                    </Column>
                    <Column field="moderationLevel" header="风险" sortable>
                        <template #body="slotProps">
                            <Tag v-if="slotProps.data.moderationLevel"
                                :value="getLevelLabel(slotProps.data.moderationLevel)"
                                :severity="getLevelSeverity(slotProps.data.moderationLevel)" />
                            <span v-else>-</span>
                        </template>
                    </Column>
                    <Column field="sensitiveFlag" header="敏感">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.sensitiveFlag ? '是' : '否'"
                                :severity="slotProps.data.sensitiveFlag ? 'danger' : 'success'" />
                        </template>
                    </Column>
                    <Column field="contentPreview" header="内容预览" :style="{ maxWidth: '18rem' }">
                        <template #body="slotProps">
                            <span class="whitespace-nowrap text-overflow-ellipsis overflow-hidden block"
                                style="max-width: 18rem">{{ slotProps.data.contentPreview }}</span>
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" sortable />
                    <Column field="updatedAt" header="更新时间" sortable />
                    <Column header="操作">
                        <template #body="slotProps">
                            <SplitButton label="审核" icon="pi pi-check" severity="info" size="small" :model="[
                                {
                                    label: '编辑内容',
                                    icon: 'pi pi-pencil',
                                    command: () => openEditDialog(slotProps.data)
                                },
                                {
                                    label: expandedRows[slotProps.data.id] ? '收起详情' : '展开详情',
                                    icon: expandedRows[slotProps.data.id] ? 'pi pi-chevron-up' : 'pi pi-chevron-down',
                                    command: () => toggleDetail(slotProps.data)
                                },
                                {
                                    label: '复制ID',
                                    icon: 'pi pi-copy',
                                    command: () => copyCommentId(slotProps.data)
                                }
                            ]" @click="openStatusDialog(slotProps.data)" />
                        </template>
                    </Column>

                    <!-- 使用 Descriptions 重构展开内容 -->
                    <template #expansion="slotProps">
                        <div class="p-4 bg-surface-50 dark:bg-surface-900">
                            <template v-if="detailLoading[slotProps.data.id]">
                                <div class="flex justify-center items-center py-8">
                                    <NSpin size="medium" />
                                </div>
                            </template>

                            <template v-else-if="getCommentDetail(slotProps.data.id)">
                                <div class="flex flex-col gap-4">
                                    <!-- 概览 -->
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i class="pi pi-info-circle mr-2"></i>概览
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="状态">
                                            <Tag :value="getStatusLabel(getCommentDetail(slotProps.data.id)!.status)"
                                                :severity="getStatusSeverity(getCommentDetail(slotProps.data.id)!.status)" />
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="风险等级">
                                            <template v-if="getCommentDetail(slotProps.data.id)!.moderationLevel">
                                                <Tag :value="getLevelLabel(getCommentDetail(slotProps.data.id)!.moderationLevel)"
                                                    :severity="getLevelSeverity(getCommentDetail(slotProps.data.id)!.moderationLevel)" />
                                            </template>
                                            <span v-else>-</span>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="敏感">
                                            <Tag :value="getCommentDetail(slotProps.data.id)!.sensitiveFlag ? '敏感评论' : '普通评论'"
                                                :severity="getCommentDetail(slotProps.data.id)!.sensitiveFlag ? 'danger' : 'success'" />
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="可见性">
                                            {{ getVisibilityLabel(getCommentDetail(slotProps.data.id)!.visibility) }}
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <!-- 评论内容 -->
                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i class="pi pi-file-edit mr-2"></i>评论内容
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="Markdown 原文">
                                            <pre
                                                class="whitespace-pre-wrap bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded p-3 text-sm max-h-60 overflow-auto">
            {{ getCommentDetail(slotProps.data.id)!.contentMd }}</pre>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="渲染预览">
                                            <template v-if="getCommentDetail(slotProps.data.id)!.contentRendered">
                                                <div class="border border-surface-200 dark:border-surface-700 rounded p-3 text-sm max-h-60 overflow-auto bg-surface-50 dark:bg-surface-900"
                                                    v-html="getCommentDetail(slotProps.data.id)!.contentRendered"></div>
                                            </template>
                                            <span v-else class="text-500">无</span>
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <!-- 主体信息 -->
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i class="pi pi-database mr-2"></i>主体信息
                                            </div>
                                        </template>
                                        <NDescriptionsItem label="评论 ID">{{ getCommentDetail(slotProps.data.id)!.id }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="用户 ID">{{ getCommentDetail(slotProps.data.id)!.userId
                                            ?? '-' }}</NDescriptionsItem>
                                        <NDescriptionsItem label="实体">{{ getCommentDetail(slotProps.data.id)!.entityType
                                        }} #{{
                                                getCommentDetail(slotProps.data.id)!.entityId }}</NDescriptionsItem>
                                        <NDescriptionsItem label="可见性">{{
                                            getVisibilityLabel(getCommentDetail(slotProps.data.id)!.visibility) }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="创建时间">{{
                                            getCommentDetail(slotProps.data.id)!.createdAt ?? '-' }}</NDescriptionsItem>
                                        <NDescriptionsItem label="更新时间">{{
                                            getCommentDetail(slotProps.data.id)!.updatedAt ?? '-' }}</NDescriptionsItem>
                                    </NDescriptions>

                                    <!-- 审核信息 -->
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i
                                                    class="pi pi-check-circle mr-2"></i>审核信息</div>
                                        </template>
                                        <NDescriptionsItem label="状态">
                                            <Tag :value="getStatusLabel(getCommentDetail(slotProps.data.id)!.status)"
                                                :severity="getStatusSeverity(getCommentDetail(slotProps.data.id)!.status)" />
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="风险等级">
                                            <template v-if="getCommentDetail(slotProps.data.id)!.moderationLevel">
                                                <Tag :value="getLevelLabel(getCommentDetail(slotProps.data.id)!.moderationLevel)"
                                                    :severity="getLevelSeverity(getCommentDetail(slotProps.data.id)!.moderationLevel)" />
                                            </template>
                                            <span v-else>-</span>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="最后审核人">{{
                                            getCommentDetail(slotProps.data.id)!.lastModeratedBy ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="审核时间" :span="2">{{
                                            getCommentDetail(slotProps.data.id)!.lastModeratedAt ?? '-' }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="备注" :span="3">
                                            <div class="whitespace-pre-wrap">{{
                                                getCommentDetail(slotProps.data.id)!.moderationNotes || '无' }}</div>
                                        </NDescriptionsItem>
                                    </NDescriptions>

                                    <!-- 敏感词 & 互动 -->
                                    <NDescriptions bordered :column="2" label-placement="left" size="small">
                                        <template #header>
                                            <div class="text-sm font-semibold"><i class="pi pi-chart-line mr-2"></i>敏感词
                                                & 互动</div>
                                        </template>
                                        <NDescriptionsItem label="敏感词" :span="2">
                                            <div v-if="(getCommentDetail(slotProps.data.id)!.sensitiveHits ?? []).length"
                                                class="flex flex-wrap gap-1">
                                                <NTag
                                                    v-for="word in (getCommentDetail(slotProps.data.id)!.sensitiveHits ?? [])"
                                                    :key="word" type="error" size="small">{{ word }}</NTag>
                                            </div>
                                            <span v-else class="text-500">无敏感词</span>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="互动反应" :span="2">
                                            <div v-if="Object.entries(getCommentDetail(slotProps.data.id)!.reactionStats ?? {}).length"
                                                class="flex flex-wrap gap-1">
                                                <NTag
                                                    v-for="[reaction, count] in Object.entries(getCommentDetail(slotProps.data.id)!.reactionStats ?? {})"
                                                    :key="reaction" type="info" size="small">{{ reaction }}：{{ count }}
                                                </NTag>
                                            </div>
                                            <span v-else class="text-500">无互动反应</span>
                                        </NDescriptionsItem>
                                    </NDescriptions>
                                </div>
                            </template>

                            <template v-else>
                                <div class="text-center py-6 text-500">
                                    <Button label="加载详情" icon="pi pi-download" @click="toggleDetail(slotProps.data)" />
                                </div>
                            </template>
                        </div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <!-- 审核弹窗 -->
    <Dialog v-model:visible="statusDialogVisible" modal header="审核评论" :style="{ width: '32rem' }">
        <template v-if="currentComment">
            <div class="flex flex-column gap-3">
                <Dropdown v-model="statusForm.status" :options="statusOptions" optionLabel="label" optionValue="value"
                    placeholder="选择状态" />
                <Dropdown v-model="statusForm.moderationLevel" :options="levelOptions" optionLabel="label"
                    optionValue="value" placeholder="风险等级" />
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

    <!-- 编辑弹窗 -->
    <Dialog v-model:visible="editDialogVisible" modal header="编辑评论" :style="{ width: '50vw' }">
        <template v-if="currentComment">
            <div class="flex flex-column gap-3">
                <Dropdown v-model="editForm.visibility" :options="visibilityOptions" optionLabel="label"
                    optionValue="value" placeholder="可见性" />
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
