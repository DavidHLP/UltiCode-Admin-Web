<script setup lang="ts">
import {
    deleteReaction,
    fetchReactions,
    type ReactionDeletePayload,
    type ReactionQuery,
    type ReactionView
} from '@/api/interaction/reactions';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
type FilterOption = { label: string; value: string };
type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | undefined;
type ReactionRow = ReactionView & { __rowKey: string };

const reactions = ref<ReactionView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const toast = useToast();

const filters = ref<FiltersState>(createEmptyFilters());
let abortController: AbortController | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let skipFilterWatch = false;

const entityTypeOptions: FilterOption[] = [
    { label: '全部类型', value: '' },
    { label: '题目', value: 'problem' },
    { label: '评论', value: 'comment' },
    { label: '讨论', value: 'discussion' }
];

const kindOptions: FilterOption[] = [
    { label: '全部类型', value: '' },
    { label: '点赞', value: 'like' },
    { label: '点踩', value: 'dislike' },
    { label: '赞同', value: 'upvote' },
    { label: '反对', value: 'downvote' }
];

const sourceOptions: FilterOption[] = [
    { label: '全部来源', value: '' },
    { label: '用户', value: 'user' },
    { label: '系统', value: 'system' },
    { label: '审核', value: 'moderation' }
];

const paginationFirst = computed(() => (page.value - 1) * size.value);
const tableRows = computed<ReactionRow[]>(() =>
    reactions.value.map((item) => ({
        ...item,
        __rowKey: `${item.userId}-${item.entityType}-${item.entityId}-${item.kind}`
    }))
);

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
    await loadReactions();
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
        kind: exactFilter(),
        source: exactFilter(),
        metadata: textFilter()
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

function buildQueryFromFilters(): ReactionQuery {
    const query: ReactionQuery = {
        page: page.value,
        size: size.value
    };

    const metadataKeyword = resolveStringFilter('metadata');
    const globalKeyword = resolveStringFilter('global');
    if (metadataKeyword) {
        query.keyword = metadataKeyword;
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
    const kind = resolveStringFilter('kind');
    if (kind) {
        query.kind = kind;
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
        loadReactions();
    }, 300);
}

async function loadReactions() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const params = buildQueryFromFilters();
        const data = await fetchReactions(params, controller.signal);
        reactions.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载反馈列表失败',
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
    page.value = 1;
    try {
        await loadReactions();
    } finally {
        skipFilterWatch = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadReactions();
}

async function removeReaction(row: ReactionView) {
    const payload: ReactionDeletePayload = {
        userId: row.userId,
        entityType: row.entityType,
        entityId: row.entityId,
        kind: row.kind
    };
    try {
        await deleteReaction(payload);
        toast.add({ severity: 'success', summary: '删除成功', detail: '互动反馈已删除', life: 3000 });
        await loadReactions();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除反馈失败',
            life: 4000
        });
    }
}

function viewReactionDetail(row: ReactionView) {
    const risk = row.riskLevel ? `，风险：${getRiskLabel(row.riskLevel)}` : '';
    const hits = row.sensitiveHits?.length ? `，命中词：${row.sensitiveHits.join('、')}` : '';
    toast.add({
        severity: row.sensitiveFlag ? 'warn' : 'info',
        summary: '反馈详情',
        detail: `用户${row.userId}对${row.entityType}(${row.entityId})的${row.kind}反馈${risk}${hits}`,
        life: 5000
    });
}

function copyReactionInfo(row: ReactionView) {
    const info = `用户ID: ${row.userId}, 实体: ${row.entityType}#${row.entityId}, 类型: ${row.kind}`;
    navigator.clipboard
        .writeText(info)
        .then(() => {
            toast.add({
                severity: 'success',
                summary: '复制成功',
                detail: '反馈信息已复制到剪贴板',
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
                    :globalFilterFields="['entityType', 'kind', 'source', 'metadata']"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :first="paginationFirst"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
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
                                        placeholder="搜索反馈类型、来源或附加信息"
                                    />
                                </IconField>
                            </div>
                        </div>
                    </template>
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
                    <Column field="kind" header="反馈类型" :showFilterMatchModes="false" style="min-width: 9rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="kindOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部"
                                class="w-full"
                            />
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
                    <Column field="weight" header="权重" sortable style="min-width: 6rem" />
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
                    <Column field="metadata" header="附加信息" filterField="metadata" :showFilterMatchModes="false" style="min-width: 16rem">
                        <template #body="{ data }">
                            <span class="block text-overflow-ellipsis whitespace-nowrap" style="max-width: 16rem">
                                {{ data.metadata ?? '-' }}
                            </span>
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="搜索附加信息" class="w-full" />
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
                                        label: '查看详情',
                                        icon: 'pi pi-info-circle',
                                        command: () => viewReactionDetail(data)
                                    },
                                    {
                                        label: '复制信息',
                                        icon: 'pi pi-copy',
                                        command: () => copyReactionInfo(data)
                                    }
                                ]"
                                @click="removeReaction(data)"
                            />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>
</template>
