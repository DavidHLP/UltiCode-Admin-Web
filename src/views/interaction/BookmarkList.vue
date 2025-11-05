<script setup lang="ts">
import {
    deleteBookmark,
    fetchBookmarks,
    type BookmarkDeletePayload,
    type BookmarkQuery,
    type BookmarkView
} from '@/api/interaction/bookmarks';
import { NDescriptions, NDescriptionsItem } from 'naive-ui';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type FilterOption = { label: string; value: string };
type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | undefined;
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
type BookmarkRow = BookmarkView & { __rowKey: string };

const bookmarks = ref<BookmarkView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const toast = useToast();

const filters = ref<FiltersState>(createEmptyFilters());
const expandedRows = ref<Record<string, boolean>>({});
const showDeleteDialog = ref(false);
const selectedBookmark = ref<BookmarkView | null>(null);

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

let abortController: AbortController | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let skipFilterWatch = false;

const tableRows = computed<BookmarkRow[]>(() =>
    bookmarks.value.map((item) => ({
        ...item,
        __rowKey: `${item.userId}-${item.entityType}-${item.entityId}`
    }))
);

const paginationFirst = computed(() => (page.value - 1) * size.value);

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
    await loadBookmarks();
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
        userId: exactFilter(),
        entityType: exactFilter(),
        entityId: exactFilter(),
        visibility: exactFilter(),
        source: exactFilter(),
        note: textFilter()
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

function buildQueryFromFilters(): BookmarkQuery {
    const query: BookmarkQuery = {
        page: page.value,
        size: size.value
    };
    const noteKeyword = resolveStringFilter('note');
    const globalKeyword = resolveStringFilter('global');
    if (noteKeyword) {
        query.keyword = noteKeyword;
    } else if (globalKeyword) {
        query.keyword = globalKeyword;
    }
    const userId = resolveNumberFilter('userId');
    if (userId !== undefined) {
        query.userId = userId;
    }
    const entityId = resolveNumberFilter('entityId');
    if (entityId !== undefined) {
        query.entityId = entityId;
    }
    const entityType = resolveStringFilter('entityType');
    if (entityType) {
        query.entityType = entityType;
    }
    const visibility = resolveStringFilter('visibility');
    if (visibility) {
        query.visibility = visibility;
    }
    const source = resolveStringFilter('source');
    if (source) {
        query.source = source;
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
        loadBookmarks();
    }, 300);
}

async function loadBookmarks() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const params = buildQueryFromFilters();
        const data = await fetchBookmarks(params, controller.signal);
        bookmarks.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载收藏列表失败',
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
        await loadBookmarks();
    } finally {
        skipFilterWatch = false;
    }
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
    if (!selectedBookmark.value) {
        return;
    }
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
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除收藏失败',
            life: 4000
        });
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
                <DataTable
                    :value="tableRows"
                    dataKey="__rowKey"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['entityType', 'visibility', 'source', 'note']"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :first="paginationFirst"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
                    v-model:expandedRows="expandedRows"
                    @page="onPageChange"
                    responsiveLayout="scroll"
                    showGridlines
                >
                    <template #header>
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <Button type="button" label="重置" icon="pi pi-filter-slash" outlined @click="clearFilters" />
                                <IconField>
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText
                                        v-model="(filters['global'] as DataTableFilterMetaData).value"
                                        placeholder="搜索类型、来源或备注"
                                    />
                                </IconField>
                            </div>
                        </div>
                    </template>
                    <Column expander style="width:3rem" />
                    <Column field="userId" header="用户ID" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" :min="1" placeholder="用户ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="entityType" header="实体类型" :showFilterMatchModes="false" style="min-width: 9rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="entityTypeOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="entityId" header="实体ID" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" :min="1" placeholder="实体ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="visibility" header="可见性" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="visibilityOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="note" header="备注" filterField="note" :showFilterMatchModes="false" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span class="block text-overflow-ellipsis whitespace-nowrap" style="max-width: 16rem">
                                {{ data.note ?? '-' }}
                            </span>
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="搜索备注内容" class="w-full" />
                        </template>
                    </Column>
                    <Column field="tags" header="标签" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="flex gap-1 flex-wrap">
                                <Tag v-for="tag in data.tags" :key="tag" severity="info" :value="tag" />
                                <span v-if="!data.tags?.length">-</span>
                            </div>
                        </template>
                    </Column>
                    <Column field="source" header="来源" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="sourceOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="sensitiveFlag" header="敏感" style="min-width: 7rem">
                        <template #body="{ data }">
                            <Tag :value="getSensitiveLabel(data.sensitiveFlag)" :severity="getSensitiveSeverity(data.sensitiveFlag)" />
                        </template>
                    </Column>
                    <Column field="riskLevel" header="风险" style="min-width: 7rem">
                        <template #body="{ data }">
                            <template v-if="data.riskLevel">
                                <Tag :value="getRiskLabel(data.riskLevel)" :severity="getRiskSeverity(data.riskLevel)" />
                            </template>
                            <span v-else>-</span>
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" sortable style="min-width: 12rem" />
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="删除"
                                icon="pi pi-trash"
                                size="small"
                                :model="[
                                    {
                                        label: '复制信息',
                                        icon: 'pi pi-copy',
                                        command: () => navigator.clipboard.writeText(`用户ID: ${data.userId}, 实体: ${data.entityType}#${data.entityId}`)
                                    }
                                ]"
                                @click="promptDelete(data)"
                            />
                        </template>
                    </Column>

                    <template #expansion="{ data }">
                        <div class="p-4 bg-surface-50 dark:bg-surface-900 rounded">
                            <Accordion :multiple="true" :activeIndex="[0]">
                                <AccordionTab header="详细信息">
                                    <NDescriptions bordered :column="3" label-placement="left" size="small">
                                        <NDescriptionsItem label="用户ID">{{ data.userId }}</NDescriptionsItem>
                                        <NDescriptionsItem label="实体类型">{{ data.entityType }}</NDescriptionsItem>
                                        <NDescriptionsItem label="实体ID">{{ data.entityId }}</NDescriptionsItem>
                                        <NDescriptionsItem label="可见性">{{ data.visibility }}</NDescriptionsItem>
                                        <NDescriptionsItem label="来源">{{ data.source }}</NDescriptionsItem>
                                        <NDescriptionsItem label="创建时间">{{ data.createdAt }}</NDescriptionsItem>
                                    </NDescriptions>
                                    <NDescriptions bordered :column="1" label-placement="left" size="small">
                                        <NDescriptionsItem label="标签">
                                            <div class="flex gap-1 flex-wrap">
                                                <Tag v-for="tag in data.tags" :key="tag" severity="info" :value="tag" />
                                                <span v-if="!data.tags?.length">-</span>
                                            </div>
                                        </NDescriptionsItem>
                                        <NDescriptionsItem label="备注">{{ data.note ?? '-' }}</NDescriptionsItem>
                                        <NDescriptionsItem v-if="data.sensitiveHits?.length" label="敏感命中">
                                            {{ data.sensitiveHits.join('、') }}
                                        </NDescriptionsItem>
                                    </NDescriptions>
                                </AccordionTab>
                                <AccordionTab header="快捷操作">
                                    <div class="flex gap-2 flex-wrap">
                                        <Button label="删除收藏" icon="pi pi-trash" severity="danger" @click="promptDelete(data)" />
                                        <Button
                                            label="复制信息"
                                            icon="pi pi-copy"
                                            severity="secondary"
                                            @click="navigator.clipboard.writeText(`用户ID: ${data.userId}, 实体: ${data.entityType}#${data.entityId}`)"
                                        />
                                    </div>
                                </AccordionTab>
                            </Accordion>
                        </div>
                    </template>

                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="showDeleteDialog" modal header="删除收藏" :style="{ width: '24rem' }">
        <p class="mb-4">
            确定要删除用户
            <strong>{{ selectedBookmark?.userId }}</strong>
            对
            <strong>{{ selectedBookmark?.entityType }} #{{ selectedBookmark?.entityId }}</strong>
            的收藏吗？
        </p>
        <div class="flex justify-end gap-2">
            <Button label="取消" severity="secondary" @click="cancelDelete" />
            <Button label="删除" icon="pi pi-trash" severity="danger" :loading="loading" @click="confirmDelete" />
        </div>
    </Dialog>
</template>
