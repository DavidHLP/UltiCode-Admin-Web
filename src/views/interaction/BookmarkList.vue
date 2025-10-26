<script setup lang="ts">
import {
    deleteBookmark,
    fetchBookmarks,
    type BookmarkDeletePayload,
    type BookmarkQuery,
    type BookmarkView
} from '@/api/interaction/bookmarks';
import { NDescriptions, NDescriptionsItem } from 'naive-ui';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

type FilterOption = { label: string; value: string };
type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | undefined;

const bookmarks = ref<BookmarkView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const userIdFilter = ref<number | null>(null);
const entityTypeFilter = ref('');
const entityIdFilter = ref<number | null>(null);
const visibilityFilter = ref('');
const sourceFilter = ref('');

const toast = useToast();

const entityTypeOptions: FilterOption[] = [
    { label: '全部类型', value: '' },
    { label: '题目', value: 'problem' },
    { label: '比赛', value: 'contest' },
    { label: '评论', value: 'comment' },
    { label: '讨论', value: 'discussion' }
];

const visibilityOptions: FilterOption[] = [
    { label: '全部可见性', value: '' },
    { label: '公开', value: 'public' },
    { label: '私密', value: 'private' },
    { label: '团队', value: 'team' }
];

const sourceOptions: FilterOption[] = [
    { label: '全部来源', value: '' },
    { label: '用户', value: 'user' },
    { label: '系统', value: 'system' },
    { label: '迁移', value: 'migration' }
];

// 展开行状态（使用联合主键作为 key）
const expandedRows = ref<Record<string, boolean>>({});

// 删除确认状态
const showDeleteDialog = ref(false);
const selectedBookmark = ref<BookmarkView | null>(null);

// 生成联合主键
function getRowKey(bookmark: BookmarkView): string {
    return `${bookmark.userId}-${bookmark.entityType}-${bookmark.entityId}`;
}

onMounted(() => {
    loadBookmarks();
});

async function loadBookmarks() {
    loading.value = true;
    try {
        const params: BookmarkQuery = {
            page: page.value,
            size: size.value,
            userId: userIdFilter.value ?? undefined,
            entityType: entityTypeFilter.value || undefined,
            entityId: entityIdFilter.value ?? undefined,
            visibility: visibilityFilter.value || undefined,
            source: sourceFilter.value || undefined
        };
        const data = await fetchBookmarks(params);
        bookmarks.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (typeof data.page === 'number') page.value = Math.max(1, Number(data.page));
        if (typeof data.size === 'number' && Number(data.size) > 0) size.value = Number(data.size);
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: (error as Error)?.message ?? '加载收藏列表失败', life: 4000 });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    page.value = 1;
    loadBookmarks();
}

function resetFilters() {
    userIdFilter.value = null;
    entityTypeFilter.value = '';
    entityIdFilter.value = null;
    visibilityFilter.value = '';
    sourceFilter.value = '';
    page.value = 1;
    loadBookmarks();
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadBookmarks();
}

function promptDelete(row: BookmarkView) {
    selectedBookmark.value = row;
    showDeleteDialog.value = true;
}

async function confirmDelete() {
    if (!selectedBookmark.value) return;
    const payload: BookmarkDeletePayload = {
        userId: selectedBookmark.value.userId,
        entityType: selectedBookmark.value.entityType,
        entityId: selectedBookmark.value.entityId
    };
    try {
        loading.value = true;
        await deleteBookmark(payload);
        toast.add({ severity: 'success', summary: '删除成功', detail: '收藏已删除', life: 3000 });
        showDeleteDialog.value = false;
        selectedBookmark.value = null;
        await loadBookmarks();
    } catch (error) {
        toast.add({ severity: 'error', summary: '删除失败', detail: (error as Error)?.message ?? '删除收藏失败', life: 4000 });
    } finally {
        loading.value = false;
    }
}

function cancelDelete() {
    showDeleteDialog.value = false;
    selectedBookmark.value = null;
}

function getSensitiveLabel(flag: boolean | null | undefined) {
    return flag ? '敏感' : '正常';
}

function getSensitiveSeverity(flag: boolean | null | undefined): TagSeverity {
    return flag ? 'danger' : 'success';
}

function getRiskLabel(risk: string | null | undefined) {
    switch (risk) {
        case 'high':
            return '高';
        case 'medium':
            return '中';
        case 'low':
            return '低';
        default:
            return risk ?? '-';
    }
}

function getRiskSeverity(risk: string | null | undefined): TagSeverity {
    switch (risk) {
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
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputNumber v-model="userIdFilter" placeholder="用户ID" :min="1" inputId="bookmark-user" />
                        <Dropdown v-model="entityTypeFilter" :options="entityTypeOptions" optionLabel="label"
                            optionValue="value" placeholder="实体类型" style="width: 10rem" />
                        <InputNumber v-model="entityIdFilter" placeholder="实体ID" :min="1" inputId="bookmark-entity" />
                        <Dropdown v-model="visibilityFilter" :options="visibilityOptions" optionLabel="label"
                            optionValue="value" placeholder="可见性" style="width: 10rem" />
                        <Dropdown v-model="sourceFilter" :options="sourceOptions" optionLabel="label"
                            optionValue="value" placeholder="来源" style="width: 10rem" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="resetFilters" />
                    </div>
                </div>

                <DataTable :value="bookmarks" :loading="loading" :paginator="true" :lazy="true" :rows="size"
                    :totalRecords="total" :rowsPerPageOptions="[10, 20, 50]" :first="(page - 1) * size"
                    :dataKey="getRowKey" responsiveLayout="scroll" v-model:expandedRows="expandedRows">
                    <Column expander style="width:3rem" />
                    <Column field="userId" header="用户ID" sortable />
                    <Column field="entityType" header="实体类型" sortable />
                    <Column field="entityId" header="实体ID" sortable />
                    <Column field="visibility" header="可见性" sortable />
                    <Column field="note" header="备注">
                        <template #body="slotProps">
                            <span class="block text-overflow-ellipsis whitespace-nowrap" style="max-width: 16rem">{{
                                slotProps.data.note ?? '-' }}</span>
                        </template>
                    </Column>
                    <Column field="sensitiveFlag" header="敏感">
                        <template #body="slotProps">
                            <Tag :value="getSensitiveLabel(slotProps.data.sensitiveFlag)"
                                :severity="getSensitiveSeverity(slotProps.data.sensitiveFlag)" />
                        </template>
                    </Column>
                    <Column field="riskLevel" header="风险">
                        <template #body="slotProps">
                            <template v-if="slotProps.data.riskLevel">
                                <Tag :value="getRiskLabel(slotProps.data.riskLevel)"
                                    :severity="getRiskSeverity(slotProps.data.riskLevel)" />
                            </template>
                            <span v-else>-</span>
                        </template>
                    </Column>
                    <Column field="tags" header="标签">
                        <template #body="slotProps">
                            <div class="flex gap-1 flex-wrap">
                                <Tag v-for="tag in slotProps.data.tags" :key="tag" severity="info" :value="tag" />
                                <span v-if="!slotProps.data.tags?.length">-</span>
                            </div>
                        </template>
                    </Column>
                    <Column field="source" header="来源" sortable />
                    <Column field="createdAt" header="创建时间" sortable />
                    <Column header="操作">
                        <template #body="slotProps">
                            <SplitButton label="删除" icon="pi pi-trash" size="small" :model="[
                                {
                                    label: '无更多操作',
                                    command: () => {
                                    }
                                }
                            ]" @click="promptDelete(slotProps.data)" />
                        </template>
                    </Column>

                    <!-- 行展开：使用 Accordion + NDescriptions 呈现详情 -->
                    <template #expansion="slotProps">
                        <div class="p-4 bg-surface-50 dark:bg-surface-900 rounded">
                            <Accordion :multiple="true" :activeIndex="[0]">
                                <AccordionTab header="基本信息">
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <NDescriptionsItem label="用户ID">{{ slotProps.data.userId }}</NDescriptionsItem>
                                        <NDescriptionsItem label="实体类型">{{ slotProps.data.entityType }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="实体ID">{{ slotProps.data.entityId }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="可见性">{{ slotProps.data.visibility }}
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="来源">{{ slotProps.data.source }}</NDescriptionsItem>
                                        <NDescriptionsItem label="创建时间">{{ slotProps.data.createdAt }}
                                        </NDescriptionsItem>
                                    </NDescriptions>
                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <NDescriptionsItem label="标签">
                                            <div class="flex gap-1 flex-wrap">
                                                <Tag v-for="tag in slotProps.data.tags" :key="tag" severity="info"
                                                    :value="tag" />
                                                <span v-if="!slotProps.data.tags?.length">-</span>
                                            </div>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="备注">
                                            <div class="whitespace-pre-wrap">{{ slotProps.data.note ?? '-' }}</div>
                                        </NDescriptionsItem>
                                    </NDescriptions>
                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <NDescriptionsItem label="敏感标记">
                                            <Tag :value="getSensitiveLabel(slotProps.data.sensitiveFlag)"
                                                :severity="getSensitiveSeverity(slotProps.data.sensitiveFlag)" />
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="风险等级">
                                            <template v-if="slotProps.data.riskLevel">
                                                <Tag :value="getRiskLabel(slotProps.data.riskLevel)"
                                                    :severity="getRiskSeverity(slotProps.data.riskLevel)" />
                                            </template>
                                            <span v-else>-</span>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="命中词">
                                            <div v-if="slotProps.data.sensitiveHits?.length"
                                                class="flex gap-1 flex-wrap">
                                                <Tag v-for="hit in slotProps.data.sensitiveHits" :key="hit"
                                                    severity="danger" :value="hit" />
                                            </div>
                                            <span v-else>-</span>
                                        </NDescriptionsItem>
                                    </NDescriptions>
                                </AccordionTab>
                            </Accordion>
                        </div>
                    </template>
                </DataTable>

                <!-- 删除确认弹窗 -->
                <Dialog header="确认删除" v-model:visible="showDeleteDialog" modal :style="{ width: '32rem' }"
                    :breakpoints="{ '640px': '95vw' }" @hide="cancelDelete">
                    <template v-if="selectedBookmark">
                        <NSpace vertical :size="16" class="py-2">
                            <NAlert type="warning" :bordered="false">
                                <template #icon>
                                    <i class="pi pi-exclamation-triangle" style="font-size: 1.25rem"></i>
                                </template>
                                此操作将永久删除该收藏记录，无法恢复。
                            </NAlert>

                            <div class="px-2">
                                <NDescriptions bordered :column="1" label-placement="left" size="small">
                                    <NDescriptionsItem label="用户ID">
                                        <NText strong>{{ selectedBookmark.userId }}</NText>
                                    </NDescriptionsItem>
                                    <NDescriptionsItem label="实体类型">
                                        <NText strong>{{ selectedBookmark.entityType }}</NText>
                                    </NDescriptionsItem>
                                    <NDescriptionsItem label="实体ID">
                                        <NText strong>{{ selectedBookmark.entityId }}</NText>
                                    </NDescriptionsItem>
                                    <NDescriptionsItem v-if="selectedBookmark.note" label="备注">
                                        <NText depth="3" class="text-sm">{{ selectedBookmark.note }}</NText>
                                    </NDescriptionsItem>
                                </NDescriptions>
                            </div>
                        </NSpace>
                    </template>

                    <template #footer>
                        <div class="flex justify-end gap-2">
                            <Button label="取消" icon="pi pi-times" severity="secondary" text @click="cancelDelete" />
                            <Button label="确认删除" icon="pi pi-trash" severity="danger" :loading="loading"
                                @click="confirmDelete" />
                        </div>
                    </template>
                </Dialog>
            </div>
        </div>
    </div>
</template>
