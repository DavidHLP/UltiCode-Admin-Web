<script setup lang="ts">
import { fetchProblemOptions, fetchProblems, type DictionaryOption, type ProblemOptions, type ProblemQuery, type ProblemSummary } from '@/api/problem/problem.ts';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const DEFAULT_LANG_CODE = 'zh-CN';

type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;
type ProblemVisibility = 'public' | 'private';
type OptionItem<T> = { label: string; value: T };

const router = useRouter();
const toast = useToast();

const problems = ref<ProblemSummary[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const filters = ref<FiltersState>(createEmptyFilters());

const problemTypes = ref<string[]>([]);
const difficulties = ref<DictionaryOption[]>([]);
const categories = ref<DictionaryOption[]>([]);

const problemTypeLabels: Record<string, string> = {
    coding: '编程题',
    sql: 'SQL',
    shell: 'Shell',
    concurrency: '并发题',
    interactive: '交互题',
    'output-only': '输出题'
};

const visibilityOptions: OptionItem<ProblemVisibility | ''>[] = [
    { label: '全部', value: '' },
    { label: '公开', value: 'public' },
    { label: '私有', value: 'private' }
];

const lifecycleStatusOptions: OptionItem<string | ''>[] = [
    { label: '全部', value: '' },
    { label: '草稿', value: 'draft' },
    { label: '审核中', value: 'in_review' },
    { label: '审核通过', value: 'approved' },
    { label: '待发布', value: 'ready' },
    { label: '已发布', value: 'published' },
    { label: '已归档', value: 'archived' }
];

const reviewStatusOptions: OptionItem<string | ''>[] = [
    { label: '全部', value: '' },
    { label: '待审核', value: 'pending' },
    { label: '已通过', value: 'approved' },
    { label: '已驳回', value: 'rejected' }
];

const problemTypeOptions = computed<OptionItem<string>[]>(() =>
    problemTypes.value.map((type) => ({
        label: problemTypeLabels[type] ?? type,
        value: type
    }))
);
const problemTypeFilterOptions = computed(() => [{ label: '全部', value: null }, ...problemTypeOptions.value]);

const difficultyOptions = computed<OptionItem<number>[]>(() =>
    difficulties.value.map((item) => ({
        label: item.name ?? item.code,
        value: item.id
    }))
);
const difficultyFilterOptions = computed(() => [{ label: '全部', value: null }, ...difficultyOptions.value]);

const categoryOptions = computed<OptionItem<number>[]>(() =>
    categories.value.map((item) => ({
        label: item.name,
        value: item.id
    }))
);
const categoryFilterOptions = computed(() => [{ label: '全部', value: null }, ...categoryOptions.value]);

const visibilityFilterOptions = computed(() => visibilityOptions);

const difficultyNameMap = computed(() => {
    const map = new Map<number, string>();
    difficulties.value.forEach((item) => {
        map.set(item.id, item.name ?? item.code);
    });
    return map;
});

const categoryNameMap = computed(() => {
    const map = new Map<number, string>();
    categories.value.forEach((item) => {
        map.set(item.id, item.name);
    });
    return map;
});

const lifecycleLabelMap: Record<string, string> = {
    draft: '草稿',
    in_review: '审核中',
    approved: '审核通过',
    ready: '待发布',
    published: '已发布',
    archived: '已归档'
};

const reviewLabelMap: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回'
};

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
    await loadOptions();
    await loadProblems();
});

onBeforeUnmount(() => {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
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
        problemType: exactFilter(),
        difficultyId: exactFilter(),
        categoryId: exactFilter(),
        isPublic: exactFilter(),
        lifecycleStatus: exactFilter(),
        reviewStatus: exactFilter()
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

function resolveBooleanFilter(field: string): boolean | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === true || raw === 'true') {
        return true;
    }
    if (raw === false || raw === 'false') {
        return false;
    }
    if (raw === 'public') {
        return true;
    }
    if (raw === 'private') {
        return false;
    }
    return undefined;
}

function buildQueryFromFilters(): ProblemQuery {
    const query: ProblemQuery = {
        page: page.value,
        size: size.value,
        langCode: DEFAULT_LANG_CODE
    };

    const keyword = resolveStringFilter('global');
    if (keyword) {
        query.keyword = keyword;
    }
    const problemType = resolveStringFilter('problemType');
    if (problemType) {
        query.problemType = problemType;
    }
    const difficultyId = resolveNumberFilter('difficultyId');
    if (difficultyId !== undefined) {
        query.difficultyId = difficultyId;
    }
    const categoryId = resolveNumberFilter('categoryId');
    if (categoryId !== undefined) {
        query.categoryId = categoryId;
    }
    const isPublic = resolveBooleanFilter('isPublic');
    if (isPublic !== undefined) {
        query.isPublic = isPublic;
    }
    const lifecycleStatus = resolveStringFilter('lifecycleStatus');
    if (lifecycleStatus) {
        query.lifecycleStatus = lifecycleStatus;
    }
    const reviewStatus = resolveStringFilter('reviewStatus');
    if (reviewStatus) {
        query.reviewStatus = reviewStatus;
    }

    return query;
}

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadProblems();
    }, 300);
}

async function loadOptions() {
    try {
        const options: ProblemOptions = await fetchProblemOptions();
        problemTypes.value = options.problemTypes ?? [];
        difficulties.value = options.difficulties ?? [];
        categories.value = options.categories ?? [];
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: (error as Error)?.message ?? '加载题目选项失败',
            life: 4000
        });
    }
}

async function loadProblems() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const params = buildQueryFromFilters();
        const data = await fetchProblems(params, controller.signal);
        problems.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载题目列表失败',
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
        await loadProblems();
    } finally {
        skipFilterWatch = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadProblems();
}

function visibilitySeverity(flag: boolean) {
    return flag ? 'success' : 'info';
}

function visibilityLabel(flag: boolean) {
    return flag ? '公开' : '私有';
}

function problemTypeLabel(type: string) {
    return problemTypeLabels[type] ?? type;
}

function difficultyLabel(id?: number | null) {
    if (id == null) {
        return '-';
    }
    return difficultyNameMap.value.get(id) ?? '-';
}

function categoryLabel(id?: number | null) {
    if (id == null) {
        return '-';
    }
    return categoryNameMap.value.get(id) ?? '-';
}

function lifecycleLabel(status?: string | null) {
    if (!status) {
        return '-';
    }
    return lifecycleLabelMap[status] ?? status;
}

function reviewLabel(status?: string | null) {
    if (!status) {
        return '-';
    }
    return reviewLabelMap[status] ?? status;
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
        minute: '2-digit'
    }).format(date);
}

function openCreate() {
    router.push({ name: 'adminProblemsCreate' });
}

function openEdit(problem: ProblemSummary) {
    router.push({ name: 'adminProblemsEdit', params: { problemId: problem.id } });
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="problems"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['slug', 'title', 'categoryName']"
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
                                <Button type="button" label="重置筛选" icon="pi pi-filter-slash" outlined @click="clearFilters" />
                                <IconField>
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText v-model="(filters['global'] as DataTableFilterMetaData).value" placeholder="搜索题目别名或标题" />
                                </IconField>
                            </div>
                            <Button label="新建题目" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>

                    <Column field="title" header="标题" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.title || data.slug }}
                        </template>
                    </Column>
                    <Column field="slug" header="别名" style="min-width: 10rem" />
                    <Column field="problemType" header="类型" filterField="problemType" :showFilterMatchModes="false" style="min-width: 9rem">
                        <template #body="{ data }">
                            {{ problemTypeLabel(data.problemType) }}
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown v-model="filterModel.value" :options="problemTypeFilterOptions" optionLabel="label" optionValue="value" placeholder="全部" class="w-full" />
                        </template>
                    </Column>
                    <Column field="difficultyId" header="难度" filterField="difficultyId" :showFilterMatchModes="false" style="min-width: 6rem">
                        <template #body="{ data }">
                            {{ difficultyLabel(data.difficultyId) }}
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown v-model="filterModel.value" :options="difficultyFilterOptions" optionLabel="label" optionValue="value" placeholder="全部" class="w-full" />
                        </template>
                    </Column>
                    <Column field="categoryId" header="分类" filterField="categoryId" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ categoryLabel(data.categoryId) }}
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown v-model="filterModel.value" :options="categoryFilterOptions" optionLabel="label" optionValue="value" placeholder="全部" class="w-full" />
                        </template>
                    </Column>
                    <Column field="isPublic" header="公开状态" filterField="isPublic" :showFilterMatchModes="false" style="min-width: 10rem">
                        <template #body="{ data }">
                            <Tag :value="visibilityLabel(data.isPublic)" :severity="visibilitySeverity(data.isPublic)" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown v-model="filterModel.value" :options="visibilityFilterOptions" optionLabel="label" optionValue="value" placeholder="全部" class="w-full" />
                        </template>
                    </Column>
                    <Column field="lifecycleStatus" header="生命周期" filterField="lifecycleStatus" :showFilterMatchModes="false" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ lifecycleLabel(data.lifecycleStatus) }}
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown v-model="filterModel.value" :options="lifecycleStatusOptions" optionLabel="label" optionValue="value" placeholder="全部" class="w-full" />
                        </template>
                    </Column>
                    <Column field="reviewStatus" header="审核状态" filterField="reviewStatus" :showFilterMatchModes="false" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ reviewLabel(data.reviewStatus) }}
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown v-model="filterModel.value" :options="reviewStatusOptions" optionLabel="label" optionValue="value" placeholder="全部" class="w-full" />
                        </template>
                    </Column>
                    <Column field="updatedAt" header="更新时间" sortable style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.updatedAt) }}
                        </template>
                    </Column>
                    <Column header="标签" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="flex flex-wrap gap-2">
                                <Tag v-for="tag in data.tags" :key="tag.id" :value="tag.name" />
                                <span v-if="!data.tags?.length">-</span>
                            </div>
                        </template>
                    </Column>
                    <Column header="操作" style="min-width: 9rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="编辑"
                                icon="pi pi-pencil"
                                size="small"
                                :model="[
                                    {
                                        label: '新建题目',
                                        icon: 'pi pi-plus',
                                        command: () => openCreate()
                                    }
                                ]"
                                @click="openEdit(data)"
                            />
                        </template>
                    </Column>

                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无题目</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>
</template>
