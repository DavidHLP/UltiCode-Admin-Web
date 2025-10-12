<script setup lang="ts">
import { fetchProblemDetail, type Problem } from '@/api/problem';
import { createSolutionsTestCase, deleteSolutionsTestCase, fetchAllSolutionsTestCases, updateSolutionsTestCase, type TestCase, type TestCaseInput, type TestCaseOutput } from '@/api/testcase';
import { emitErrorToast, emitSuccessToast } from '@/utils/toast';
import { useConfirm } from 'primevue/useconfirm';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const confirm = useConfirm();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const testCases = ref<TestCase[]>([]);
const showOnlySample = ref(false);
const expandedRows = ref<TestCase[]>([]);
const formMode = ref<'create' | 'edit'>('create');
const formVisible = ref(false);

const problem = ref<Problem | null>(null);
const problemLoading = ref(false);
const problemLoadError = ref<string | null>(null);
let problemRequestToken = 0;
let testCaseRequestToken = 0;

const currentProblemId = computed<number | null>(() => {
    const param = route.params.problemId;
    const raw = Array.isArray(param) ? param[0] : param;
    if (raw == null) {
        return null;
    }
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : null;
});

const effectiveProblemId = computed<number | null>(() => problem.value?.id ?? currentProblemId.value ?? null);

function createEmptyOutput(problemId: number | null = effectiveProblemId.value): TestCaseOutput {
    return {
        id: null,
        problemId,
        output: '',
        outputType: '',
        score: 10,
        isSample: false
    };
}

function createEmptyInput(orderIndex: number): TestCaseInput {
    return {
        id: null,
        testCaseOutputId: null,
        testCaseName: '',
        inputType: '',
        inputContent: '',
        orderIndex
    };
}

function createEmptyTestCase(): TestCase {
    const problemId = effectiveProblemId.value;
    return {
        id: null,
        problemId,
        testCaseOutput: createEmptyOutput(problemId),
        testCaseInput: [createEmptyInput(0)]
    };
}

const formState = reactive<TestCase>(createEmptyTestCase());
const formErrors = reactive<{ output?: string; inputs?: string }>({});

const filteredTestCases = computed(() => {
    if (!showOnlySample.value) {
        return testCases.value;
    }
    return testCases.value.filter((testCase) => Boolean(testCase.testCaseOutput?.isSample));
});

const testCaseStats = computed(() => {
    const total = testCases.value.length;
    const sample = testCases.value.filter((item) => item.testCaseOutput?.isSample).length;
    const score = testCases.value.reduce((sum, item) => sum + Number(item.testCaseOutput?.score ?? 0), 0);
    return {
        total,
        sample,
        score
    };
});

const canManage = computed(() => effectiveProblemId.value != null && !problemLoading.value);

function clearErrors() {
    formErrors.output = undefined;
    formErrors.inputs = undefined;
}

function normalizeFetchedTestCase(testCase: TestCase): TestCase {
    const problemId = effectiveProblemId.value ?? testCase.problemId ?? null;
    const normalizedOutput: TestCaseOutput = testCase.testCaseOutput
        ? {
              id: testCase.testCaseOutput.id ?? null,
              problemId: testCase.testCaseOutput.problemId ?? problemId,
              output: testCase.testCaseOutput.output ?? '',
              outputType: testCase.testCaseOutput.outputType ?? '',
              score: Number.isFinite(testCase.testCaseOutput.score ?? undefined) ? Number(testCase.testCaseOutput.score) : 10,
              isSample: Boolean(testCase.testCaseOutput.isSample)
          }
        : createEmptyOutput(problemId);

    const normalizedInputs: TestCaseInput[] =
        Array.isArray(testCase.testCaseInput) && testCase.testCaseInput.length > 0
            ? [...testCase.testCaseInput]
                  .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                  .map((input, index) => ({
                      id: input.id ?? null,
                      testCaseOutputId: input.testCaseOutputId ?? normalizedOutput.id ?? null,
                      testCaseName: input.testCaseName ?? '',
                      inputType: input.inputType ?? '',
                      inputContent: input.inputContent ?? '',
                      orderIndex: input.orderIndex ?? index
                  }))
            : [createEmptyInput(0)];

    return {
        id: testCase.id ?? null,
        problemId,
        testCaseOutput: normalizedOutput,
        testCaseInput: normalizedInputs
    };
}

async function loadProblemInfo(problemId: number) {
    const requestId = ++problemRequestToken;
    problemLoading.value = true;
    problemLoadError.value = null;
    try {
        const detail = await fetchProblemDetail(problemId);
        if (requestId !== problemRequestToken) {
            return;
        }
        problem.value = detail ?? null;
    } catch (error) {
        console.error('加载题目信息失败:', error);
        if (requestId !== problemRequestToken) {
            return;
        }
        problem.value = null;
        problemLoadError.value = '加载题目信息失败，请稍后重试';
        emitErrorToast('加载题目信息失败，请稍后重试');
    } finally {
        if (requestId === problemRequestToken) {
            problemLoading.value = false;
        }
    }
}

async function loadTestCases() {
    const problemId = effectiveProblemId.value;
    if (!problemId) {
        testCases.value = [];
        return;
    }
    const requestId = ++testCaseRequestToken;
    loading.value = true;
    try {
        const data = await fetchAllSolutionsTestCases(problemId);
        if (requestId !== testCaseRequestToken) {
            return;
        }
        testCases.value = Array.isArray(data) ? data.map(normalizeFetchedTestCase) : [];
        expandedRows.value = [];
    } catch (error) {
        console.error('加载测试用例失败:', error);
        if (requestId === testCaseRequestToken) {
            emitErrorToast('加载测试用例失败，请稍后重试');
        }
    } finally {
        if (requestId === testCaseRequestToken) {
            loading.value = false;
        }
    }
}

function resetForm(testCase?: TestCase) {
    clearErrors();
    if (testCase) {
        const normalized = normalizeFetchedTestCase(testCase);
        formState.id = normalized.id;
        formState.problemId = normalized.problemId;
        formState.testCaseOutput = normalized.testCaseOutput;
        formState.testCaseInput = normalized.testCaseInput;
    } else {
        const empty = createEmptyTestCase();
        formState.id = empty.id;
        formState.problemId = empty.problemId;
        formState.testCaseOutput = empty.testCaseOutput;
        formState.testCaseInput = empty.testCaseInput;
    }
}

function resetTestCaseState() {
    testCases.value = [];
    formVisible.value = false;
    formMode.value = 'create';
    showOnlySample.value = false;
    expandedRows.value = [];
    resetForm();
    clearErrors();
}

function openCreateForm() {
    formMode.value = 'create';
    resetForm();
    formVisible.value = true;
}

function openEditForm(testCase: TestCase) {
    formMode.value = 'edit';
    resetForm(testCase);
    formVisible.value = true;
}

function closeForm() {
    formVisible.value = false;
    formMode.value = 'create';
    resetForm();
}

function addInputRow() {
    if (!Array.isArray(formState.testCaseInput)) {
        formState.testCaseInput = [createEmptyInput(0)];
        return;
    }
    const nextOrder = formState.testCaseInput.length;
    formState.testCaseInput.push(createEmptyInput(nextOrder));
}

function removeInputRow(index: number) {
    if (!Array.isArray(formState.testCaseInput)) {
        return;
    }
    if (formState.testCaseInput.length <= 1) {
        formErrors.inputs = '至少需要保留一条输入';
        return;
    }
    formState.testCaseInput.splice(index, 1);
    formState.testCaseInput.forEach((input, idx) => {
        input.orderIndex = idx;
    });
}

function validateForm(): boolean {
    clearErrors();
    const output = formState.testCaseOutput?.output?.trim();
    if (!output) {
        formErrors.output = '请输入期望输出';
    }

    const inputs = formState.testCaseInput ?? [];
    const invalidInputs = inputs.filter((input) => !input.inputContent?.trim());
    if (invalidInputs.length > 0) {
        formErrors.inputs = '每个输入内容不能为空';
    }

    return !formErrors.output && !formErrors.inputs;
}

function buildPayload(): TestCase {
    const problemId = effectiveProblemId.value;
    const inputList = (formState.testCaseInput ?? []).map((input, index) => ({
        id: input.id ?? null,
        testCaseOutputId: input.testCaseOutputId ?? formState.testCaseOutput?.id ?? null,
        testCaseName: input.testCaseName?.trim() ?? '',
        inputType: input.inputType?.trim() ?? '',
        inputContent: input.inputContent?.trim() ?? '',
        orderIndex: index
    }));

    return {
        id: formState.id ?? null,
        problemId,
        testCaseOutput: formState.testCaseOutput
            ? {
                  id: formState.testCaseOutput.id ?? null,
                  problemId,
                  output: formState.testCaseOutput.output?.trim() ?? '',
                  outputType: formState.testCaseOutput.outputType?.trim() ?? '',
                  score: Number(formState.testCaseOutput.score ?? 10),
                  isSample: Boolean(formState.testCaseOutput.isSample)
              }
            : createEmptyOutput(problemId),
        testCaseInput: inputList
    };
}

async function submitForm() {
    const problemId = effectiveProblemId.value;
    if (!problemId) {
        emitErrorToast('缺少题目信息，无法保存测试用例');
        return;
    }
    if (!validateForm()) {
        return;
    }
    saving.value = true;
    const payload = buildPayload();
    payload.problemId = problemId;
    if (payload.testCaseOutput) {
        payload.testCaseOutput.problemId = problemId;
    }
    try {
        if (formMode.value === 'create') {
            await createSolutionsTestCase(payload);
            emitSuccessToast('添加测试用例成功');
        } else {
            if (!payload.id) {
                throw new Error('测试用例缺少 ID，无法更新');
            }
            await updateSolutionsTestCase(payload);
            emitSuccessToast('更新测试用例成功');
        }
        await loadTestCases();
        closeForm();
    } catch (error) {
        console.error('保存测试用例失败:', error);
        emitErrorToast('保存测试用例失败，请稍后重试');
    } finally {
        saving.value = false;
    }
}

function requestDeleteTestCase(testCase: TestCase) {
    if (!testCase.id) {
        return;
    }
    const id = testCase.id;
    confirm.require({
        message: '确认删除该测试用例吗？',
        header: '删除测试用例',
        icon: 'pi pi-exclamation-triangle',
        rejectLabel: '取消',
        acceptLabel: '删除',
        acceptClass: 'p-button-danger',
        accept: () => deleteTestCaseById(id)
    });
}

async function deleteTestCaseById(id: number) {
    saving.value = true;
    try {
        await deleteSolutionsTestCase(id);
        emitSuccessToast('删除测试用例成功');
        await loadTestCases();
        if (formState.id === id) {
            closeForm();
        }
    } catch (error) {
        console.error('删除测试用例失败:', error);
        emitErrorToast('删除测试用例失败，请稍后重试');
    } finally {
        saving.value = false;
    }
}

function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
    } else {
        router.push({ name: 'adminProblems' });
    }
}

watch(
    currentProblemId,
    async (newId) => {
        resetTestCaseState();
        problem.value = null;
        problemLoadError.value = null;

        if (newId == null) {
            emitErrorToast('未找到有效的题目 ID');
            return;
        }

        await loadProblemInfo(newId);
        await loadTestCases();
    },
    { immediate: true }
);
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card problem-testcases-page">
                <ConfirmDialog />

                <div class="page-header">
                    <div class="page-header-left">
                        <Button icon="pi pi-arrow-left" label="返回题目列表" text severity="secondary" @click="goBack" />
                        <div class="page-title-block">
                            <div class="page-title">
                                <span v-if="problemLoading">加载题目信息…</span>
                                <span v-else>{{ problem?.title ?? '未找到题目信息' }}</span>
                            </div>
                            <small class="page-subtitle">
                                函数名称：{{ problem?.solutionFunctionName ?? '—' }}
                                <template v-if="problem?.problemType"> · 类型：{{ problem.problemType }}</template>
                            </small>
                        </div>
                    </div>

                    <div class="page-header-right">
                        <div class="grid grid-cols-3 gap-3 stats-grid">
                            <div class="stat-card">
                                <span class="stat-label">测试用例</span>
                                <span class="stat-value">{{ testCaseStats.total }}</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-label">样例</span>
                                <span class="stat-value">{{ testCaseStats.sample }}</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-label">总分</span>
                                <span class="stat-value">{{ testCaseStats.score }}</span>
                            </div>
                        </div>

                        <div class="header-actions">
                            <div class="flex items-center gap-2 text-sm">
                                <Checkbox v-model="showOnlySample" binary inputId="onlySample" :disabled="!testCases.length" />
                                <label for="onlySample" class="text-color-secondary">仅显示样例</label>
                            </div>
                            <Button icon="pi pi-plus" label="新建测试用例" severity="success" outlined :disabled="!canManage" @click="openCreateForm" />
                        </div>
                    </div>
                </div>

                <div v-if="problemLoadError" class="page-alert">
                    {{ problemLoadError }}
                </div>

                <DataTable v-model:expandedRows="expandedRows" :value="filteredTestCases" dataKey="id" :loading="loading" showGridlines responsiveLayout="scroll" :rowHover="true">
                    <template #empty> 暂无测试用例 </template>
                    <template #loading> 正在加载测试用例… </template>

                    <Column expander style="width: 4rem" />

                    <Column field="id" header="ID" style="width: 6rem">
                        <template #body="{ data }">
                            <span class="font-medium text-sm">{{ data.id ?? '—' }}</span>
                        </template>
                    </Column>

                    <Column header="期望输出" style="min-width: 16rem">
                        <template #body="{ data }">
                            <div class="truncate-lines">
                                {{ data.testCaseOutput?.output ?? '' }}
                            </div>
                        </template>
                    </Column>

                    <Column header="输出类型" style="width: 8rem">
                        <template #body="{ data }">
                            <span>{{ data.testCaseOutput?.outputType || '未设置' }}</span>
                        </template>
                    </Column>

                    <Column header="分值" style="width: 6rem">
                        <template #body="{ data }">
                            <span>{{ data.testCaseOutput?.score ?? 0 }}</span>
                        </template>
                    </Column>

                    <Column header="样例" style="width: 6rem">
                        <template #body="{ data }">
                            <Tag :value="data.testCaseOutput?.isSample ? '是' : '否'" :severity="data.testCaseOutput?.isSample ? 'success' : 'secondary'" rounded />
                        </template>
                    </Column>

                    <Column header="输入概览" style="min-width: 18rem">
                        <template #body="{ data }">
                            <div class="flex flex-col gap-2 text-sm">
                                <div v-for="(input, index) in data.testCaseInput?.slice(0, 3)" :key="input.id ?? `${data.id}-input-${index}`" class="input-chip">
                                    <span class="font-medium">{{ input.testCaseName || `输入 ${index + 1}` }}</span>
                                    <span class="text-color-secondary">{{ input.inputType || '文本' }}</span>
                                    <div class="text-xs whitespace-pre-line">{{ input.inputContent }}</div>
                                </div>
                                <span v-if="(data.testCaseInput?.length ?? 0) > 3" class="text-xs text-color-secondary"> 其余 {{ (data.testCaseInput?.length ?? 0) - 3 }} 条输入… </span>
                            </div>
                        </template>
                    </Column>

                    <Column header="操作" style="width: 12rem" bodyClass="text-right">
                        <template #body="{ data }">
                            <div class="flex justify-end gap-2">
                                <Button icon="pi pi-pencil" label="编辑" severity="secondary" text size="small" @click="openEditForm(data)" />
                                <Button icon="pi pi-trash" label="删除" severity="danger" text size="small" :loading="saving" @click="requestDeleteTestCase(data)" />
                            </div>
                        </template>
                    </Column>

                    <template #expansion="{ data }">
                        <div class="expansion-panel">
                            <div class="expansion-header">
                                <div class="flex items-center gap-3">
                                    <Tag value="详细输入" severity="info" rounded />
                                    <span class="text-sm text-color-secondary">共 {{ data.testCaseInput?.length ?? 0 }} 条</span>
                                </div>
                                <div class="flex items-center gap-3 text-sm">
                                    <span>类型：{{ data.testCaseOutput?.outputType || '未设置' }}</span>
                                    <span>分值：{{ data.testCaseOutput?.score ?? 0 }}</span>
                                    <Tag :value="data.testCaseOutput?.isSample ? '样例' : '普通'" :severity="data.testCaseOutput?.isSample ? 'success' : 'secondary'" />
                                </div>
                            </div>

                            <div class="grid gap-3 md:grid-cols-2">
                                <div v-for="(input, index) in data.testCaseInput" :key="input.id ?? `${data.id}-full-${index}`" class="expansion-input">
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="flex flex-col">
                                            <span class="font-medium text-sm">{{ input.testCaseName || `输入 ${index + 1}` }}</span>
                                            <small class="text-color-secondary">类型：{{ input.inputType || '文本' }}</small>
                                        </div>
                                        <Tag :value="`顺序 ${input.orderIndex ?? index}`" severity="secondary" rounded />
                                    </div>
                                    <pre class="expansion-content">{{ input.inputContent || '无内容' }}</pre>
                                </div>
                            </div>
                        </div>
                    </template>
                </DataTable>

                <Transition name="fade">
                    <div v-if="formVisible" class="card form-panel">
                        <div class="flex items-center justify-between mb-4">
                            <div class="text-lg font-semibold">{{ formMode === 'create' ? '新建测试用例' : '编辑测试用例' }}</div>
                            <Button icon="pi pi-times" text rounded severity="secondary" @click="closeForm" />
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                            <div class="flex flex-col gap-2 md:col-span-2">
                                <label class="text-sm font-medium text-color-secondary">期望输出</label>
                                <Textarea v-model.trim="formState.testCaseOutput!.output" rows="4" autoResize :invalid="!!formErrors.output" placeholder="请输入期望的输出内容" />
                                <Transition name="fade">
                                    <small v-if="formErrors.output" class="text-xs text-red-500">{{ formErrors.output }}</small>
                                </Transition>
                            </div>

                            <div class="flex flex-col gap-2">
                                <label class="text-sm font-medium text-color-secondary">输出类型</label>
                                <InputText v-model.trim="formState.testCaseOutput!.outputType" placeholder="例如：TEXT/JSON" />
                            </div>

                            <div class="flex flex-col gap-2">
                                <label class="text-sm font-medium text-color-secondary">分值</label>
                                <InputNumber v-model="formState.testCaseOutput!.score" showButtons :min="0" />
                            </div>

                            <div class="flex flex-col gap-2">
                                <label class="text-sm font-medium text-color-secondary">是否为样例</label>
                                <Select
                                    v-model="formState.testCaseOutput!.isSample"
                                    :options="[
                                        { label: '否', value: false },
                                        { label: '是', value: true }
                                    ]"
                                    optionLabel="label"
                                    optionValue="value"
                                />
                            </div>
                        </div>

                        <Divider />

                        <div class="flex items-center justify-between mb-2">
                            <div class="text-base font-semibold">输入列表</div>
                            <Button icon="pi pi-plus" label="新增输入" text size="small" @click="addInputRow" />
                        </div>

                        <Transition name="fade">
                            <small v-if="formErrors.inputs" class="block mb-2 text-xs text-red-500">{{ formErrors.inputs }}</small>
                        </Transition>

                        <div class="flex flex-col gap-4">
                            <div v-for="(input, index) in formState.testCaseInput" :key="input.id ?? `new-input-${index}`" class="input-editor">
                                <div class="flex items-center justify-between mb-3">
                                    <span class="font-medium">输入 {{ index + 1 }}</span>
                                    <Button icon="pi pi-trash" text rounded severity="danger" @click="removeInputRow(index)" />
                                </div>

                                <div class="grid gap-3 md:grid-cols-3">
                                    <div class="flex flex-col gap-2">
                                        <label class="text-xs text-color-secondary">名称</label>
                                        <InputText v-model.trim="input.testCaseName" placeholder="例如：样例输入" />
                                    </div>

                                    <div class="flex flex-col gap-2">
                                        <label class="text-xs text-color-secondary">类型</label>
                                        <InputText v-model.trim="input.inputType" placeholder="例如：TEXT/FILE" />
                                    </div>

                                    <div class="flex flex-col gap-2">
                                        <label class="text-xs text-color-secondary">顺序</label>
                                        <InputNumber v-model="input.orderIndex" showButtons :min="0" />
                                    </div>
                                </div>

                                <div class="flex flex-col gap-2 mt-3">
                                    <label class="text-xs text-color-secondary">输入内容</label>
                                    <Textarea v-model.trim="input.inputContent" rows="3" autoResize placeholder="请输入对应的输入值" />
                                </div>
                            </div>
                        </div>

                        <Divider />

                        <div class="flex justify-end gap-2">
                            <Button type="button" label="取消" severity="secondary" outlined :disabled="saving" @click="closeForm" />
                            <Button type="button" label="保存" :loading="saving" @click="submitForm" />
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </div>
</template>

<style scoped>
.text-color-secondary {
    color: var(--text-color-secondary);
}

.problem-testcases-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.page-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1.5rem;
    align-items: flex-start;
}

.page-header-left {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    flex: 1 1 380px;
}

.page-title-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.page-title {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.35;
}

.page-subtitle {
    color: var(--text-color-secondary);
    font-size: 0.85rem;
}

.page-header-right {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-end;
    flex: 1 1 320px;
}

.header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
}

.page-alert {
    border-left: 3px solid var(--yellow-500);
    background: rgba(255, 193, 7, 0.12);
    padding: 0.75rem 1rem;
    border-radius: var(--border-radius);
    font-size: 0.9rem;
}

.truncate-lines {
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-line;
}

.input-chip {
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: 0.75rem;
    background: var(--surface-section);
}

.form-panel {
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: 1.5rem;
}

.input-editor {
    border: 1px dashed var(--surface-border);
    border-radius: var(--border-radius);
    padding: 1rem;
}

.stats-grid {
    width: 100%;
}

.stat-card {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.stat-label {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
}

.stat-value {
    font-size: 1.25rem;
    font-weight: 600;
}

.expansion-panel {
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    padding: 1.25rem;
    background: var(--surface-section);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.expansion-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.expansion-input {
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    background: var(--surface-card);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.expansion-content {
    margin: 0;
    font-size: 0.85rem;
    white-space: pre-wrap;
    line-height: 1.4;
}

@media screen and (max-width: 767px) {
    .stats-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .page-header {
        gap: 1rem;
    }

    .page-header-left {
        flex: 1 1 auto;
    }

    .page-header-right {
        width: 100%;
        align-items: stretch;
    }

    .header-actions {
        justify-content: space-between;
    }

    .expansion-panel {
        padding: 1rem;
    }

    .expansion-input {
        padding: 0.75rem;
    }
}
</style>
