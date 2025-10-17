<script setup lang="ts">
import {
    createProblem,
    fetchProblem,
    fetchProblemOptions,
    updateProblem,
    type DictionaryOption,
    type LanguageOption,
    type ProblemDetail,
    type ProblemOptions,
    type ProblemUpsertPayload,
    type TagOption
} from '@/api/problem/problem';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

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

const route = useRoute();
const router = useRouter();
const toast = useToast();

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

const loading = ref(false);
const saving = ref(false);
const initialised = ref(false);

const problemId = computed(() => {
    const raw = route.params.problemId;
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
});

const isEditMode = computed(() => problemId.value !== null);

const problemTypeLabels: Record<string, string> = {
    coding: '编程题',
    sql: 'SQL',
    shell: 'Shell',
    concurrency: '并发题',
    interactive: '交互题',
    'output-only': '输出题'
};

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
const tagSelectOptions = computed(() =>
        tags.value.map((tag) => ({ label: tag.name, value: tag.id }))
);
const languageSelectOptions = computed(() =>
        languages.value.map((lang) => ({ label: lang.displayName, value: lang.id }))
);

onMounted(async () => {
    await initialise();
});

watch(
    () => route.params.problemId,
    async () => {
        await initialise();
    }
);

async function initialise() {
    loading.value = true;
    try {
        await loadOptions();
        resetForm();
        if (isEditMode.value && problemId.value !== null) {
            await loadProblemDetail(problemId.value);
        }
        initialised.value = true;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '初始化题目信息失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

async function loadOptions() {
    const options: ProblemOptions = await fetchProblemOptions();
    problemTypes.value = options.problemTypes ?? [];
    difficulties.value = options.difficulties ?? [];
    categories.value = options.categories ?? [];
    tags.value = options.tags ?? [];
    languages.value = options.languages ?? [];
}

async function loadProblemDetail(id: number) {
    const detail: ProblemDetail = await fetchProblem(id, { langCode: DEFAULT_LANG_CODE });
    fillForm(detail);
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

function fillForm(detail: ProblemDetail) {
    form.slug = detail.slug ?? '';
    form.problemType = detail.problemType ?? (problemTypes.value[0] ?? 'coding');
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

function goBack() {
    router.push({ name: 'adminProblems' });
}

async function submitForm() {
    if (!validateForm()) {
        return;
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
        if (isEditMode.value && problemId.value !== null) {
            await updateProblem(problemId.value, payload);
            toast.add({
                severity: 'success',
                summary: '更新成功',
                detail: '题目信息已更新',
                life: 3000
            });
        } else {
            await createProblem(payload);
            toast.add({
                severity: 'success',
                summary: '创建成功',
                detail: '题目已创建',
                life: 3000
            });
        }
        goBack();
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

function validateForm() {
    if (!form.slug.trim()) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入题目别名', life: 4000 });
        return false;
    }
    if (!form.problemType) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请选择题目类型', life: 4000 });
        return false;
    }
    if (!form.difficultyId) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请选择难度', life: 4000 });
        return false;
    }
    if (!form.statements.length) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '至少添加一份题面', life: 4000 });
        return false;
    }
    for (const statement of form.statements) {
        if (!statement.langCode.trim()) {
            toast.add({ severity: 'warn', summary: '校验失败', detail: '题面语言代码不能为空', life: 4000 });
            return false;
        }
        if (!statement.title.trim()) {
            toast.add({ severity: 'warn', summary: '校验失败', detail: '题面标题不能为空', life: 4000 });
            return false;
        }
        if (!statement.descriptionMd.trim()) {
            toast.add({ severity: 'warn', summary: '校验失败', detail: '题面描述不能为空', life: 4000 });
            return false;
        }
    }
    return true;
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h2 class="text-xl font-semibold mb-1">
                            {{ isEditMode ? '编辑题目' : '新建题目' }}
                        </h2>
                        <p class="text-color-secondary">
                            {{
                                isEditMode
                                    ? '更新题目信息、题面内容和判题配置'
                                    : '填写题目基本信息、题面内容及判题配置'
                            }}
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <Button label="返回列表" icon="pi pi-arrow-left" severity="secondary" @click="goBack" />
                        <Button label="保存" icon="pi pi-check" :loading="saving" @click="submitForm" />
                    </div>
                </div>

                <div v-if="loading && !initialised" class="flex justify-center py-6">
                    <ProgressSpinner style="width: 3rem; height: 3rem" strokeWidth="4" />
                </div>

                <form v-else class="grid form-grid" @submit.prevent="submitForm">
                    <div class="col-12 md:col-6">
                        <div class="field">
                            <label class="font-medium text-sm mb-1 block" for="slug">题目别名 (slug)</label>
                            <InputText id="slug" v-model="form.slug" placeholder="two-sum" class="w-full" />
                        </div>
                    </div>
                    <div class="col-12 md:col-3">
                        <div class="field">
                            <label class="font-medium text-sm mb-1 block" for="problemType">题目类型</label>
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
                            <label class="font-medium text-sm mb-1 block" for="difficultyId">难度</label>
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
                            <label class="font-medium text-sm mb-1 block" for="categoryId">分类</label>
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
                            <label class="font-medium text-sm mb-1 block" for="creatorId">创建者用户ID</label>
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
                            <label class="font-medium text-sm mb-1 block" for="solutionEntry">参考解答入口</label>
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
                            <label class="font-medium text-sm mb-1 block" for="timeLimit">时间限制 (ms)</label>
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
                            <label class="font-medium text-sm mb-1 block" for="memoryLimit">内存限制 (KB)</label>
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
                </form>
            </div>
        </div>
    </div>
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
