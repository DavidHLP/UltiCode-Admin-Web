<script setup lang="ts">
import { CategoryType, CategoryTypeLabel, ProblemDifficulty, ProblemType, createProblem, deleteProblem, fetchProblem, updateProblem, type Problem, type QueryProblemPayload, type UpsertProblemPayload } from '@/api/problem';
import { emitErrorToast, emitSuccessToast } from '@/utils/toast';
import { useConfirm } from 'primevue/useconfirm';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

interface StatusOption<T> {
    label: string;
    value: T;
}

interface LoadProblemOptions {
    silent?: boolean;
}

interface ProblemForm {
    problemId?: number | string;
    problemType: ProblemType | '';
    solutionFunctionName: string;
    title: string;
    description: string;
    difficulty: ProblemDifficulty | '';
    category: CategoryType | '';
    tagsText: string;
    isVisible: boolean;
}

const problems = ref<Problem[]>([]);
const loading = ref(false);
const totalRecords = ref(0);
const currentPage = ref(1);
const rows = ref(10);
const keyword = ref('');
const selectedDifficulty = ref<ProblemDifficulty | null>(null);
const selectedCategory = ref<CategoryType | null>(null);
const selectedVisibility = ref<boolean | null>(null);
const rowsPerPageOptions = [10, 20, 50];

const difficultyOptions: StatusOption<ProblemDifficulty | null>[] = [
    { label: '全部难度', value: null },
    { label: '简单', value: ProblemDifficulty.EASY },
    { label: '中等', value: ProblemDifficulty.MEDIUM },
    { label: '困难', value: ProblemDifficulty.HARD }
];

const difficultyFormOptions = computed(() => difficultyOptions.filter((option) => option.value !== null) as StatusOption<ProblemDifficulty>[]);

const categoryOptions: StatusOption<CategoryType | null>[] = [
    { label: '全部分类', value: null },
    ...Object.values(CategoryType).map((category) => ({
        label: CategoryTypeLabel[category],
        value: category
    }))
];

const categoryFormOptions = computed(() => categoryOptions.filter((option) => option.value !== null) as StatusOption<CategoryType>[]);

const visibilityOptions: StatusOption<boolean | null>[] = [
    { label: '全部可见性', value: null },
    { label: '显示', value: true },
    { label: '隐藏', value: false }
];

const visibilityFormOptions = computed(() => visibilityOptions.filter((option) => option.value !== null) as StatusOption<boolean>[]);

const problemTypeOptions: StatusOption<ProblemType>[] = [
    { label: 'ACM', value: ProblemType.ACM },
    { label: 'OI', value: ProblemType.OI }
];

const confirm = useConfirm();

let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestToken = 0;

const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const dialogLoading = ref(false);
const form = reactive<ProblemForm>(getEmptyForm());
const formErrors = reactive<{
    problemType?: string;
    solutionFunctionName?: string;
    title?: string;
    description?: string;
    difficulty?: string;
    category?: string;
}>({});

const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新建题目' : '编辑题目'));
const isEditMode = computed(() => dialogMode.value === 'edit');

async function loadProblems(paramsOverride: Partial<QueryProblemPayload> = {}, options: LoadProblemOptions = {}) {
    const { silent = false } = options;
    const requestId = ++requestToken;
    let loadingTimer: ReturnType<typeof setTimeout> | undefined;

    if (!silent) {
        loadingTimer = setTimeout(() => {
            loading.value = true;
        }, 120);
    }

    const payload: QueryProblemPayload = {
        page: currentPage.value,
        pageSize: rows.value,
        size: rows.value,
        keyword: keyword.value.trim() || undefined,
        difficulty: selectedDifficulty.value ?? undefined,
        category: selectedCategory.value ?? undefined,
        isVisible: selectedVisibility.value ?? undefined,
        ...paramsOverride
    };

    try {
        const data = await fetchProblem(payload);
        if (requestId !== requestToken) {
            return;
        }

        const normalizedRecords = normalizePageRecords(data);
        problems.value = normalizedRecords.length > 0 ? normalizedRecords : (data.records ?? []);

        const normalizedTotal = extractNumericField(data, ['total', 'count', 'length'], problems.value.length);
        totalRecords.value = normalizedTotal;

        const normalizedCurrent = extractNumericField(data, ['current', 'pageNum', 'page'], currentPage.value);
        if (normalizedCurrent) {
            currentPage.value = normalizedCurrent;
        }

        const normalizedSize = extractNumericField(data, ['size', 'pageSize', 'limit'], rows.value);
        if (normalizedSize) {
            rows.value = normalizedSize;
        }
    } catch (error) {
        if (requestId === requestToken) {
            console.error('获取题目列表失败:', error);
            emitErrorToast('获取题目列表失败，请稍后重试');
        }
    } finally {
        if (requestId === requestToken) {
            if (loadingTimer) {
                clearTimeout(loadingTimer);
            }
            if (!silent) {
                loading.value = false;
            } else if (loading.value) {
                loading.value = false;
            }
        }
    }
}

function normalizePageRecords(source: unknown): Problem[] {
    const candidates: unknown[] = [];

    if (source && typeof source === 'object') {
        const recordSource = source as Record<string, unknown>;
        candidates.push(recordSource.records);
        candidates.push(recordSource.list);
        candidates.push(recordSource['java.util.ArrayList']);
        candidates.push(...Object.values(recordSource).filter((value) => Array.isArray(value)));
    }

    candidates.push(source);

    for (const candidate of candidates) {
        const normalized = extractArray(candidate);
        if (normalized.length) {
            return normalized;
        }
    }

    return [];
}

function extractArray(value: unknown): Problem[] {
    if (Array.isArray(value)) {
        if (value.length === 2 && typeof value[0] === 'string' && value[0].includes('java.util.ArrayList') && Array.isArray(value[1])) {
            return value[1] as Problem[];
        }
        if (value.every((item) => typeof item === 'object' || item === null)) {
            return value as Problem[];
        }
    }
    return [];
}

function extractNumericField(source: unknown, keys: string[], fallback: number): number {
    if (source && typeof source === 'object') {
        const objectSource = source as Record<string, unknown>;
        for (const key of keys) {
            const value = objectSource[key];
            const numeric = normalizeNumber(value);
            if (numeric !== undefined) {
                return numeric;
            }
        }
    }
    const numeric = normalizeNumber(source);
    return numeric !== undefined ? numeric : fallback;
}

function normalizeNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return undefined;
}

function handlePageChange(event: { page: number; rows: number }) {
    currentPage.value = event.page + 1;
    rows.value = event.rows;
    loadProblems({ page: currentPage.value, pageSize: rows.value, size: rows.value });
}

function handleKeywordInput(value: string | undefined) {
    keyword.value = value ?? '';
    currentPage.value = 1;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        loadProblems({ page: currentPage.value });
    }, 300);
}

function handleDifficultyChange(value: ProblemDifficulty | null | undefined) {
    selectedDifficulty.value = value ?? null;
    currentPage.value = 1;
    loadProblems({ page: currentPage.value });
}

function handleCategoryChange(value: CategoryType | null | undefined) {
    selectedCategory.value = value ?? null;
    currentPage.value = 1;
    loadProblems({ page: currentPage.value });
}

function handleVisibilityChange(value: boolean | null | undefined) {
    selectedVisibility.value = value ?? null;
    currentPage.value = 1;
    loadProblems({ page: currentPage.value });
}

function refresh() {
    loadProblems({}, { silent: true });
}

function clearFilters() {
    keyword.value = '';
    selectedDifficulty.value = null;
    selectedCategory.value = null;
    selectedVisibility.value = null;
    currentPage.value = 1;
    loadProblems({ page: currentPage.value });
}

function getEmptyForm(): ProblemForm {
    return {
        problemId: undefined,
        problemType: '',
        solutionFunctionName: '',
        title: '',
        description: '',
        difficulty: '',
        category: '',
        tagsText: '',
        isVisible: true
    };
}

function resetForm(record?: Problem) {
    const base = getEmptyForm();
    if (record) {
        base.problemId = record.id;
        base.problemType = record.problemType ?? '';
        base.solutionFunctionName = record.solutionFunctionName ?? '';
        base.title = record.title ?? '';
        base.description = record.description ?? '';
        base.difficulty = record.difficulty ?? '';
        base.category = record.category ?? '';
        base.tagsText = Array.isArray(record.tags) ? record.tags.join(',') : '';
        base.isVisible = record.isVisible ?? true;
    }
    Object.assign(form, base);
    clearFormErrors();
}

function clearFormErrors() {
    formErrors.problemType = undefined;
    formErrors.solutionFunctionName = undefined;
    formErrors.title = undefined;
    formErrors.description = undefined;
    formErrors.difficulty = undefined;
    formErrors.category = undefined;
}

function openCreateDialog() {
    dialogMode.value = 'create';
    resetForm();
    dialogVisible.value = true;
}

function openEditDialog(record: Problem) {
    dialogMode.value = 'edit';
    resetForm(record);
    dialogVisible.value = true;
}

function onDialogHide() {
    resetForm();
}

function validateForm(): boolean {
    clearFormErrors();
    let valid = true;

    if (!form.problemType) {
        formErrors.problemType = '请选择题目类型';
        valid = false;
    }

    if (!form.solutionFunctionName.trim()) {
        formErrors.solutionFunctionName = '请输入函数名称';
        valid = false;
    }

    if (!form.title.trim()) {
        formErrors.title = '请输入题目标题';
        valid = false;
    }

    if (!form.description.trim()) {
        formErrors.description = '请输入题目描述';
        valid = false;
    }

    if (!form.difficulty) {
        formErrors.difficulty = '请选择难度';
        valid = false;
    }

    if (!form.category) {
        formErrors.category = '请选择分类';
        valid = false;
    }

    return valid;
}

function buildPayload(): UpsertProblemPayload {
    const tags = form.tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

    return {
        problemType: form.problemType as ProblemType,
        solutionFunctionName: form.solutionFunctionName.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        difficulty: form.difficulty as ProblemDifficulty,
        category: form.category as CategoryType,
        tags: tags.length ? tags : null,
        isVisible: form.isVisible
    };
}

async function submitForm() {
    if (!validateForm()) {
        return;
    }

    dialogLoading.value = true;

    try {
        const payload = buildPayload();
        if (dialogMode.value === 'create') {
            await createProblem(payload);
            emitSuccessToast('新建题目成功');
            currentPage.value = 1;
            await loadProblems({ page: 1 });
        } else if (form.problemId !== undefined) {
            await updateProblem(form.problemId, payload);
            emitSuccessToast('更新题目成功');
            await loadProblems({ page: currentPage.value });
        }
        dialogVisible.value = false;
    } catch (error) {
        console.error('保存题目失败:', error);
        emitErrorToast('保存题目失败，请稍后重试');
    } finally {
        dialogLoading.value = false;
    }
}

function confirmDeleteProblem(record: Problem) {
    confirm.require({
        message: `确认删除题目「${record.title}」吗？`,
        header: '删除题目',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: '取消',
        acceptLabel: '删除',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                if (record.id === undefined) {
                    throw new Error('题目缺少有效的 ID');
                }
                await deleteProblem(record.id);
                emitSuccessToast('删除题目成功');
                if (problems.value.length <= 1 && currentPage.value > 1) {
                    currentPage.value -= 1;
                }
                await loadProblems({ page: currentPage.value });
            } catch (error) {
                console.error('删除题目失败:', error);
                emitErrorToast('删除题目失败，请稍后重试');
            }
        }
    });
}

function resolveDifficultyMeta(difficulty?: ProblemDifficulty | null) {
    switch (difficulty) {
        case ProblemDifficulty.EASY:
            return { label: '简单', severity: 'success' as const };
        case ProblemDifficulty.MEDIUM:
            return { label: '中等', severity: 'warning' as const };
        case ProblemDifficulty.HARD:
            return { label: '困难', severity: 'danger' as const };
        default:
            return { label: '未知', severity: 'secondary' as const };
    }
}

function resolveVisibilityMeta(visible?: boolean | null) {
    if (visible === true) {
        return { label: '显示', severity: 'success' as const };
    }
    if (visible === false) {
        return { label: '隐藏', severity: 'danger' as const };
    }
    return { label: '未知', severity: 'secondary' as const };
}

function resolveCategoryLabel(category?: CategoryType | null) {
    if (!category) {
        return '未知分类';
    }
    return CategoryTypeLabel[category] ?? category;
}

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

function formatDate(value?: string | null) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return dateTimeFormatter.format(parsed);
}

function formatTags(tags?: string[] | null) {
    if (!Array.isArray(tags) || tags.length === 0) {
        return '未设置';
    }
    return tags.join(', ');
}

function formatSubmissionRate(problem: Problem) {
    const solved = problem.solvedCount ?? 0;
    const submissions = problem.submissionCount ?? 0;
    if (submissions === 0) {
        return '暂无提交';
    }
    const rate = (solved / submissions) * 100;
    return `${solved}/${submissions} (${rate.toFixed(1)}%)`;
}

onMounted(() => {
    loadProblems();
});

onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <ConfirmDialog />
                <div class="font-semibold text-xl mb-4">题目列表</div>
                <DataTable
                    :value="problems"
                    dataKey="id"
                    :loading="loading"
                    :rowHover="true"
                    :paginator="true"
                    :rows="rows"
                    :rowsPerPageOptions="rowsPerPageOptions"
                    :lazy="true"
                    :totalRecords="totalRecords"
                    :first="(currentPage - 1) * rows"
                    showGridlines
                    @page="handlePageChange"
                >
                    <template #header>
                        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div class="flex flex-wrap items-center gap-3">
                                <Button type="button" icon="pi pi-filter-slash" label="重置" outlined @click="clearFilters" />
                                <IconField iconPosition="left">
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText :modelValue="keyword" placeholder="搜索题目标题/函数名" @update:modelValue="handleKeywordInput" />
                                </IconField>
                                <Select :modelValue="selectedDifficulty" :options="difficultyOptions" optionLabel="label" optionValue="value" placeholder="筛选难度" showClear class="w-12rem" @update:modelValue="handleDifficultyChange" />
                                <Select :modelValue="selectedCategory" :options="categoryOptions" optionLabel="label" optionValue="value" placeholder="筛选分类" showClear class="w-12rem" @update:modelValue="handleCategoryChange" />
                                <Select :modelValue="selectedVisibility" :options="visibilityOptions" optionLabel="label" optionValue="value" placeholder="可见性" showClear class="w-10rem" @update:modelValue="handleVisibilityChange" />
                            </div>
                            <div class="flex items-center gap-2">
                                <Button icon="pi pi-refresh" label="刷新" severity="secondary" outlined :loading="loading" @click="refresh" />
                                <Button icon="pi pi-plus" label="新建题目" severity="success" outlined @click="openCreateDialog" />
                            </div>
                        </div>
                    </template>
                    <template #empty> 暂无题目数据 </template>
                    <template #loading> 正在加载题目，请稍候… </template>

                    <Column field="id" header="ID" style="width: 6rem" sortable>
                        <template #body="{ data }">
                            <span class="font-medium text-sm">{{ data.id }}</span>
                        </template>
                    </Column>

                    <Column field="title" header="题目" style="min-width: 20rem">
                        <template #body="{ data }">
                            <div class="flex flex-col gap-1">
                                <span class="font-semibold">{{ data.title }}</span>
                                <small class="text-color-secondary">{{ data.solutionFunctionName }}</small>
                            </div>
                        </template>
                    </Column>

                    <Column field="problemType" header="类型" style="width: 6rem">
                        <template #body="{ data }">
                            <Tag :value="data.problemType" severity="info" rounded />
                        </template>
                    </Column>

                    <Column field="difficulty" header="难度" style="width: 7rem">
                        <template #body="{ data }">
                            <Tag :value="resolveDifficultyMeta(data.difficulty).label" :severity="resolveDifficultyMeta(data.difficulty).severity" rounded />
                        </template>
                    </Column>

                    <Column field="category" header="分类" style="min-width: 10rem">
                        <template #body="{ data }">
                            <Tag :value="resolveCategoryLabel(data.category)" severity="secondary" rounded />
                        </template>
                    </Column>

                    <Column field="tags" header="标签" style="min-width: 12rem">
                        <template #body="{ data }">
                            <span>{{ formatTags(data.tags) }}</span>
                        </template>
                    </Column>

                    <Column header="提交统计" style="min-width: 12rem">
                        <template #body="{ data }">
                            <span>{{ formatSubmissionRate(data) }}</span>
                        </template>
                    </Column>

                    <Column field="isVisible" header="可见性" style="width: 7rem">
                        <template #body="{ data }">
                            <Tag :value="resolveVisibilityMeta(data.isVisible).label" :severity="resolveVisibilityMeta(data.isVisible).severity" rounded />
                        </template>
                    </Column>

                    <Column field="createdAt" header="创建时间" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ formatDate(data.createdAt) }}</span>
                        </template>
                    </Column>

                    <Column field="updatedAt" header="更新时间" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span>{{ formatDate(data.updatedAt) }}</span>
                        </template>
                    </Column>

                    <Column header="操作" style="width: 10rem" bodyClass="text-right">
                        <template #body="{ data }">
                            <div class="flex justify-end gap-2">
                                <Button icon="pi pi-pencil" label="编辑" severity="secondary" text size="small" @click="openEditDialog(data)" />
                                <Button icon="pi pi-trash" label="删除" severity="danger" text size="small" @click="confirmDeleteProblem(data)" />
                            </div>
                        </template>
                    </Column>

                    <template #footer>
                        <div class="flex flex-wrap justify-between gap-2 text-sm text-color-secondary">
                            <span>共 {{ totalRecords }} 道题目</span>
                            <span>每页 {{ rows }} 条</span>
                        </div>
                    </template>
                </DataTable>

                <Dialog v-model:visible="dialogVisible" :modal="true" :header="dialogTitle" :style="{ width: '640px' }" :closable="!dialogLoading" :draggable="false" contentClass="p-0" @hide="onDialogHide">
                    <form class="flex flex-col gap-5 p-6" @submit.prevent="submitForm">
                        <div class="grid gap-5 md:grid-cols-2">
                            <div class="flex flex-col w-full">
                                <label for="title" class="text-sm font-medium text-color-secondary">题目标题</label>
                                <InputText id="title" v-model.trim="form.title" :invalid="!!formErrors.title" placeholder="请输入题目标题" class="w-full" />
                                <Transition name="fade">
                                    <small v-if="formErrors.title" class="block mt-1 text-xs text-red-500">
                                        {{ formErrors.title }}
                                    </small>
                                </Transition>
                            </div>

                            <div class="flex flex-col w-full">
                                <label for="solutionFunctionName" class="text-sm font-medium text-color-secondary">函数名称</label>
                                <InputText id="solutionFunctionName" v-model.trim="form.solutionFunctionName" :invalid="!!formErrors.solutionFunctionName" placeholder="请输入函数名称" class="w-full" />
                                <Transition name="fade">
                                    <small v-if="formErrors.solutionFunctionName" class="block mt-1 text-xs text-red-500">
                                        {{ formErrors.solutionFunctionName }}
                                    </small>
                                </Transition>
                            </div>

                            <FloatLabel class="w-full" variant="on">
                                <Select id="problemType" v-model="form.problemType" :options="problemTypeOptions" optionLabel="label" optionValue="value" :invalid="!!formErrors.problemType" class="w-full" />
                                <label for="problemType">题目类型</label>
                            </FloatLabel>
                            <Transition name="fade">
                                <small v-if="formErrors.problemType" class="block -mt-3 text-xs text-red-500">
                                    {{ formErrors.problemType }}
                                </small>
                            </Transition>

                            <FloatLabel class="w-full" variant="on">
                                <Select id="difficulty" v-model="form.difficulty" :options="difficultyFormOptions" optionLabel="label" optionValue="value" :invalid="!!formErrors.difficulty" class="w-full" />
                                <label for="difficulty">题目难度</label>
                            </FloatLabel>
                            <Transition name="fade">
                                <small v-if="formErrors.difficulty" class="block -mt-3 text-xs text-red-500">
                                    {{ formErrors.difficulty }}
                                </small>
                            </Transition>

                            <FloatLabel class="w-full" variant="on">
                                <Select id="category" v-model="form.category" :options="categoryFormOptions" optionLabel="label" optionValue="value" :invalid="!!formErrors.category" class="w-full" />
                                <label for="category">所属分类</label>
                            </FloatLabel>
                            <Transition name="fade">
                                <small v-if="formErrors.category" class="block -mt-3 text-xs text-red-500">
                                    {{ formErrors.category }}
                                </small>
                            </Transition>

                            <FloatLabel class="w-full" variant="on">
                                <Select id="visible" v-model="form.isVisible" :options="visibilityFormOptions" optionLabel="label" optionValue="value" class="w-full" />
                                <label for="visible">是否可见</label>
                            </FloatLabel>

                            <div class="flex flex-col w-full md:col-span-2">
                                <label for="tags" class="text-sm font-medium text-color-secondary">标签（以逗号分隔）</label>
                                <InputText id="tags" v-model.trim="form.tagsText" placeholder="例如：数组, 动态规划" class="w-full" />
                            </div>

                            <div class="flex flex-col w-full md:col-span-2">
                                <label for="description" class="text-sm font-medium text-color-secondary">题目描述</label>
                                <Textarea id="description" v-model.trim="form.description" :invalid="!!formErrors.description" rows="6" autoResize class="w-full" />
                                <Transition name="fade">
                                    <small v-if="formErrors.description" class="block mt-1 text-xs text-red-500">
                                        {{ formErrors.description }}
                                    </small>
                                </Transition>
                            </div>
                        </div>

                        <Divider class="my-1" />

                        <div class="flex justify-end gap-2 mt-2">
                            <Button type="button" label="取消" severity="secondary" outlined :disabled="dialogLoading" @click="dialogVisible = false" />
                            <Button type="submit" label="保存" :loading="dialogLoading" />
                        </div>
                    </form>
                </Dialog>
            </div>
        </div>
    </div>
</template>

<style scoped>
.text-color-secondary {
    color: var(--text-color-secondary);
}
</style>
