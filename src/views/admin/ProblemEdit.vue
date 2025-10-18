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
import { Editor as MarkdownEditor } from '@bytemd/vue-next';
import gfmPlugin from '@bytemd/plugin-gfm';
import highlightPlugin from '@bytemd/plugin-highlight';
import mathPlugin from '@bytemd/plugin-math';
import mermaidPlugin from '@bytemd/plugin-mermaid';
import { useToast } from 'primevue/usetoast';
import MonacoEditor from 'monaco-editor-vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import 'bytemd/dist/index.css';
import 'katex/dist/katex.css';
import 'highlight.js/styles/github.css';

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

const baseMonacoOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontSize: 14,
    formatOnPaste: true,
    formatOnType: true,
    lineNumbers: 'on' as const
};

const markdownPlugins = [
    gfmPlugin(),
    highlightPlugin(),
    mathPlugin(),
    mermaidPlugin()
];

const codeEditorOptions = {
    ...baseMonacoOptions,
    wordWrap: 'off' as const
};

const jsonEditorOptions = {
    ...baseMonacoOptions,
    tabSize: 2,
    wordWrap: 'on' as const
};

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

const activeStatementIndex = ref(0);

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

const languagesById = computed(() => {
    const map = new Map<number, LanguageOption>();
    for (const lang of languages.value) {
        if (lang.id !== undefined && lang.id !== null) {
            map.set(lang.id, lang);
        }
    }
    return map;
});

const saveDisabled = computed(() => saving.value || (loading.value && !initialised.value));

onMounted(async () => {
    await initialise();
});

watch(
    () => route.params.problemId,
    async () => {
        await initialise();
    }
);

watch(
    () => form.statements.length,
    (length) => {
        if (length === 0) {
            form.statements.push(createEmptyStatement());
            activeStatementIndex.value = 0;
        } else if (activeStatementIndex.value >= length) {
            activeStatementIndex.value = length - 1;
        } else if (activeStatementIndex.value < 0) {
            activeStatementIndex.value = 0;
        }
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
    form.statements = [createEmptyStatement()];
    form.languageConfigs = [];
    form.metaText = '';
    activeStatementIndex.value = 0;
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
                    : [createEmptyStatement()];
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
    activeStatementIndex.value = 0;
}

function createEmptyStatement(lang: string = DEFAULT_LANG_CODE): StatementForm {
    return {
        langCode: lang,
        title: '',
        descriptionMd: '',
        constraintsMd: '',
        examplesMd: ''
    };
}

function createEmptyLanguageConfig(): LanguageConfigForm {
    const defaultLanguageId = languages.value[0]?.id ?? null;
    return {
        languageId: defaultLanguageId,
        functionName: '',
        starterCode: ''
    };
}

function addStatement(afterIndex?: number) {
    const referenceLang =
            typeof afterIndex === 'number' && form.statements[afterIndex]
                    ? form.statements[afterIndex].langCode ?? DEFAULT_LANG_CODE
                    : DEFAULT_LANG_CODE;
    const newStatement = createEmptyStatement(referenceLang);
    if (typeof afterIndex === 'number' && afterIndex >= 0) {
        form.statements.splice(afterIndex + 1, 0, newStatement);
        activeStatementIndex.value = afterIndex + 1;
    } else {
        form.statements.push(newStatement);
        activeStatementIndex.value = form.statements.length - 1;
    }
}

function duplicateStatement(index: number) {
    const original = form.statements[index];
    const clone = createEmptyStatement(original.langCode);
    clone.title = original.title ? `${original.title} (副本)` : '';
    clone.descriptionMd = original.descriptionMd;
    clone.constraintsMd = original.constraintsMd;
    clone.examplesMd = original.examplesMd;
    form.statements.splice(index + 1, 0, clone);
    activeStatementIndex.value = index + 1;
}

function moveStatement(index: number, offset: number) {
    const newIndex = index + offset;
    if (newIndex < 0 || newIndex >= form.statements.length) {
        return;
    }
    const [statement] = form.statements.splice(index, 1);
    form.statements.splice(newIndex, 0, statement);
    activeStatementIndex.value = newIndex;
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
    if (activeStatementIndex.value >= form.statements.length) {
        activeStatementIndex.value = form.statements.length - 1;
    }
}

function statementTitle(index: number): string {
    const statement = form.statements[index];
    const trimmed = statement.title?.trim();
    if (trimmed) {
        return trimmed;
    }
    return `题面 ${index + 1}`;
}

function statementLanguageLabel(statement: StatementForm): string {
    const trimmed = statement.langCode?.trim();
    return trimmed || '未设置语言';
}

function setActiveStatement(index: number) {
    if (index >= 0 && index < form.statements.length) {
        activeStatementIndex.value = index;
    }
}

function updateStatementMarkdown(field: 'descriptionMd' | 'constraintsMd' | 'examplesMd', value: string) {
    const statement = form.statements[activeStatementIndex.value];
    if (!statement) {
        return;
    }
    statement[field] = value ?? '';
}

function addLanguageConfig(afterIndex?: number) {
    const config = createEmptyLanguageConfig();
    if (typeof afterIndex === 'number' && afterIndex >= 0) {
        form.languageConfigs.splice(afterIndex + 1, 0, config);
    } else {
        form.languageConfigs.push(config);
    }
}

function duplicateLanguageConfig(index: number) {
    const original = form.languageConfigs[index];
    const clone: LanguageConfigForm = {
        languageId: original.languageId,
        functionName: original.functionName ?? '',
        starterCode: original.starterCode ?? ''
    };
    form.languageConfigs.splice(index + 1, 0, clone);
}

function moveLanguageConfig(index: number, offset: number) {
    const newIndex = index + offset;
    if (newIndex < 0 || newIndex >= form.languageConfigs.length) {
        return;
    }
    const [config] = form.languageConfigs.splice(index, 1);
    form.languageConfigs.splice(newIndex, 0, config);
}

function removeLanguageConfig(index: number) {
    form.languageConfigs.splice(index, 1);
}

function editorLanguageForConfig(config: LanguageConfigForm): string {
    if (config.languageId == null) {
        return 'plaintext';
    }
    const language = languagesById.value.get(config.languageId);
    return inferMonacoLanguage(language?.code);
}

function getLanguageDisplayName(languageId: number | null): string {
    if (languageId === null || languageId === undefined) {
        return '未选择语言';
    }
    const language = languagesById.value.get(languageId);
    return language?.displayName ?? `语言 ${languageId}`;
}

function inferMonacoLanguage(code?: string | null): string {
    if (!code) {
        return 'plaintext';
    }
    const normalized = code.toLowerCase();
    if (normalized.includes('python')) {
        return 'python';
    }
    if (normalized.includes('java')) {
        return 'java';
    }
    if (normalized.includes('typescript') || normalized.includes('ts')) {
        return 'typescript';
    }
    if (normalized.includes('javascript') || normalized.includes('node') || normalized.includes('js')) {
        return 'javascript';
    }
    if (normalized.includes('cpp') || normalized.includes('c++')) {
        return 'cpp';
    }
    if (normalized.includes('c#') || normalized.includes('csharp') || normalized.includes('dotnet')) {
        return 'csharp';
    }
    if (normalized.includes('go')) {
        return 'go';
    }
    if (normalized.includes('rust')) {
        return 'rust';
    }
    if (normalized.includes('kotlin')) {
        return 'kotlin';
    }
    if (normalized.includes('swift')) {
        return 'swift';
    }
    if (normalized.includes('scala')) {
        return 'scala';
    }
    if (normalized.includes('php')) {
        return 'php';
    }
    if (normalized.includes('ruby')) {
        return 'ruby';
    }
    if (normalized.includes('sql')) {
        return 'sql';
    }
    if (normalized.includes('shell') || normalized.includes('bash') || normalized.includes('sh')) {
        return 'shell';
    }
    return 'plaintext';
}

function goBack() {
    router.push({ name: 'adminProblems' });
}

function formatMetaJson() {
    const metaText = form.metaText?.trim();
    if (!metaText) {
        return;
    }
    try {
        const parsed = JSON.parse(metaText);
        form.metaText = JSON.stringify(parsed, null, 2);
        toast.add({
            severity: 'success',
            summary: '格式化成功',
            detail: '已重新格式化元数据',
            life: 2000
        });
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '格式化失败',
            detail: (error as Error)?.message ?? 'JSON 解析失败',
            life: 3500
        });
    }
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
    <div class="grid problem-edit-page">
        <div class="col-12">
            <div class="card problem-editor-card">
                <div class="editor-toolbar">
                    <div class="editor-toolbar__title">
                        <h2 class="text-xl font-semibold mb-1">
                            {{ isEditMode ? '编辑题目' : '新建题目' }}
                        </h2>
                        <p class="text-color-secondary text-sm">
                            {{
                                isEditMode
                                    ? '更新题目信息、题面内容和判题配置'
                                    : '填写题目基础信息、题面内容及判题配置'
                            }}
                        </p>
                    </div>
                    <div class="editor-toolbar__actions">
                        <Button
                            type="button"
                            label="返回列表"
                            icon="pi pi-arrow-left"
                            severity="secondary"
                            @click="goBack"
                        />
                        <Button
                            type="button"
                            label="保存"
                            icon="pi pi-check"
                            :loading="saving"
                            :disabled="saveDisabled"
                            @click="submitForm"
                        />
                    </div>
                </div>

                <div v-if="loading && !initialised" class="editor-loading">
                    <ProgressSpinner style="width: 3rem; height: 3rem" strokeWidth="4" />
                </div>

                <form v-else class="editor-body" @submit.prevent="submitForm">
                    <div class="grid editor-main">
                        <div class="col-12 xl:col-4 editor-sidebar">
                            <section class="editor-section">
                                <div class="section-header">
                                    <h3>基本信息</h3>
                                    <span class="section-subtitle">题目标识与分类配置</span>
                                </div>
                                <div class="section-body">
                                    <div class="field">
                                        <label class="font-medium text-sm">题目别名 (slug)</label>
                                        <InputText v-model="form.slug" placeholder="two-sum" class="w-full" />
                                    </div>
                                    <div class="field">
                                        <label class="font-medium text-sm">题目类型</label>
                                        <Dropdown
                                            v-model="form.problemType"
                                            :options="problemTypeOptions"
                                            optionLabel="label"
                                            optionValue="value"
                                            class="w-full"
                                        />
                                    </div>
                                    <div class="field">
                                        <label class="font-medium text-sm">难度</label>
                                        <Dropdown
                                            v-model="form.difficultyId"
                                            :options="difficultyOptions"
                                            optionLabel="label"
                                            optionValue="value"
                                            class="w-full"
                                        />
                                    </div>
                                    <div class="field">
                                        <label class="font-medium text-sm">分类</label>
                                        <Dropdown
                                            v-model="form.categoryId"
                                            :options="categoryOptions"
                                            optionLabel="label"
                                            optionValue="value"
                                            :showClear="true"
                                            placeholder="请选择分类"
                                            class="w-full"
                                        />
                                    </div>
                                    <div class="field">
                                        <label class="font-medium text-sm">标签</label>
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
                            </section>

                            <section class="editor-section">
                                <div class="section-header">
                                    <h3>判题限制</h3>
                                    <span class="section-subtitle">运行环境与可见性</span>
                                </div>
                                <div class="section-body">
                                    <div class="grid small-gap">
                                        <div class="col-12">
                                            <label class="font-medium text-sm">创建者用户 ID (可选)</label>
                                            <InputNumber
                                                v-model="form.creatorId"
                                                placeholder="例如 10001"
                                                class="w-full"
                                                :useGrouping="false"
                                                :allowEmpty="true"
                                            />
                                        </div>
                                        <div class="col-12 md:col-6">
                                            <label class="font-medium text-sm">时间限制 (ms)</label>
                                            <InputNumber
                                                v-model="form.timeLimitMs"
                                                :useGrouping="false"
                                                :allowEmpty="true"
                                                placeholder="如 1000"
                                                class="w-full"
                                            />
                                        </div>
                                        <div class="col-12 md:col-6">
                                            <label class="font-medium text-sm">内存限制 (KB)</label>
                                            <InputNumber
                                                v-model="form.memoryLimitKb"
                                                :useGrouping="false"
                                                :allowEmpty="true"
                                                placeholder="如 262144"
                                                class="w-full"
                                            />
                                        </div>
                                        <div class="col-12">
                                            <label class="font-medium text-sm">参考解答入口 (可选)</label>
                                            <InputText
                                                v-model="form.solutionEntry"
                                                placeholder="如 solutions/solution.cpp"
                                                class="w-full"
                                            />
                                        </div>
                                        <div class="col-12">
                                            <label class="font-medium text-sm mb-1">公开状态</label>
                                            <div class="flex items-center gap-2">
                                                <InputSwitch v-model="form.isPublic" />
                                                <span>{{ form.isPublic ? '公开' : '私有' }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div class="col-12 xl:col-8 editor-content">
                            <section class="editor-section statement-section">
                                <div class="section-header with-actions">
                                    <div>
                                        <h3>题面内容</h3>
                                        <span class="section-subtitle">支持多语言 Markdown 描述</span>
                                    </div>
                                    <Button
                                        type="button"
                                        label="添加题面"
                                        icon="pi pi-plus"
                                        outlined
                                        @click="addStatement(form.statements.length - 1)"
                                    />
                                </div>
                                <div class="section-body statement-wrapper">
                                    <div class="statement-list">
                                        <div
                                            v-for="(statement, index) in form.statements"
                                            :key="`statement-${index}`"
                                            class="statement-item"
                                            :class="{ active: index === activeStatementIndex }"
                                            @click="setActiveStatement(index)"
                                        >
                                            <div class="statement-item-header">
                                                <div>
                                                    <div class="statement-item-title">
                                                        {{ statementTitle(index) }}
                                                    </div>
                                                    <div class="statement-item-lang">
                                                        {{ statementLanguageLabel(statement) }}
                                                    </div>
                                                </div>
                                                <div class="statement-item-actions">
                                                    <Button
                                                        v-if="form.statements.length > 1"
                                                        icon="pi pi-trash"
                                                        severity="danger"
                                                        text
                                                        rounded
                                                        @click.stop="removeStatement(index)"
                                                    />
                                                </div>
                                            </div>
                                            <div class="statement-item-footer">
                                                <Button
                                                    icon="pi pi-copy"
                                                    text
                                                    rounded
                                                    @click.stop="duplicateStatement(index)"
                                                />
                                                <Button
                                                    icon="pi pi-arrow-up"
                                                    text
                                                    rounded
                                                    :disabled="index === 0"
                                                    @click.stop="moveStatement(index, -1)"
                                                />
                                                <Button
                                                    icon="pi pi-arrow-down"
                                                    text
                                                    rounded
                                                    :disabled="index === form.statements.length - 1"
                                                    @click.stop="moveStatement(index, 1)"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div class="statement-editor-panel">
                                        <div
                                            v-if="form.statements[activeStatementIndex]"
                                            class="grid form-grid-inner"
                                        >
                                            <div class="col-12 md:col-4">
                                                <label class="font-medium text-xs mb-1 block">语言代码</label>
                                                <InputText
                                                    v-model="form.statements[activeStatementIndex].langCode"
                                                    placeholder="例如 zh-CN"
                                                    class="w-full"
                                                />
                                            </div>
                                            <div class="col-12 md:col-8">
                                                <label class="font-medium text-xs mb-1 block">题面标题</label>
                                                <InputText
                                                    v-model="form.statements[activeStatementIndex].title"
                                                    placeholder="题面标题"
                                                    class="w-full"
                                                />
                                            </div>
                                            <div class="col-12">
                                                <div class="markdown-block">
                                                    <label class="font-medium text-xs mb-1 block">
                                                        题面描述 (Markdown)
                                                    </label>
                                                    <MarkdownEditor
                                                        :value="form.statements[activeStatementIndex].descriptionMd"
                                                        :plugins="markdownPlugins"
                                                        placeholder="支持 Markdown、公式与 Mermaid 图表"
                                                        @change="(val: string) => updateStatementMarkdown('descriptionMd', val)"
                                                    />
                                                </div>
                                            </div>
                                            <div class="col-12">
                                                <div class="markdown-block">
                                                    <label class="font-medium text-xs mb-1 block">
                                                        约束说明 (可选)
                                                    </label>
                                                    <MarkdownEditor
                                                        :value="form.statements[activeStatementIndex].constraintsMd ?? ''"
                                                        :plugins="markdownPlugins"
                                                        placeholder="填写输入输出约束说明"
                                                        @change="(val: string) => updateStatementMarkdown('constraintsMd', val)"
                                                    />
                                                </div>
                                            </div>
                                            <div class="col-12">
                                                <div class="markdown-block">
                                                    <label class="font-medium text-xs mb-1 block">
                                                        示例说明 (可选)
                                                    </label>
                                                    <MarkdownEditor
                                                        :value="form.statements[activeStatementIndex].examplesMd ?? ''"
                                                        :plugins="markdownPlugins"
                                                        placeholder="可包含多组样例输入输出"
                                                        @change="(val: string) => updateStatementMarkdown('examplesMd', val)"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section class="editor-section">
                                <div class="section-header with-actions">
                                    <div>
                                        <h3>编程语言配置</h3>
                                        <span class="section-subtitle">维护入口函数与代码模板</span>
                                    </div>
                                    <Button
                                        type="button"
                                        label="添加语言配置"
                                        icon="pi pi-plus"
                                        outlined
                                        @click="addLanguageConfig(form.languageConfigs.length - 1)"
                                    />
                                </div>
                                <div class="section-body">
                                    <div
                                        v-if="!form.languageConfigs.length"
                                        class="empty-hint text-sm text-color-secondary"
                                    >
                                        当前没有语言配置，可根据需要添加不同语言的入口函数与默认代码。
                                    </div>
                                    <div v-else class="flex flex-column gap-4">
                                        <div
                                            v-for="(config, index) in form.languageConfigs"
                                            :key="`language-${index}`"
                                            class="language-panel"
                                        >
                                            <div class="language-panel__header">
                                                <div class="language-panel__title">
                                                    {{ getLanguageDisplayName(config.languageId) }}
                                                </div>
                                                <div class="language-panel__actions">
                                                    <Button
                                                        icon="pi pi-copy"
                                                        text
                                                        rounded
                                                        @click="duplicateLanguageConfig(index)"
                                                    />
                                                    <Button
                                                        icon="pi pi-arrow-up"
                                                        text
                                                        rounded
                                                        :disabled="index === 0"
                                                        @click="moveLanguageConfig(index, -1)"
                                                    />
                                                    <Button
                                                        icon="pi pi-arrow-down"
                                                        text
                                                        rounded
                                                        :disabled="index === form.languageConfigs.length - 1"
                                                        @click="moveLanguageConfig(index, 1)"
                                                    />
                                                    <Button
                                                        icon="pi pi-times"
                                                        text
                                                        rounded
                                                        severity="danger"
                                                        @click="removeLanguageConfig(index)"
                                                    />
                                                </div>
                                            </div>
                                            <div class="grid form-grid-inner">
                                                <div class="col-12 md:col-6">
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
                                                <div class="col-12 md:col-6">
                                                    <label class="font-medium text-xs mb-1 block"
                                                        >入口函数名 (可选)</label
                                                    >
                                                    <InputText
                                                        v-model="config.functionName"
                                                        placeholder="如 main 或 solution"
                                                        class="w-full"
                                                    />
                                                </div>
                                                <div class="col-12">
                                                    <div class="monaco-block">
                                                        <label class="font-medium text-xs mb-1 block">
                                                            初始代码模板 (可选)
                                                        </label>
                                                        <MonacoEditor
                                                            v-model:value="config.starterCode"
                                                            :language="editorLanguageForConfig(config)"
                                                            theme="vs-light"
                                                            height="240px"
                                                            :options="codeEditorOptions"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section class="editor-section">
                                <div class="section-header with-actions">
                                    <div>
                                        <h3>元数据</h3>
                                        <span class="section-subtitle">存储额外业务字段 (JSON 对象)</span>
                                    </div>
                                    <Button
                                        v-if="form.metaText"
                                        type="button"
                                        label="格式化"
                                        icon="pi pi-brush"
                                        text
                                        @click="formatMetaJson"
                                    />
                                </div>
                                <div class="section-body">
                                    <div class="monaco-block">
                                        <MonacoEditor
                                            v-model:value="form.metaText"
                                            language="json"
                                            theme="vs-light"
                                            height="260px"
                                            :options="jsonEditorOptions"
                                        />
                                        <small class="text-color-secondary text-xs">
                                            元数据会原样存入数据库并随题目详情返回，可用于记录来源、测试配置等信息。
                                        </small>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<style scoped>
.problem-edit-page {
    margin: 0;
}

.problem-editor-card {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.editor-toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    border-bottom: 1px solid var(--surface-border);
    padding-bottom: 1rem;
}

.editor-toolbar__actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.editor-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.editor-main {
    gap: 1.5rem;
}

.editor-section {
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    padding: 1.25rem;
    background: var(--surface-ground);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.section-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.section-header.with-actions {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
}

.section-subtitle {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.section-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.statement-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

@media (min-width: 992px) {
    .statement-wrapper {
        flex-direction: row;
    }
}

.statement-list {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
}

@media (min-width: 992px) {
    .statement-list {
        flex-direction: column;
        flex: 0 0 240px;
        max-height: 540px;
        overflow-y: auto;
        padding-right: 0.75rem;
    }
}

.statement-item {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    cursor: pointer;
    background: var(--surface-card);
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.statement-item:hover {
    border-color: var(--primary-color);
}

.statement-item.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px rgba(79, 111, 255, 0.12);
}

.statement-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.statement-item-title {
    font-weight: 600;
    font-size: 0.95rem;
}

.statement-item-lang {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    margin-top: 0.25rem;
}

.statement-item-footer {
    display: flex;
    gap: 0.25rem;
}

.statement-editor-panel {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.language-panel {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1rem;
    background: var(--surface-card);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.language-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.language-panel__title {
    font-weight: 600;
}

.language-panel__actions {
    display: flex;
    gap: 0.25rem;
}

.markdown-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.markdown-block :deep(.bytemd) {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-card);
    min-height: 220px;
}

.markdown-block :deep(.bytemd-editor),
.markdown-block :deep(.bytemd-preview) {
    background: transparent;
}

.markdown-block :deep(.bytemd-editor) {
    min-height: 180px;
}

.markdown-block :deep(.bytemd-preview) {
    padding: 1rem;
}

.markdown-block :deep(.bytemd-toolbar) {
    background: rgba(0, 0, 0, 0.02);
}

.monaco-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-grid-inner {
    gap: 1rem;
}

.small-gap {
    gap: 1rem;
}

.editor-sidebar,
.editor-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.statement-section {
    overflow: hidden;
}

.empty-hint {
    border-radius: 8px;
    padding: 1rem;
    background: var(--surface-ground);
}

.editor-loading {
    display: flex;
    justify-content: center;
    padding: 4rem 0;
}
</style>
