<script setup lang="ts">
import type { Problem } from '@/api/problem';
import { createSolutionsTestCase, deleteSolutionsTestCase, fetchAllSolutionsTestCases, updateSolutionsTestCase, type TestCase, type TestCaseInput, type TestCaseOutput } from '@/api/testcase';
import { emitErrorToast, emitSuccessToast } from '@/utils/toast';
import { useConfirm } from 'primevue/useconfirm';
import { computed, reactive, ref, watch } from 'vue';

interface Props {
    visible: boolean;
    problem: Problem | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'saved'): void;
}>();

const dialogVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => emit('update:visible', value)
});

const confirm = useConfirm();

const loading = ref(false);
const saving = ref(false);
const testCases = ref<TestCase[]>([]);
const formMode = ref<'create' | 'edit'>('create');
const formVisible = ref(false);

const formState = reactive<TestCase>(createEmptyTestCase());
const formErrors = reactive<{ output?: string; inputs?: string }>({});

watch(
    () => props.visible,
    (visible) => {
        if (visible && props.problem?.id != null) {
            loadTestCases();
        } else if (!visible) {
            resetState();
        }
    }
);

watch(
    () => props.problem?.id,
    (problemId, previous) => {
        if (!props.visible) {
            return;
        }
        if (problemId !== previous && problemId != null) {
            loadTestCases();
        }
    }
);

function resetState() {
    testCases.value = [];
    formVisible.value = false;
    formMode.value = 'create';
    resetForm();
    clearErrors();
}

function clearErrors() {
    formErrors.output = undefined;
    formErrors.inputs = undefined;
}

function createEmptyOutput(problemId?: number | null): TestCaseOutput {
    return {
        id: null,
        problemId: problemId ?? null,
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
    const problemId = props.problem?.id ?? null;
    return {
        id: null,
        problemId,
        testCaseOutput: createEmptyOutput(problemId),
        testCaseInput: [createEmptyInput(0)]
    };
}

function normalizeFetchedTestCase(testCase: TestCase): TestCase {
    const problemId = props.problem?.id ?? testCase.problemId ?? null;
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

async function loadTestCases() {
    if (!props.problem?.id) {
        testCases.value = [];
        return;
    }
    loading.value = true;
    try {
        const data = await fetchAllSolutionsTestCases(props.problem.id);
        testCases.value = Array.isArray(data) ? data.map(normalizeFetchedTestCase) : [];
    } catch (error) {
        console.error('加载测试用例失败:', error);
        emitErrorToast('加载测试用例失败，请稍后重试');
    } finally {
        loading.value = false;
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
    const problemId = props.problem?.id ?? null;
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
    if (!props.problem?.id) {
        emitErrorToast('缺少题目信息，无法保存测试用例');
        return;
    }
    if (!validateForm()) {
        return;
    }
    saving.value = true;
    const payload = buildPayload();
    payload.problemId = props.problem.id;
    if (payload.testCaseOutput) {
        payload.testCaseOutput.problemId = props.problem.id;
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
        emit('saved');
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
        emit('saved');
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

function handleDialogHide() {
    emit('update:visible', false);
}
</script>

<template>
    <Dialog
        v-model:visible="dialogVisible"
        :modal="true"
        :style="{ width: '960px', maxWidth: '95vw' }"
        :draggable="false"
        :closable="!saving"
        contentClass="p-0"
        :header="`测试用例管理 - ${props.problem?.title ?? '未选择题目'}`"
        @hide="handleDialogHide"
    >
        <div class="flex flex-col gap-4 p-6">
            <ConfirmDialog />

            <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                    <div class="text-lg font-semibold">{{ props.problem?.title ?? '未选择题目' }}</div>
                    <small class="text-color-secondary">函数名称：{{ props.problem?.solutionFunctionName ?? '—' }}</small>
                </div>
                <Button icon="pi pi-plus" label="新建测试用例" severity="success" outlined :disabled="!props.problem?.id" @click="openCreateForm" />
            </div>

            <DataTable :value="testCases" dataKey="id" :loading="loading" showGridlines responsiveLayout="scroll">
                <template #empty> 暂无测试用例 </template>
                <template #loading> 正在加载测试用例… </template>

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
    </Dialog>
</template>

<style scoped>
.text-color-secondary {
    color: var(--text-color-secondary);
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
</style>
