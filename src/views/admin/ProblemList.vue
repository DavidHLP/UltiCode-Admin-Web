<script setup lang="ts">
import {
    createProblem,
    fetchProblem,
    fetchProblemOptions,
    fetchProblems,
    updateProblem,
    type DictionaryOption,
    type LanguageOption,
    type ProblemDetail,
    type ProblemOptions,
    type ProblemQuery,
    type ProblemSummary,
    type ProblemUpsertPayload,
    type TagOption
} from '@/api/problem/problem';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

interface StatementForm {
    id?: number;
    langCode: string;
    title: string;
    descriptionMd: string;
    constraintsMd?: string | null;
    examplesMd?: string | null;
}

interface LanguageConfigForm {
    id?: number;
    languageId: number | null;
    functionName?: string | null;
    starterCode?: string | null;
}

interface ProblemForm {
    slug: string;
    problemType: string;
    difficultyId: number | null;
    categoryId: number | null;
    creatorId: number | null;
    solutionEntry: string;
    timeLimitMs: number | null;
    memoryLimitKb: number | null;
    isPublic: boolean;
    tagIds: number[];
    statements: StatementForm[];
    languageConfigs: LanguageConfigForm[];
    metaText: string;
}

const DEFAULT_LANG_CODE = 'zh-CN';

const toast = useToast();

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
const dialogVisible = ref(false);
const dialogLoading = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);

const problemTypes = ref<string[]>([]);
const difficulties = ref<DictionaryOption[]>([]);
const categories = ref<DictionaryOption[]>([]);
const tags = ref<TagOption[]>([]);
const languages = ref<LanguageOption[]>([]);

const form = reactive<ProblemForm>({
    slug: '',
    problemType: '',
    difficultyId: null,
    categoryId: null,
    creatorId: null,
    solutionEntry: '',
    timeLimitMs: null,
    memoryLimitKb: null,
    isPublic: true,
    tagIds: [],
    statements: [],
    languageConfigs: [],
    metaText: ''
});

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
const tagSelectOptions = computed(() => tags.value.map((tag) => ({ label: tag.name, value: tag.id })));
const languageSelectOptions = computed(() =>
        languages.value.map((lang) => ({ label: lang.displayName, value: lang.id }))
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
    resetForm();
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
        tags.value = options.tags ?? [];
        languages.value = options.languages ?? [];
        if (!form.problemType) {
            form.problemType = problemTypes.value[0] ?? 'coding';
        }
        if (!form.difficultyId) {
            form.difficultyId = difficulties.value[0]?.id ?? null;
        }
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

function resetForm() {
    form.slug = '';
    form.problemType = problemTypes.value[0] ?? 'coding';
    form.difficultyId = difficulties.value[0]?.id ?? null;
    form.categoryId = null;
    form.creatorId = null;
    form.solutionEntry = '';
    form.timeLimitMs = 1000;
    form.memoryLimitKb = 262144;
    form.isPublic = true;
    form.tagIds = [];
    form.statements = [
        {
            langCode: DEFAULT_LANG_CODE,
            title: '',
            descriptionMd: '',
            constraintsMd: '',
            examplesMd: ''
        }
    ];
    form.languageConfigs = [];
    form.metaText = '';
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

function addStatement() {
    form.statements.push({
        langCode: form.statements.length === 0 ? DEFAULT_LANG_CODE : 'en',
        title: '',
        descriptionMd: '',
        constraintsMd: '',
        examplesMd: ''
    });
}

function removeStatement(index: number) {
    if (form.statements.length <= 1) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: '至少保留一份题面',
            life: 3000
        });
        return;
    }
    form.statements.splice(index, 1);
}

function addLanguageConfig() {
    if (!languages.value.length) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: '暂无可用编程语言，请先配置语言信息',
            life: 3000
        });
        return;
    }
    form.languageConfigs.push({
        languageId: languages.value[0]?.id ?? null,
        functionName: '',
        starterCode: ''
    });
}

function removeLanguageConfig(index: number) {
    form.languageConfigs.splice(index, 1);
}

function openCreate() {
    editingId.value = null;
    resetForm();
    dialogLoading.value = false;
    dialogVisible.value = true;
}

async function openEdit(problem: ProblemSummary) {
    editingId.value = problem.id;
    dialogVisible.value = true;
    dialogLoading.value = true;
    try {
        const detail: ProblemDetail = await fetchProblem(problem.id, { langCode: DEFAULT_LANG_CODE });
        fillForm(detail);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载题目详情失败',
            life: 4000
        });
        dialogVisible.value = false;
        editingId.value = null;
    } finally {
        dialogLoading.value = false;
    }
}

function fillForm(detail: ProblemDetail) {
    form.slug = detail.slug ?? '';
    form.problemType = detail.problemType ?? problemTypes.value[0] ?? 'coding';
    form.difficultyId = detail.difficultyId ?? difficulties.value[0]?.id ?? null;
    form.categoryId = detail.categoryId ?? null;
    form.creatorId = detail.creatorId ?? null;
    form.solutionEntry = detail.solutionEntry ?? '';
    form.timeLimitMs = detail.timeLimitMs ?? null;
    form.memoryLimitKb = detail.memoryLimitKb ?? null;
    form.isPublic = detail.isPublic ?? true;
    form.tagIds = detail.tags?.map((tag) => tag.id) ?? [];
    form.statements =
            detail.statements?.length
                    ? detail.statements.map((item) => ({
                        id: item.id,
                        langCode: item.langCode ?? DEFAULT_LANG_CODE,
                        title: item.title ?? '',
                        descriptionMd: item.descriptionMd ?? '',
                        constraintsMd: item.constraintsMd ?? '',
                        examplesMd: item.examplesMd ?? ''
                    }))
                    : [
                        {
                            langCode: DEFAULT_LANG_CODE,
                            title: '',
                            descriptionMd: '',
                            constraintsMd: '',
                            examplesMd: ''
                        }
                    ];
    form.languageConfigs =
            detail.languageConfigs?.map((item) => ({
                id: item.id,
                languageId: item.languageId ?? null,
                functionName: item.functionName ?? '',
                starterCode: item.starterCode ?? ''
            })) ?? [];
    form.metaText =
            detail.meta && Object.keys(detail.meta).length
                    ? JSON.stringify(detail.meta, null, 2)
                    : '';
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    if (!form.slug.trim()) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入题目别名', life: 4000 });
        return;
    }
    if (!form.problemType) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请选择题目类型', life: 4000 });
        return;
    }
    if (!form.difficultyId) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请选择难度', life: 4000 });
        return;
    }
    if (!form.statements.length) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '至少添加一份题面', life: 4000 });
        return;
    }
    for (const statement of form.statements) {
        if (!statement.langCode.trim()) {
            toast.add({ severity: 'warn', summary: '校验失败', detail: '题面语言代码不能为空', life: 4000 });
            return;
        }
        if (!statement.title.trim()) {
            toast.add({ severity: 'warn', summary: '校验失败', detail: '题面标题不能为空', life: 4000 });
            return;
        }
        if (!statement.descriptionMd.trim()) {
            toast.add({ severity: 'warn', summary: '校验失败', detail: '题面描述不能为空', life: 4000 });
            return;
        }
    }

    let meta: Record<string, unknown> | undefined;
    const metaText = form.metaText?.trim();
    if (metaText) {
        try {
            const parsed = JSON.parse(metaText);
            if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
                throw new Error('题目元数据必须是 JSON 对象');
            }
            meta = parsed as Record<string, unknown>;
        } catch (error) {
            toast.add({
                severity: 'warn',
                summary: '校验失败',
                detail: (error as Error)?.message ?? '元数据格式错误，应为合法的 JSON 对象',
                life: 4000
            });
            return;
        }
    }

    const payload: ProblemUpsertPayload = {
        slug: form.slug.trim(),
        problemType: form.problemType,
        difficultyId: form.difficultyId!,
        categoryId: form.categoryId ?? undefined,
        creatorId: form.creatorId ?? undefined,
        solutionEntry: form.solutionEntry?.trim() || undefined,
        timeLimitMs: form.timeLimitMs ?? undefined,
        memoryLimitKb: form.memoryLimitKb ?? undefined,
        isPublic: form.isPublic,
        tagIds: form.tagIds?.length ? form.tagIds : undefined,
        statements: form.statements.map((statement) => ({
            langCode: statement.langCode.trim(),
            title: statement.title.trim(),
            descriptionMd: statement.descriptionMd,
            constraintsMd: statement.constraintsMd?.trim() || undefined,
            examplesMd: statement.examplesMd?.trim() || undefined
        })),
        languageConfigs:
                form.languageConfigs?.length
                        ? form.languageConfigs
                                .filter((config) => config.languageId != null)
                                .map((config) => {
                                    const trimmedFunction = config.functionName?.trim();
                                    const rawStarter = config.starterCode ?? '';
                                    const trimmedStarter = rawStarter.trim();
                                    return {
                                        languageId: config.languageId!,
                                        functionName: trimmedFunction || undefined,
                                        starterCode: trimmedStarter ? rawStarter : undefined
                                    };
                                })
                        : undefined,
        meta
    };

    saving.value = true;
    try {
        if (editingId.value === null) {
            await createProblem(payload);
            toast.add({
                severity: 'success',
                summary: '创建成功',
                detail: '题目已创建',
                life: 3000
            });
        } else {
            await updateProblem(editingId.value, payload);
            toast.add({
                severity: 'success',
                summary: '更新成功',
                detail: '题目信息已更新',
                life: 3000
            });
        }
        dialogVisible.value = false;
        await loadProblems();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '提交失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
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
                            <i class="pi pi-search" />
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

    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="editingId === null ? '新建题目' : '编辑题目'"
        :style="{ width: '72rem' }"
        :breakpoints="{ '1400px': '90vw', '960px': '95vw', '640px': '98vw' }"
        @hide="closeDialog"
    >
        <div v-if="dialogLoading" class="flex justify-center py-6">
            <ProgressSpinner style="width: 3rem; height: 3rem" strokeWidth="4" />
        </div>
        <form v-else class="grid form-grid" @submit.prevent="submitForm">
            <div class="col-12 md:col-6">
                <div class="field">
                    <label for="slug" class="font-medium text-sm mb-1 block">题目别名 (slug)</label>
                    <InputText id="slug" v-model="form.slug" placeholder="two-sum" class="w-full" />
                </div>
            </div>
            <div class="col-12 md:col-3">
                <div class="field">
                    <label for="problemType" class="font-medium text-sm mb-1 block">题目类型</label>
                    <Dropdown
                        id="problemType"
                        v-model="form.problemType"
                        :options="problemTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                    />
                </div>
            </div>
            <div class="col-12 md:col-3">
                <div class="field">
                    <label for="difficultyId" class="font-medium text-sm mb-1 block">难度</label>
                    <Dropdown
                        id="difficultyId"
                        v-model="form.difficultyId"
                        :options="difficultyOptions"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                    />
                </div>
            </div>
            <div class="col-12 md:col-4">
                <div class="field">
                    <label for="categoryId" class="font-medium text-sm mb-1 block">分类</label>
                    <Dropdown
                        id="categoryId"
                        v-model="form.categoryId"
                        :options="categoryOptions"
                        optionLabel="label"
                        optionValue="value"
                        :showClear="true"
                        placeholder="请选择分类"
                        class="w-full"
                    />
                </div>
            </div>
            <div class="col-12 md:col-4">
                <div class="field">
                    <label for="creatorId" class="font-medium text-sm mb-1 block">创建者用户ID</label>
                    <InputNumber
                        id="creatorId"
                        v-model="form.creatorId"
                        placeholder="可选"
                        class="w-full"
                        :useGrouping="false"
                        :allowEmpty="true"
                    />
                </div>
            </div>
            <div class="col-12 md:col-4">
                <div class="field">
                    <label for="solutionEntry" class="font-medium text-sm mb-1 block">参考解答入口</label>
                    <InputText
                        id="solutionEntry"
                        v-model="form.solutionEntry"
                        placeholder="可选，例如 twoSum"
                        class="w-full"
                    />
                </div>
            </div>
            <div class="col-12 md:col-4">
                <div class="field">
                    <label for="timeLimit" class="font-medium text-sm mb-1 block">时间限制 (ms)</label>
                    <InputNumber
                        id="timeLimit"
                        v-model="form.timeLimitMs"
                        :useGrouping="false"
                        :allowEmpty="true"
                        placeholder="如 1000"
                        class="w-full"
                    />
                </div>
            </div>
            <div class="col-12 md:col-4">
                <div class="field">
                    <label for="memoryLimit" class="font-medium text-sm mb-1 block">内存限制 (KB)</label>
                    <InputNumber
                        id="memoryLimit"
                        v-model="form.memoryLimitKb"
                        :useGrouping="false"
                        :allowEmpty="true"
                        placeholder="如 262144"
                        class="w-full"
                    />
                </div>
            </div>
            <div class="col-12 md:col-4">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block">公开状态</label>
                    <div class="flex items-center gap-2">
                        <InputSwitch v-model="form.isPublic" />
                        <span>{{ form.isPublic ? '公开' : '私有' }}</span>
                    </div>
                </div>
            </div>
            <div class="col-12">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block">标签</label>
                    <MultiSelect
                        v-model="form.tagIds"
                        :options="tagSelectOptions"
                        optionLabel="label"
                        optionValue="value"
                        display="chip"
                        placeholder="选择标签"
                        class="w-full"
                    />
                </div>
            </div>

            <div class="col-12">
                <div class="field">
                    <label class="font-medium text-sm mb-2 block">题面内容</label>
                    <div class="flex flex-column gap-4">
                        <div v-for="(statement, index) in form.statements" :key="index" class="statement-panel">
                            <div class="flex justify-between items-center mb-3">
                                <div class="font-medium">题面 {{ index + 1 }}</div>
                                <Button
                                    v-if="form.statements.length > 1"
                                    icon="pi pi-times"
                                    text
                                    severity="danger"
                                    @click="removeStatement(index)"
                                />
                            </div>
                            <div class="grid form-grid-inner">
                                <div class="col-12 md:col-3">
                                    <label class="font-medium text-xs mb-1 block">语言代码</label>
                                    <InputText
                                        v-model="statement.langCode"
                                        placeholder="例如 zh-CN"
                                        class="w-full"
                                    />
                                </div>
                                <div class="col-12 md:col-9">
                                    <label class="font-medium text-xs mb-1 block">题面标题</label>
                                    <InputText v-model="statement.title" placeholder="题面标题" class="w-full" />
                                </div>
                                <div class="col-12">
                                    <label class="font-medium text-xs mb-1 block">题面描述 (Markdown)</label>
                                    <Textarea
                                        v-model="statement.descriptionMd"
                                        autoResize
                                        :rows="5"
                                        placeholder="填写题面描述"
                                        class="w-full"
                                    />
                                </div>
                                <div class="col-12">
                                    <label class="font-medium text-xs mb-1 block">约束说明 (可选)</label>
                                    <Textarea
                                        v-model="statement.constraintsMd"
                                        autoResize
                                        :rows="3"
                                        placeholder="填写输入输出约束"
                                        class="w-full"
                                    />
                                </div>
                                <div class="col-12">
                                    <label class="font-medium text-xs mb-1 block">示例说明 (可选)</label>
                                    <Textarea
                                        v-model="statement.examplesMd"
                                        autoResize
                                        :rows="3"
                                        placeholder="填写样例"
                                        class="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            type="button"
                            label="添加题面"
                            icon="pi pi-plus"
                            outlined
                            @click="addStatement"
                        />
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="field">
                    <label class="font-medium text-sm mb-2 block">编程语言配置</label>
                    <div class="flex flex-column gap-4">
                        <div v-for="(config, index) in form.languageConfigs" :key="index" class="language-panel">
                            <div class="flex justify-between items-center mb-3">
                                <div class="font-medium">语言配置 {{ index + 1 }}</div>
                                <Button icon="pi pi-times" text severity="danger" @click="removeLanguageConfig(index)" />
                            </div>
                            <div class="grid form-grid-inner">
                                <div class="col-12 md:col-4">
                                    <label class="font-medium text-xs mb-1 block">语言</label>
                                    <Dropdown
                                        v-model="config.languageId"
                                        :options="languageSelectOptions"
                                        optionLabel="label"
                                        optionValue="value"
                                        placeholder="选择语言"
                                        class="w-full"
                                    />
                                </div>
                                <div class="col-12 md:col-4">
                                    <label class="font-medium text-xs mb-1 block">入口函数名 (可选)</label>
                                    <InputText
                                        v-model="config.functionName"
                                        placeholder="如 main 或 solution"
                                        class="w-full"
                                    />
                                </div>
                                <div class="col-12">
                                    <label class="font-medium text-xs mb-1 block">初始代码 (可选)</label>
                                    <Textarea
                                        v-model="config.starterCode"
                                        autoResize
                                        :rows="4"
                                        placeholder="填写默认代码模板"
                                        class="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            type="button"
                            label="添加语言配置"
                            icon="pi pi-plus"
                            outlined
                            @click="addLanguageConfig"
                        />
                        <div v-if="!languages.length" class="text-color-secondary text-sm">
                            当前没有可用的判题语言选项，仍可先保存题目，后续再补充语言配置。
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-12">
                <div class="field">
                    <label class="font-medium text-sm mb-1 block">元数据 (JSON，可选)</label>
                    <Textarea
                        v-model="form.metaText"
                        autoResize
                        :rows="4"
                        placeholder='{ "source": "LeetCode", "frequency": "高" }'
                        class="w-full"
                    />
                </div>
            </div>

            <div class="col-12 flex justify-end gap-2 mt-2">
                <Button type="button" label="取消" severity="secondary" @click="closeDialog" />
                <Button type="submit" label="保存" icon="pi pi-check" :loading="saving" />
            </div>
        </form>
    </Dialog>
</template>

<style scoped>
.field {
    display: flex;
    flex-direction: column;
}
.form-grid {
    gap: 1.5rem;
}
.form-grid-inner {
    gap: 1rem;
}
.statement-panel,
.language-panel {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1.25rem;
}
</style>
