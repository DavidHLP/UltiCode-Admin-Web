<script setup lang="ts">
import type {
    CommentDetail,
    CommentSummary,
    CommentQuery,
    CommentStatusPayload,
    CommentUpdatePayload
} from '@/api/interaction/comments';
import {
    CommentStatus,
    fetchComment,
    fetchComments,
    updateComment,
    updateCommentStatus
} from '@/api/interaction/comments';
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

const detailDialogVisible = ref(false);
const statusDialogVisible = ref(false);
const editDialogVisible = ref(false);
const detailLoading = ref(false);

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
        if (typeof data.page === 'number') {
            page.value = Math.max(1, Number(data.page));
        }
        if (typeof data.size === 'number' && Number(data.size) > 0) {
            size.value = Number(data.size);
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载评论列表失败',
            life: 4000
        });
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

async function openDetail(comment: CommentSummary) {
    detailDialogVisible.value = true;
    detailLoading.value = true;
    try {
        const detail = await fetchComment(comment.id);
        currentComment.value = detail;
        statusForm.value = {
            status: detail.status,
            moderationNotes: detail.moderationNotes ?? '',
            moderationLevel: detail.moderationLevel ?? ''
        };
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
    } finally {
        detailLoading.value = false;
    }
}

async function openStatusDialog(comment: CommentSummary) {
    statusDialogVisible.value = true;
    detailLoading.value = true;
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
    } finally {
        detailLoading.value = false;
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
    detailLoading.value = true;
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
    } finally {
        detailLoading.value = false;
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

function closeDetail() {
    detailDialogVisible.value = false;
}

function formatReactionStats(stats: Record<string, number>) {
    return Object.entries(stats || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('、');
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputText
                            v-model="keyword"
                            placeholder="搜索内容或备注"
                            style="min-width: 16rem"
                            @keyup.enter="onSearch"
                        />
                        <Dropdown v-model="statusFilter" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="审核状态" style="width: 10rem" />
                        <Dropdown v-model="entityTypeFilter" :options="entityTypeOptions" optionLabel="label" optionValue="value" placeholder="实体类型" style="width: 10rem" />
                        <Dropdown v-model="moderationLevelFilter" :options="levelOptions" optionLabel="label" optionValue="value" placeholder="风险等级" style="width: 10rem" />
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

                <DataTable
                    :value="comments"
                    :loading="loading"
                    :rows="size"
                    :lazy="true"
                    :paginator="true"
                    :totalRecords="total"
                    dataKey="id"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :first="paginationFirst"
                    responsiveLayout="scroll"
                    @page="onPageChange"
                >
                    <Column field="id" header="ID" sortable />
                    <Column field="entityType" header="类型" sortable />
                    <Column field="entityId" header="实体ID" sortable />
                    <Column field="userId" header="用户ID" sortable />
                    <Column field="status" header="状态" sortable />
                    <Column field="moderationLevel" header="风险" sortable />
                    <Column field="sensitiveFlag" header="敏感">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.sensitiveFlag ? '是' : '否'" :severity="slotProps.data.sensitiveFlag ? 'danger' : 'success'" />
                        </template>
                    </Column>
                    <Column field="contentPreview" header="内容预览" :style="{ maxWidth: '18rem' }">
                        <template #body="slotProps">
                            <span class="whitespace-nowrap text-overflow-ellipsis overflow-hidden block" style="max-width: 18rem">{{ slotProps.data.contentPreview }}</span>
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" sortable />
                    <Column field="updatedAt" header="更新时间" sortable />
                    <Column header="操作">
                        <template #body="slotProps">
                            <div class="flex gap-2">
                                <Button label="详情" icon="pi pi-search" size="small" @click="openDetail(slotProps.data)" />
                                <Button label="审核" icon="pi pi-check" severity="info" size="small" @click="openStatusDialog(slotProps.data)" />
                                <Button label="编辑" icon="pi pi-pencil" severity="secondary" size="small" @click="openEditDialog(slotProps.data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="detailDialogVisible" modal header="评论详情" :style="{ width: '60vw' }" @hide="closeDetail">
        <template v-if="detailLoading">
            <div class="flex justify-center items-center py-8">
                <ProgressSpinner style="width: 40px; height: 40px" />
            </div>
        </template>
        <template v-else-if="currentComment">
            <div class="mb-3">
                <div class="font-medium mb-1">评论内容</div>
                <pre class="whitespace-pre-wrap bg-surface-200 dark:bg-surface-800 p-3 border-round">{{ currentComment.contentMd }}</pre>
            </div>
            <div class="grid">
                <div class="col-12 md:col-6">
                    <p><strong>状态：</strong>{{ currentComment.status }}</p>
                    <p><strong>风险等级：</strong>{{ currentComment.moderationLevel ?? '-' }}</p>
                    <p><strong>敏感词：</strong>{{ currentComment.sensitiveHits?.length ? currentComment.sensitiveHits.join('、') : '无' }}</p>
                    <p><strong>备注：</strong>{{ currentComment.moderationNotes ?? '-' }}</p>
                </div>
                <div class="col-12 md:col-6">
                    <p><strong>用户ID：</strong>{{ currentComment.userId }}</p>
                    <p><strong>实体：</strong>{{ currentComment.entityType }} #{{ currentComment.entityId }}</p>
                    <p><strong>反应：</strong>{{ formatReactionStats(currentComment.reactionStats) || '无' }}</p>
                    <p><strong>最后审核人：</strong>{{ currentComment.lastModeratedBy ?? '-' }}，时间：{{ currentComment.lastModeratedAt ?? '-' }}</p>
                </div>
            </div>
        </template>
        <template v-else>
            <div class="text-center py-6 text-500">暂无数据</div>
        </template>
    </Dialog>

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
