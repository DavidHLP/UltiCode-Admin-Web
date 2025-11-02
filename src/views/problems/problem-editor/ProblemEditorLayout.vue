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
} from '@/api/problem/problem.ts';
import gfmPlugin from '@bytemd/plugin-gfm';
import highlightPlugin from '@bytemd/plugin-highlight';
import mathPlugin from '@bytemd/plugin-math';
import mermaidPlugin from '@bytemd/plugin-mermaid';
import 'bytemd/dist/index.css';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.css';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import {
    problemEditorSymbol,
    type LanguageConfigForm,
    type ProblemEditorContext,
    type ProblemForm,
    type SelectionOption,
    type StatementForm
} from './context.ts';

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

const markdownPlugins = [gfmPlugin(), highlightPlugin(), mathPlugin(), mermaidPlugin()];

const codeEditorOptions = {
    ...baseMonacoOptions,
    wordWrap: 'off' as const
};

const jsonEditorOptions = {
    ...baseMonacoOptions,
    tabSize: 2,
    wordWrap: 'on' as const
};

type WorkerFactory = new () => Worker;

const workerFactories: Record<string, WorkerFactory> = {
    json: JsonWorker,
    css: CssWorker,
    scss: CssWorker,
    less: CssWorker,
    html: HtmlWorker,
    handlebars: HtmlWorker,
    razor: HtmlWorker,
    typescript: TsWorker,
    javascript: TsWorker
};

if (typeof window !== 'undefined') {
    const globalWithMonaco = globalThis as typeof globalThis & {
        MonacoEnvironment?: {
            getWorker?(moduleId: string, label: string): Worker;
        };
    };

    if (!globalWithMonaco.MonacoEnvironment) {
        globalWithMonaco.MonacoEnvironment = {
            getWorker(_moduleId: string, label: string) {
                const WorkerConstructor = workerFactories[label];
                if (WorkerConstructor) {
                    return new WorkerConstructor();
                }
                return new EditorWorker();
            }
        };
    }
}

const problemTypeLabels: Record<string, string> = {
    coding: '编程题',
    sql: 'SQL',
    shell: 'Shell',
    concurrency: '并发题',
    interactive: '交互题',
    'output-only': '输出题'
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
    activeDatasetId: null,
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

const difficultyOptions = computed<SelectionOption<number | null>[]>(() =>
    difficulties.value.map((item) => ({ label: item.name ?? item.code, value: item.id }))
);
const categoryOptions = computed<SelectionOption<number | null>[]>(() =>
    categories.value.map((item) => ({ label: item.name, value: item.id }))
);
const problemTypeOptions = computed<SelectionOption<string>[]>(() =>
    problemTypes.value.map((type) => ({
        label: problemTypeLabels[type] ?? type,
        value: type
    }))
);
const tagSelectOptions = computed<SelectionOption<number>[]>(() =>
    tags.value.map((tag) => ({ label: tag.name, value: tag.id }))
);
const languageSelectOptions = computed<SelectionOption<number>[]>(() =>
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

const activeStatement = computed<StatementForm | null>(() => form.statements[activeStatementIndex.value] ?? null);

const saveDisabled = computed(() => saving.value || (loading.value && !initialised.value));

const navPrefix = computed(() => (isEditMode.value ? 'adminProblemsEdit' : 'adminProblemsCreate'));

const navItems = computed(() => [
    { label: '基本信息', name: `${navPrefix.value}Basic` },
    { label: '题面内容', name: `${navPrefix.value}Statements` },
    { label: '判题配置', name: `${navPrefix.value}Configurations` }
]);

onMounted(async () => {
    await initialise();
});

onUnmounted(() => {
    resetEditorState();
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
    form.activeDatasetId = null;
    form.tagIds = [];
    form.statements = [createEmptyStatement()];
    form.languageConfigs = [];
    form.metaText = '';
    activeStatementIndex.value = 0;
}

function resetEditorState() {
    problemTypes.value = [];
    difficulties.value = [];
    categories.value = [];
    tags.value = [];
    languages.value = [];
    resetForm();
    loading.value = false;
    saving.value = false;
    initialised.value = false;
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
    form.activeDatasetId = detail.activeDatasetId ?? null;
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
        detail.meta && Object.keys(detail.meta).length ? JSON.stringify(detail.meta, null, 2) : '';
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
    if (!original) {
        return;
    }
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
    if (!statement) {
        return;
    }
    form.statements.splice(newIndex, 0, statement);
    activeStatementIndex.value = newIndex;
}

function removeStatement(index: number): boolean {
    if (form.statements.length <= 1) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: '至少保留一份题面',
            life: 3000
        });
        return false;
    }
    form.statements.splice(index, 1);
    if (activeStatementIndex.value >= form.statements.length) {
        activeStatementIndex.value = form.statements.length - 1;
    }
    return true;
}

function statementTitle(index: number): string {
    const statement = form.statements[index];
    if (!statement) {
        return `题面 ${index + 1}`;
    }
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

function updateStatementMarkdown(
    field: 'descriptionMd' | 'constraintsMd' | 'examplesMd',
    value: string
) {
    const statement = activeStatement.value;
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
    if (!original) {
        return;
    }
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
    if (!config) {
        return;
    }
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

provide(problemEditorSymbol, {
    form,
    loading,
    saving,
    initialised,
    saveDisabled,
    isEditMode,
    activeStatementIndex,
    activeStatement,
    problemTypeOptions,
    difficultyOptions,
    categoryOptions,
    tagSelectOptions,
    languageSelectOptions,
    markdownPlugins,
    codeEditorOptions,
    jsonEditorOptions,
    goBack,
    formatMetaJson,
    submitForm,
    addStatement,
    duplicateStatement,
    moveStatement,
    removeStatement,
    statementTitle,
    statementLanguageLabel,
    setActiveStatement,
    updateStatementMarkdown,
    addLanguageConfig,
    duplicateLanguageConfig,
    moveLanguageConfig,
    removeLanguageConfig,
    editorLanguageForConfig,
    getLanguageDisplayName
} satisfies ProblemEditorContext);
</script>

<template>
    <div class="grid problem-editor">
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
                        <Button type="button" label="返回列表" icon="pi pi-arrow-left" severity="secondary"
                            @click="goBack" />
                        <Button type="button" label="保存" icon="pi pi-check" :loading="saving" :disabled="saveDisabled"
                            @click="submitForm" />
                    </div>
                </div>

                <div class="editor-navigation">
                    <RouterLink v-for="item in navItems" :key="item.name" class="editor-navigation__item"
                        :class="{ active: route.name === item.name }"
                        :to="{ name: item.name as string, params: route.params, query: route.query }">
                        {{ item.label }}
                    </RouterLink>
                </div>

                <div v-if="loading && !initialised" class="editor-loading">
                    <ProgressSpinner style="width: 3rem; height: 3rem" strokeWidth="4" />
                </div>

                <div v-else class="editor-body">
                    <RouterView v-slot="{ Component }" :key="route.fullPath">
                        <component :is="Component" />
                    </RouterView>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.problem-editor {
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

.editor-navigation {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    border-bottom: 1px solid var(--surface-border);
    padding-bottom: 0.75rem;
}

.editor-navigation__item {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid transparent;
    color: var(--text-color-secondary);
    transition: all 0.2s ease;
}

.editor-navigation__item:hover {
    color: var(--text-color);
    border-color: var(--surface-border);
}

.editor-navigation__item.active {
    background: var(--primary-color);
    color: var(--primary-color-text);
}

.editor-body {
    padding-top: 0.5rem;
}

.editor-loading {
    display: flex;
    justify-content: center;
    padding: 4rem 0;
}
</style>
