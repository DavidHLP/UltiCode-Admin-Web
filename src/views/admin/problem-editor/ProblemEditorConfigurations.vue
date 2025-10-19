<script setup lang="ts">
import {
    createDataset,
    deleteDataset,
    fetchDatasets,
    updateDataset,
    type DatasetDetail,
    type DatasetInput,
    type Testcase,
    type TestcaseGroup,
    type TestcaseGroupInput,
    type TestcaseInput
} from '@/api/problem/datasets';
import {
    createTestcaseGroup,
    deleteTestcaseGroup,
    updateTestcaseGroup
} from '@/api/problem/testcasegroups';
import { createTestcase, deleteTestcase, updateTestcase } from '@/api/problem/testcases';
import MonacoEditor from 'monaco-editor-vue3';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useProblemEditorContext } from './context';

const editor = useProblemEditorContext();
const route = useRoute();
const toast = useToast();

const problemId = computed(() => {
    const raw = route.params.problemId;
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
});

const canManageDatasets = computed(() => editor.isEditMode.value && problemId.value !== null);

const datasets = ref<DatasetDetail[]>([]);
const datasetsLoading = ref(false);

type DatasetFormState = DatasetInput & {
    checkerFileId: number | null;
    floatAbsTol: number | null;
    floatRelTol: number | null;
};

const datasetForm = reactive<DatasetFormState>({
    name: '',
    isActive: false,
    checkerType: 'text',
    checkerFileId: null,
    floatAbsTol: null,
    floatRelTol: null
});

const datasetDialogVisible = ref(false);
const datasetDialogMode = ref<'create' | 'edit'>('create');
const editingDatasetId = ref<number | null>(null);
const savingDataset = ref(false);

const checkerTypeOptions = [
    { label: '文本比较', value: 'text' },
    { label: '浮点比较', value: 'float' },
    { label: '自定义校验器', value: 'custom' }
];

const checkerTypeLabels: Record<string, string> = {
    text: '文本比较',
    float: '浮点比较',
    custom: '自定义校验器'
};

const groupDialogVisible = ref(false);
const groupDialogMode = ref<'create' | 'edit'>('create');
const editingGroupContext = ref<{ datasetId: number; groupId: number | null }>({
    datasetId: 0,
    groupId: null
});
const savingGroup = ref(false);

const groupForm = reactive<TestcaseGroupInput>({
    name: '',
    isSample: false,
    weight: 1
});

const testcaseDialogVisible = ref(false);
const testcaseDialogMode = ref<'create' | 'edit'>('create');
const editingTestcaseContext = ref<{ groupId: number; testcaseId: number | null }>({
    groupId: 0,
    testcaseId: null
});
const savingTestcase = ref(false);

type TestcaseFormState = TestcaseInput & {
    inputFileId: number | null;
    outputFileId: number | null;
    inputJson: string | null;
    outputJson: string | null;
    outputType: string | null;
};

const testcaseForm = reactive<TestcaseFormState>({
    orderIndex: 0,
    inputFileId: null,
    outputFileId: null,
    inputJson: '',
    outputJson: '',
    outputType: '',
    score: 10
});

watch(
    () => [editor.isEditMode.value, problemId.value],
    async () => {
        if (editor.isEditMode.value && problemId.value !== null) {
            await loadDatasets();
        } else {
            datasets.value = [];
            editor.form.activeDatasetId = null;
        }
    },
    { immediate: true }
);

async function loadDatasets() {
    if (!canManageDatasets.value || problemId.value === null) {
        return;
    }
    datasetsLoading.value = true;
    try {
        const data = await fetchDatasets(problemId.value);
        datasets.value = data ?? [];
        const active = datasets.value.find((item) => item.isActive);
        editor.form.activeDatasetId = active ? active.id : null;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载数据集失败',
            life: 4000
        });
    } finally {
        datasetsLoading.value = false;
    }
}

function resetDatasetForm() {
    datasetForm.name = '';
    datasetForm.isActive = false;
    datasetForm.checkerType = 'text';
    datasetForm.checkerFileId = null;
    datasetForm.floatAbsTol = null;
    datasetForm.floatRelTol = null;
}

function openCreateDatasetDialog() {
    if (!canManageDatasets.value) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: '请先保存题目后再配置数据集',
            life: 3000
        });
        return;
    }
    resetDatasetForm();
    datasetDialogMode.value = 'create';
    editingDatasetId.value = null;
    datasetForm.isActive = datasets.value.length === 0;
    datasetDialogVisible.value = true;
}

function openEditDatasetDialog(dataset: DatasetDetail) {
    if (!canManageDatasets.value) {
        return;
    }
    datasetDialogMode.value = 'edit';
    editingDatasetId.value = dataset.id;
    datasetForm.name = dataset.name ?? '';
    datasetForm.isActive = dataset.isActive ?? false;
    datasetForm.checkerType = dataset.checkerType ?? 'text';
    datasetForm.checkerFileId = dataset.checkerType === 'custom' ? dataset.checkerFileId ?? null : null;
    datasetForm.floatAbsTol = dataset.checkerType === 'float' ? dataset.floatAbsTol ?? null : null;
    datasetForm.floatRelTol = dataset.checkerType === 'float' ? dataset.floatRelTol ?? null : null;
    datasetDialogVisible.value = true;
}

async function submitDataset() {
    if (!canManageDatasets.value || problemId.value === null) {
        return;
    }
    const name = datasetForm.name.trim();
    if (!name) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入数据集名称', life: 3500 });
        return;
    }
    if (!datasetForm.checkerType) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请选择校验器类型', life: 3500 });
        return;
    }
    const payload: DatasetInput = {
        name,
        isActive: datasetForm.isActive,
        checkerType: datasetForm.checkerType,
        checkerFileId:
            datasetForm.checkerType === 'custom' ? datasetForm.checkerFileId ?? null : null,
        floatAbsTol:
            datasetForm.checkerType === 'float' ? datasetForm.floatAbsTol ?? null : null,
        floatRelTol:
            datasetForm.checkerType === 'float' ? datasetForm.floatRelTol ?? null : null
    };

    savingDataset.value = true;
    try {
        if (datasetDialogMode.value === 'create' || editingDatasetId.value === null) {
            await createDataset(problemId.value, payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '数据集已创建', life: 2500 });
        } else {
            await updateDataset(problemId.value, editingDatasetId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '数据集已更新', life: 2500 });
        }
        datasetDialogVisible.value = false;
        await loadDatasets();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存数据集失败',
            life: 4000
        });
    } finally {
        savingDataset.value = false;
    }
}

async function setDatasetActive(dataset: DatasetDetail) {
    if (!canManageDatasets.value || problemId.value === null || dataset.isActive) {
        return;
    }
    try {
        await updateDataset(problemId.value, dataset.id, {
            name: dataset.name,
            isActive: true,
            checkerType: dataset.checkerType,
            checkerFileId:
                dataset.checkerType === 'custom' ? dataset.checkerFileId ?? null : null,
            floatAbsTol: dataset.checkerType === 'float' ? dataset.floatAbsTol ?? null : null,
            floatRelTol: dataset.checkerType === 'float' ? dataset.floatRelTol ?? null : null
        });
        toast.add({ severity: 'success', summary: '已激活', detail: '数据集已设为激活', life: 2500 });
        await loadDatasets();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '激活数据集失败',
            life: 4000
        });
    }
}

async function removeDataset(dataset: DatasetDetail) {
    if (!canManageDatasets.value || problemId.value === null) {
        return;
    }
    const confirmed = window.confirm(`确定删除数据集「${dataset.name ?? dataset.id}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteDataset(problemId.value, dataset.id);
        toast.add({ severity: 'success', summary: '已删除', detail: '数据集已删除', life: 2500 });
        await loadDatasets();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '删除数据集失败',
            life: 4000
        });
    }
}

function resetGroupForm() {
    groupForm.name = '';
    groupForm.isSample = false;
    groupForm.weight = 1;
}

function openCreateGroupDialog(dataset: DatasetDetail) {
    resetGroupForm();
    groupDialogMode.value = 'create';
    editingGroupContext.value = { datasetId: dataset.id, groupId: null };
    groupDialogVisible.value = true;
}

function openEditGroupDialog(dataset: DatasetDetail, group: TestcaseGroup) {
    groupDialogMode.value = 'edit';
    editingGroupContext.value = { datasetId: dataset.id, groupId: group.id };
    groupForm.name = group.name ?? '';
    groupForm.isSample = group.isSample ?? false;
    groupForm.weight = group.weight ?? 1;
    groupDialogVisible.value = true;
}

async function submitGroup() {
    const context = editingGroupContext.value;
    if (!context.datasetId || (groupDialogMode.value === 'edit' && context.groupId == null)) {
        return;
    }
    const name = groupForm.name.trim();
    if (!name) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入测试组名称', life: 3500 });
        return;
    }
    if (!Number.isFinite(groupForm.weight) || groupForm.weight <= 0) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '测试组权重需大于0', life: 3500 });
        return;
    }
    const payload: TestcaseGroupInput = {
        name,
        isSample: groupForm.isSample,
        weight: groupForm.weight
    };
    savingGroup.value = true;
    try {
        if (groupDialogMode.value === 'create' || context.groupId == null) {
            await createTestcaseGroup(context.datasetId, payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '测试组已创建', life: 2500 });
        } else {
            await updateTestcaseGroup(context.datasetId, context.groupId, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '测试组已更新', life: 2500 });
        }
        groupDialogVisible.value = false;
        await loadDatasets();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存测试组失败',
            life: 4000
        });
    } finally {
        savingGroup.value = false;
    }
}

async function removeGroup(dataset: DatasetDetail, group: TestcaseGroup) {
    const confirmed = window.confirm(`确定删除测试组「${group.name ?? group.id}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteTestcaseGroup(dataset.id, group.id);
        toast.add({ severity: 'success', summary: '已删除', detail: '测试组已删除', life: 2500 });
        await loadDatasets();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '删除测试组失败',
            life: 4000
        });
    }
}

function resetTestcaseForm() {
    testcaseForm.orderIndex = 0;
    testcaseForm.inputFileId = null;
    testcaseForm.outputFileId = null;
    testcaseForm.inputJson = '';
    testcaseForm.outputJson = '';
    testcaseForm.outputType = '';
    testcaseForm.score = 10;
}

function openCreateTestcaseDialog(group: TestcaseGroup) {
    resetTestcaseForm();
    testcaseDialogMode.value = 'create';
    editingTestcaseContext.value = { groupId: group.id, testcaseId: null };
    testcaseForm.orderIndex = (group.testcases?.length ?? 0) + 1;
    testcaseDialogVisible.value = true;
}

function openEditTestcaseDialog(group: TestcaseGroup, testcase: Testcase) {
    testcaseDialogMode.value = 'edit';
    editingTestcaseContext.value = { groupId: group.id, testcaseId: testcase.id };
    testcaseForm.orderIndex = testcase.orderIndex ?? 0;
    testcaseForm.inputFileId = testcase.inputFileId ?? null;
    testcaseForm.outputFileId = testcase.outputFileId ?? null;
    testcaseForm.inputJson = testcase.inputJson ?? '';
    testcaseForm.outputJson = testcase.outputJson ?? '';
    testcaseForm.outputType = testcase.outputType ?? '';
    testcaseForm.score = testcase.score ?? 0;
    testcaseDialogVisible.value = true;
}

async function submitTestcase() {
    const context = editingTestcaseContext.value;
    if (!context.groupId || (testcaseDialogMode.value === 'edit' && context.testcaseId == null)) {
        return;
    }
    if (!Number.isFinite(testcaseForm.orderIndex)) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入用例顺序', life: 3500 });
        return;
    }
    if (!Number.isFinite(testcaseForm.score)) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入用例分值', life: 3500 });
        return;
    }
    const trimmedOutputType = testcaseForm.outputType?.trim() ?? '';
    const payload: TestcaseInput = {
        orderIndex: testcaseForm.orderIndex,
        inputFileId: testcaseForm.inputFileId ?? null,
        outputFileId: testcaseForm.outputFileId ?? null,
        inputJson: testcaseForm.inputJson && testcaseForm.inputJson.trim() ? testcaseForm.inputJson : null,
        outputJson: testcaseForm.outputJson && testcaseForm.outputJson.trim() ? testcaseForm.outputJson : null,
        outputType: trimmedOutputType ? trimmedOutputType : null,
        score: testcaseForm.score
    };

    savingTestcase.value = true;
    try {
        if (testcaseDialogMode.value === 'create' || context.testcaseId == null) {
            await createTestcase(context.groupId, payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '测试用例已创建', life: 2500 });
        } else {
            await updateTestcase(context.groupId, context.testcaseId, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '测试用例已更新', life: 2500 });
        }
        testcaseDialogVisible.value = false;
        await loadDatasets();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存测试用例失败',
            life: 4000
        });
    } finally {
        savingTestcase.value = false;
    }
}

async function removeTestcase(group: TestcaseGroup, testcase: Testcase) {
    const confirmed = window.confirm(`确定删除测试用例 #${testcase.id} 吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteTestcase(group.id, testcase.id);
        toast.add({ severity: 'success', summary: '已删除', detail: '测试用例已删除', life: 2500 });
        await loadDatasets();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '删除测试用例失败',
            life: 4000
        });
    }
}

function checkerTypeLabel(type?: string | null) {
    if (!type) {
        return '文本比较';
    }
    return checkerTypeLabels[type] ?? type;
}

function formatOptionalNumber(value?: number | null) {
    return value === undefined || value === null ? '未设置' : value;
}

function formatOptionalString(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length ? trimmed : '未设置';
}

function renderJsonPreview(json?: string | null) {
    if (!json) {
        return '无';
    }
    if (json.length <= 60) {
        return json;
    }
    return `${json.slice(0, 60)}…`;
}
</script>

<template>
    <div class="config-layout">
        <main class="editor-card language-card" aria-labelledby="language-config-heading">
            <header class="card-header">
                <div>
                    <h3 id="language-config-heading">编程语言配置</h3>
                    <span class="card-subtitle">维护入口函数与代码模板</span>
                </div>
                <Button type="button" label="添加语言配置" icon="pi pi-plus" outlined
                    @click="editor.addLanguageConfig(editor.form.languageConfigs.length - 1)" />
            </header>
            <div class="card-body">
                <div v-if="!editor.form.languageConfigs.length" class="empty-hint text-sm text-color-secondary">
                    当前没有语言配置，可根据需要添加不同语言的入口函数与默认代码。
                </div>
                <div v-else class="language-list">
                    <article v-for="(config, index) in editor.form.languageConfigs" :key="`language-${index}`"
                        class="language-panel">
                        <header class="language-panel__header">
                            <div class="language-panel__title">
                                {{ editor.getLanguageDisplayName(config.languageId) }}
                            </div>
                            <div class="language-panel__actions">
                                <Button icon="pi pi-copy" text rounded @click="editor.duplicateLanguageConfig(index)" />
                                <Button icon="pi pi-arrow-up" text rounded :disabled="index === 0"
                                    @click="editor.moveLanguageConfig(index, -1)" />
                                <Button icon="pi pi-arrow-down" text rounded
                                    :disabled="index === editor.form.languageConfigs.length - 1"
                                    @click="editor.moveLanguageConfig(index, 1)" />
                                <Button icon="pi pi-times" text rounded severity="danger"
                                    @click="editor.removeLanguageConfig(index)" />
                            </div>
                        </header>
                        <div class="grid form-grid-inner">
                            <div class="col-12 md:col-6">
                                <label class="field-label">语言</label>
                                <Dropdown v-model="config.languageId" :options="editor.languageSelectOptions.value"
                                    optionLabel="label" optionValue="value" placeholder="选择语言" class="w-full" />
                            </div>
                            <div class="col-12 md:col-6">
                                <label class="field-label">入口函数名 (可选)</label>
                                <InputText v-model="config.functionName" placeholder="如 main 或 solution"
                                    class="w-full" />
                            </div>
                            <div class="col-12">
                                <div class="monaco-block">
                                    <label class="field-label">初始代码模板 (可选)</label>
                                    <MonacoEditor v-model:value="config.starterCode"
                                        :language="editor.editorLanguageForConfig(config)" theme="vs-light"
                                        height="240px" :options="editor.codeEditorOptions" />
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </main>

        <aside class="editor-card metadata-card" aria-labelledby="metadata-heading">
            <header class="card-header">
                <div>
                    <h3 id="metadata-heading">元数据</h3>
                    <span class="card-subtitle">存储额外业务字段 (JSON 对象)</span>
                </div>
                <Button v-if="editor.form.metaText" type="button" label="格式化" icon="pi pi-brush" text
                    @click="editor.formatMetaJson" />
            </header>
            <div class="card-body">
                <div class="monaco-block">
                    <MonacoEditor v-model:value="editor.form.metaText" language="json" theme="vs-light" height="260px"
                        :options="editor.jsonEditorOptions" />
                    <small class="text-color-secondary text-xs">
                        元数据会原样存入数据库并随题目详情返回，可用于记录来源、测试配置等信息。
                    </small>
                </div>
            </div>
        </aside>
    </div>

    <section class="editor-card dataset-card" aria-labelledby="dataset-heading">
        <header class="card-header">
            <div>
                <h3 id="dataset-heading">数据集与测试用例</h3>
                <span class="card-subtitle">管理不同版本的数据集以及对应的测试用例</span>
            </div>
            <Button type="button" label="添加数据集" icon="pi pi-plus" outlined :disabled="!canManageDatasets"
                @click="openCreateDatasetDialog" />
        </header>
        <div class="card-body">
            <div v-if="!canManageDatasets" class="empty-hint text-sm text-color-secondary">
                保存题目后即可配置数据集与测试用例。
            </div>
            <div v-else-if="datasetsLoading" class="dataset-loading">
                <ProgressSpinner style="width: 2.5rem; height: 2.5rem" strokeWidth="4" />
            </div>
            <div v-else-if="!datasets.length" class="empty-hint text-sm text-color-secondary">
                当前没有数据集，点击右上角按钮创建一个新的数据集。
            </div>
            <div v-else class="dataset-list">
                <article v-for="dataset in datasets" :key="dataset.id" class="dataset-panel">
                    <header class="dataset-panel__header">
                        <div class="dataset-panel__title">
                            <h4>{{ dataset.name || `数据集 #${dataset.id}` }}</h4>
                            <Tag v-if="dataset.isActive" severity="success" value="激活中" />
                        </div>
                        <div class="dataset-panel__actions">
                            <Button v-if="!dataset.isActive" icon="pi pi-check-circle" text size="small" label="设为激活"
                                @click="setDatasetActive(dataset)" />
                            <Button icon="pi pi-pencil" text size="small" @click="openEditDatasetDialog(dataset)" />
                            <Button icon="pi pi-trash" text size="small" severity="danger"
                                @click="removeDataset(dataset)" />
                        </div>
                    </header>

                    <div class="dataset-panel__meta">
                        <div class="meta-item">
                            <span class="meta-label">校验器</span>
                            <span class="meta-value">{{ checkerTypeLabel(dataset.checkerType) }}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">校验文件</span>
                            <span class="meta-value">{{ formatOptionalNumber(dataset.checkerFileId) }}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">绝对误差</span>
                            <span class="meta-value">{{ formatOptionalNumber(dataset.floatAbsTol) }}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">相对误差</span>
                            <span class="meta-value">{{ formatOptionalNumber(dataset.floatRelTol) }}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">测试组数量</span>
                            <span class="meta-value">{{ dataset.groups?.length ?? 0 }}</span>
                        </div>
                    </div>

                    <div class="group-section">
                        <header class="group-section__header">
                            <h5>测试组</h5>
                            <Button label="添加测试组" icon="pi pi-plus" outlined size="small"
                                @click="openCreateGroupDialog(dataset)" />
                        </header>
                        <div v-if="!dataset.groups?.length" class="empty-hint text-sm text-color-secondary">
                            暂无测试组，可点击“添加测试组”按钮创建。
                        </div>
                        <div v-else class="group-list">
                            <article v-for="group in dataset.groups" :key="group.id" class="group-panel">
                                <header class="group-panel__header">
                                    <div class="group-panel__title">
                                        <h6>{{ group.name || `测试组 #${group.id}` }}</h6>
                                        <Tag v-if="group.isSample" severity="info" value="样例" />
                                    </div>
                                    <div class="group-panel__actions">
                                        <Button icon="pi pi-plus" label="添加用例" text size="small"
                                            @click="openCreateTestcaseDialog(group)" />
                                        <Button icon="pi pi-pencil" text size="small"
                                            @click="openEditGroupDialog(dataset, group)" />
                                        <Button icon="pi pi-trash" text size="small" severity="danger"
                                            @click="removeGroup(dataset, group)" />
                                    </div>
                                </header>
                                <div class="group-panel__meta">
                                    <span>权重：{{ group.weight ?? 1 }}</span>
                                    <span>用例数：{{ group.testcases?.length ?? 0 }}</span>
                                </div>
                                <ul v-if="group.testcases?.length" class="testcase-list">
                                    <li v-for="testcase in group.testcases" :key="testcase.id" class="testcase-item">
                                        <div class="testcase-info">
                                            <span class="order">#{{ testcase.orderIndex }}</span>
                                            <span class="score">分值 {{ testcase.score }}</span>
                                            <span class="output-type">输出类型：{{ formatOptionalString(testcase.outputType)
                                            }}</span>
                                        </div>
                                        <div class="testcase-meta">
                                            <span>输入文件：{{ formatOptionalNumber(testcase.inputFileId) }}</span>
                                            <span>输出文件：{{ formatOptionalNumber(testcase.outputFileId) }}</span>
                                        </div>
                                        <div class="testcase-json">
                                            <span>输入 JSON：{{ renderJsonPreview(testcase.inputJson) }}</span>
                                            <span>输出 JSON：{{ renderJsonPreview(testcase.outputJson) }}</span>
                                        </div>
                                        <div class="testcase-actions">
                                            <Button icon="pi pi-pencil" text size="small"
                                                @click="openEditTestcaseDialog(group, testcase)" />
                                            <Button icon="pi pi-trash" text size="small" severity="danger"
                                                @click="removeTestcase(group, testcase)" />
                                        </div>
                                    </li>
                                </ul>
                                <div v-else class="empty-hint text-sm text-color-secondary">
                                    暂无测试用例，可点击“添加用例”完善数据。
                                </div>
                            </article>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    </section>

    <Dialog v-model:visible="datasetDialogVisible" :header="datasetDialogMode === 'create' ? '新增数据集' : '编辑数据集'" modal
        class="dialog-md">
        <div class="grid form-grid">
            <div class="col-12">
                <label class="field-label">名称</label>
                <InputText v-model="datasetForm.name" placeholder="如 default" class="w-full" />
            </div>
            <div class="col-12 md:col-6">
                <label class="field-label">校验器类型</label>
                <Dropdown v-model="datasetForm.checkerType" :options="checkerTypeOptions" optionLabel="label"
                    optionValue="value" class="w-full" />
            </div>
            <div class="col-12 md:col-6">
                <label class="field-label">激活状态</label>
                <div class="flex align-items-center gap-2">
                    <InputSwitch v-model="datasetForm.isActive" />
                    <span>{{ datasetForm.isActive ? '激活' : '未激活' }}</span>
                </div>
            </div>
            <div v-if="datasetForm.checkerType === 'custom'" class="col-12">
                <label class="field-label">校验器文件 ID</label>
                <InputNumber v-model="datasetForm.checkerFileId" :useGrouping="false" :allowEmpty="true"
                    class="w-full" />
                <small class="text-xs text-color-secondary">填写上传至文件管理的校验器文件 ID。</small>
            </div>
            <div v-if="datasetForm.checkerType === 'float'" class="col-12 md:col-6">
                <label class="field-label">绝对误差</label>
                <InputNumber v-model="datasetForm.floatAbsTol" :minFractionDigits="0" :maxFractionDigits="6"
                    :allowEmpty="true" class="w-full" />
            </div>
            <div v-if="datasetForm.checkerType === 'float'" class="col-12 md:col-6">
                <label class="field-label">相对误差</label>
                <InputNumber v-model="datasetForm.floatRelTol" :minFractionDigits="0" :maxFractionDigits="6"
                    :allowEmpty="true" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="取消" text @click="datasetDialogVisible = false" />
            <Button label="保存" icon="pi pi-check" :loading="savingDataset" @click="submitDataset" />
        </template>
    </Dialog>

    <Dialog v-model:visible="groupDialogVisible" :header="groupDialogMode === 'create' ? '新增测试组' : '编辑测试组'" modal
        class="dialog-sm">
        <div class="grid form-grid">
            <div class="col-12">
                <label class="field-label">名称</label>
                <InputText v-model="groupForm.name" placeholder="如 samples" class="w-full" />
            </div>
            <div class="col-12 md:col-6">
                <label class="field-label">是否样例</label>
                <div class="flex align-items-center gap-2">
                    <InputSwitch v-model="groupForm.isSample" />
                    <span>{{ groupForm.isSample ? '是' : '否' }}</span>
                </div>
            </div>
            <div class="col-12 md:col-6">
                <label class="field-label">权重</label>
                <InputNumber v-model="groupForm.weight" :useGrouping="false" :min="1" class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="取消" text @click="groupDialogVisible = false" />
            <Button label="保存" icon="pi pi-check" :loading="savingGroup" @click="submitGroup" />
        </template>
    </Dialog>

    <Dialog v-model:visible="testcaseDialogVisible" :header="testcaseDialogMode === 'create' ? '新增测试用例' : '编辑测试用例'"
        modal class="dialog-lg">
        <div class="grid form-grid">
            <div class="col-12 md:col-4">
                <label class="field-label">顺序</label>
                <InputNumber v-model="testcaseForm.orderIndex" :useGrouping="false" class="w-full" />
            </div>
            <div class="col-12 md:col-4">
                <label class="field-label">分值</label>
                <InputNumber v-model="testcaseForm.score" :useGrouping="false" class="w-full" />
            </div>
            <div class="col-12 md:col-4">
                <label class="field-label">输出类型 (可选)</label>
                <InputText v-model="testcaseForm.outputType" placeholder="如 json / text" class="w-full" />
            </div>
            <div class="col-12 md:col-6">
                <label class="field-label">输入文件 ID (可选)</label>
                <InputNumber v-model="testcaseForm.inputFileId" :useGrouping="false" :allowEmpty="true"
                    class="w-full" />
            </div>
            <div class="col-12 md:col-6">
                <label class="field-label">输出文件 ID (可选)</label>
                <InputNumber v-model="testcaseForm.outputFileId" :useGrouping="false" :allowEmpty="true"
                    class="w-full" />
            </div>
            <div class="col-12">
                <label class="field-label">输入 JSON (可选)</label>
                <Textarea v-model="testcaseForm.inputJson" autoResize rows="4" placeholder="JSON 字符串，留空则使用文件"
                    class="w-full" />
            </div>
            <div class="col-12">
                <label class="field-label">输出 JSON (可选)</label>
                <Textarea v-model="testcaseForm.outputJson" autoResize rows="4" placeholder="JSON 字符串，留空则使用文件"
                    class="w-full" />
            </div>
        </div>
        <template #footer>
            <Button label="取消" text @click="testcaseDialogVisible = false" />
            <Button label="保存" icon="pi pi-check" :loading="savingTestcase" @click="submitTestcase" />
        </template>
    </Dialog>
</template>

<style scoped>
.config-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

@media (min-width: 992px) {
    .config-layout {
        display: grid;
        grid-template-columns: minmax(0, 4fr) minmax(0, 1fr);
        gap: 1.5rem;
        align-items: flex-start;
    }
}

.editor-card {
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    padding: 1.25rem;
    background: var(--surface-ground);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.card-subtitle {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.card-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.language-list {
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
    flex-wrap: wrap;
}

.language-panel__title {
    font-weight: 600;
}

.language-panel__actions {
    display: flex;
    gap: 0.25rem;
}

.field-label {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.monaco-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-grid-inner {
    gap: 1rem;
}

.empty-hint {
    border-radius: 8px;
    padding: 1rem;
    background: var(--surface-ground);
}

.dataset-card {
    margin-top: 1.5rem;
}

.dataset-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.dataset-loading {
    display: flex;
    justify-content: center;
    padding: 2rem 0;
}

.dataset-panel {
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    padding: 1rem;
    background: var(--surface-card);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.dataset-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.dataset-panel__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.dataset-panel__title h4 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
}

.dataset-panel__actions {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
}

.dataset-panel__meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
    background: var(--surface-ground);
    border-radius: 8px;
    padding: 0.75rem;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.meta-label {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.meta-value {
    font-weight: 600;
    font-size: 0.95rem;
}

.group-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.group-section__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
}

.group-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.group-panel {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 0.75rem;
    background: var(--surface-ground);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.group-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.group-panel__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.group-panel__title h6 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
}

.group-panel__actions {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
}

.group-panel__meta {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
}

.testcase-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.testcase-item {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 0.75rem;
    background: var(--surface-card);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.testcase-info {
    display: flex;
    gap: 0.75rem;
    font-weight: 600;
}

.testcase-info .order {
    color: var(--primary-color);
}

.testcase-info .score {
    color: var(--text-color-secondary);
}

.testcase-info .output-type {
    color: var(--text-color-secondary);
}

.testcase-meta,
.testcase-json {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.testcase-actions {
    display: flex;
    gap: 0.35rem;
}

.dialog-sm :deep(.p-dialog) {
    width: min(420px, 90vw);
}

.dialog-md :deep(.p-dialog) {
    width: min(560px, 92vw);
}

.dialog-lg :deep(.p-dialog) {
    width: min(680px, 95vw);
}

@media (min-width: 992px) {
    .metadata-card {
        position: sticky;
        top: 1.5rem;
    }
}
</style>
