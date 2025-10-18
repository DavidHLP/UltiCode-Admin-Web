<script setup lang="ts">
import {
    fetchProblemOptions,
    fetchProblems,
    type DictionaryOption,
    type ProblemOptions,
    type ProblemQuery,
    type ProblemSummary
} from '@/api/problem/problem';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const DEFAULT_LANG_CODE = 'zh-CN';

const problems = ref<ProblemSummary[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const keyword = ref('');
const problemTypeFilter = ref<string | null>(null);
const difficultyFilter = ref<number | null>(null);
const categoryFilter = ref<number | null>(null);
const visibilityFilter = ref<'public' | 'private' | null>(null);
const loading = ref(false);

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

const visibilityOptions = [
    { label: '公开', value: 'public' as const },
    { label: '私有', value: 'private' as const }
];

const difficultyOptions = computed(() =>
        difficulties.value.map((item) => ({ label: item.name ?? item.code, value: item.id }))
);
const categoryOptions = computed(() =>
        categories.value.map((item) => ({ label: item.name, value: item.id }))
);
const problemTypeOptions = computed(() =>
        problemTypes.value.map((type) => ({
            label: problemTypeLabels[type] ?? type,
            value: type
        }))
);

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

let abortController: AbortController | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

watch([keyword, problemTypeFilter, difficultyFilter, categoryFilter, visibilityFilter], () => {
    debouncedSearch();
});

onMounted(async () => {
    await loadOptions();
    await loadProblems();
});

onUnmounted(() => {
    if (abortController) {
        abortController.abort();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
});

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
        const params: ProblemQuery = {
            page: page.value,
            size: size.value,
            keyword: keyword.value?.trim() || undefined,
            problemType: problemTypeFilter.value ?? undefined,
            difficultyId: difficultyFilter.value ?? undefined,
            categoryId: categoryFilter.value ?? undefined,
            isPublic:
                visibilityFilter.value === null
                    ? undefined
                    : visibilityFilter.value === 'public',
            langCode: DEFAULT_LANG_CODE
        };
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

function onSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    page.value = 1;
    loadProblems();
}

function clearFilters() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    keyword.value = '';
    problemTypeFilter.value = null;
    difficultyFilter.value = null;
    categoryFilter.value = null;
    visibilityFilter.value = null;
    page.value = 1;
    loadProblems();
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

function visibilitySeverity(flag: boolean) {
    return flag ? 'success' : 'info';
}

function visibilityLabel(flag: boolean) {
    return flag ? '公开' : '私有';
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

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadProblems();
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <span class="p-input-icon-left">
                            <InputText
                                v-model="keyword"
                                placeholder="搜索题目别名或标题"
                                @keyup.enter="onSearch"
                                style="min-width: 18rem"
                            />
                        </span>
                        <Dropdown
                            v-model="problemTypeFilter"
                            :options="problemTypeOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="题目类型"
                            :showClear="true"
                            style="min-width: 10rem"
                        />
                        <Dropdown
                            v-model="difficultyFilter"
                            :options="difficultyOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="难度"
                            :showClear="true"
                            style="min-width: 10rem"
                        />
                        <Dropdown
                            v-model="categoryFilter"
                            :options="categoryOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="分类"
                            :showClear="true"
                            style="min-width: 12rem"
                        />
                        <Dropdown
                            v-model="visibilityFilter"
                            :options="visibilityOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="公开状态"
                            :showClear="true"
                            style="min-width: 10rem"
                        />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                        <Button label="新建题目" icon="pi pi-plus" severity="success" @click="openCreate" />
                    </div>
                </div>

                <DataTable
                    :value="problems"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
                    @page="onPageChange"
                    responsiveLayout="scroll"
                >
                    <Column field="title" header="标题" style="min-width: 14rem">
                        <template #body="{ data }">
                            {{ data.title || data.slug }}
                        </template>
                    </Column>
                    <Column field="slug" header="别名" style="min-width: 12rem" />
                    <Column field="problemType" header="类型" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ problemTypeLabel(data.problemType) }}
                        </template>
                    </Column>
                    <Column field="difficultyId" header="难度" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ difficultyLabel(data.difficultyId) }}
                        </template>
                    </Column>
                    <Column field="categoryId" header="分类" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ categoryLabel(data.categoryId) }}
                        </template>
                    </Column>
                    <Column field="isPublic" header="公开状态" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="visibilityLabel(data.isPublic)" :severity="visibilitySeverity(data.isPublic)" />
                        </template>
                    </Column>
                    <Column field="updatedAt" header="更新时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.updatedAt) }}
                        </template>
                    </Column>
                    <Column header="标签" style="min-width: 12rem">
                        <template #body="{ data }">
                            <div class="flex flex-wrap gap-2">
                                <Tag v-for="tag in data.tags" :key="tag.id" severity="info" :value="tag.name" />
                                <span v-if="!data.tags?.length">-</span>
                            </div>
                        </template>
                    </Column>
                    <Column header="操作" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Button label="编辑" icon="pi pi-pencil" text @click="openEdit(data)" />
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
