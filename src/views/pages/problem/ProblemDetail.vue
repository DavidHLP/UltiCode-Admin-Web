<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
    getAdminProblemDetail,
    updateProblem,
    type AdminProblemDetailDto,
    type Problem,
    type ProblemLocale,
    type ProblemLanguageConfig,
    type TestcaseGroup,
    type Testcase,
    type TestcaseStep,
    updateProblemTags,
    createLocale,
    updateLocale,
    deleteLocale,
    createLangConfig,
    updateLangConfig,
    deleteLangConfig,
    createGroup,
    updateGroup,
    deleteGroup,
    createTestcase,
    updateTestcase,
    deleteTestcase,
    createStep,
    updateStep,
    deleteStep
} from '@/api/problem/problem';
import { useToast } from 'primevue/usetoast';
import ProblemDescriptionEditor from '@/components/problem/ProblemDescriptionEditor.vue';

const route = useRoute();
const toast = useToast();
const id = Number(route.params.id);

const loading = ref(false);
const detail = ref<AdminProblemDetailDto | null>(null);

const p = computed(() => detail.value?.problem as Problem | undefined);
const tagsAll = computed(() => detail.value?.allTags ?? []);
const selectedTagIds = ref<number[]>([]);

// dialogs state and form models
const showLocaleDlg = ref(false);
const localeEditing = ref<ProblemLocale | null>(null);
const showLangCfgDlg = ref(false);
const langCfgEditing = ref<ProblemLanguageConfig | null>(null);
const showGroupDlg = ref(false);
const groupEditing = ref<TestcaseGroup | null>(null);
const showTcDlg = ref(false);
const tcEditing = ref<Testcase | null>(null);
const showStepDlg = ref(false);
const stepEditing = ref<TestcaseStep | null>(null);

async function load() {
    loading.value = true;
    try {
        const res = await getAdminProblemDetail(id);
        detail.value = res;
        selectedTagIds.value = [...(res.selectedTagIds || [])];
    } finally {
        loading.value = false;
    }
}

async function saveBase() {
    if (!p.value) return;
    await updateProblem(id, p.value);
    toast.add({ severity: 'success', summary: '基础信息已保存', life: 1200 });
}

async function saveTags() {
    await updateProblemTags(id, selectedTagIds.value);
    toast.add({ severity: 'success', summary: '标签已更新', life: 1200 });
}

function openCreateLocale() {
    localeEditing.value = { problemId: id, langCode: 'zh-CN', title: '', descriptionMd: '', constraintsMd: '', examplesMd: '' };
    showLocaleDlg.value = true;
}
function openEditLocale(row: ProblemLocale) {
    localeEditing.value = { ...row };
    showLocaleDlg.value = true;
}
async function submitLocale() {
    if (!localeEditing.value) return;
    const m = localeEditing.value;
    if (m.id) await updateLocale(m.id, m);
    else await createLocale(m);
    toast.add({ severity: 'success', summary: '已保存', life: 1000 });
    showLocaleDlg.value = false;
    load();
}
async function removeLocale(row: ProblemLocale) {
    if (!row.id) return;
    await deleteLocale(row.id);
    toast.add({ severity: 'success', summary: '已删除', life: 1000 });
    load();
}

function openCreateLangCfg() {
    langCfgEditing.value = { problemId: id, language: 'java', functionName: 'solve', starterCode: '' };
    showLangCfgDlg.value = true;
}
function openEditLangCfg(row: ProblemLanguageConfig) {
    langCfgEditing.value = { ...row };
    showLangCfgDlg.value = true;
}
async function submitLangCfg() {
    if (!langCfgEditing.value) return;
    const m = langCfgEditing.value;
    if (m.id) await updateLangConfig(m.id, m);
    else await createLangConfig(m);
    toast.add({ severity: 'success', summary: '已保存', life: 1000 });
    showLangCfgDlg.value = false;
    load();
}
async function removeLangCfg(row: ProblemLanguageConfig) {
    if (!row.id) return;
    await deleteLangConfig(row.id);
    toast.add({ severity: 'success', summary: '已删除', life: 1000 });
    load();
}

function openCreateGroup() {
    groupEditing.value = { problemId: id, name: '默认分组', isSample: false, weight: 1 };
    showGroupDlg.value = true;
}
function openEditGroup(row: TestcaseGroup) {
    groupEditing.value = { ...row };
    showGroupDlg.value = true;
}
async function submitGroup() {
    if (!groupEditing.value) return;
    const m = groupEditing.value;
    if ((m as any).id) await updateGroup((m as any).id, m);
    else await createGroup(m);
    toast.add({ severity: 'success', summary: '分组已保存', life: 1000 });
    showGroupDlg.value = false;
    load();
}
async function removeGroup(row: TestcaseGroup) {
    const gid = (row as any).id;
    if (!gid) return;
    await deleteGroup(gid);
    toast.add({ severity: 'success', summary: '分组已删除', life: 1000 });
    load();
}

function openCreateTestcase(groupId: number) {
    tcEditing.value = { groupId, orderIndex: 1, outputType: 'string', score: 0 };
    showTcDlg.value = true;
}
function openEditTestcase(row: Testcase) {
    tcEditing.value = { ...row };
    showTcDlg.value = true;
}
async function submitTestcase() {
    if (!tcEditing.value) return;
    const m = tcEditing.value;
    if ((m as any).id) await updateTestcase((m as any).id, m);
    else await createTestcase(m);
    toast.add({ severity: 'success', summary: '测试用例已保存', life: 1000 });
    showTcDlg.value = false;
    load();
}
async function removeTestcase(row: Testcase) {
    const id = (row as any).id;
    if (!id) return;
    await deleteTestcase(id);
    toast.add({ severity: 'success', summary: '测试用例已删除', life: 1000 });
    load();
}

function openCreateStep(testcaseId: number) {
    stepEditing.value = { testcaseId, stepIndex: 1, inputContent: '', expectedOutput: '' };
    showStepDlg.value = true;
}
function openEditStep(row: TestcaseStep) {
    stepEditing.value = { ...row };
    showStepDlg.value = true;
}
async function submitStep() {
    if (!stepEditing.value) return;
    const m = stepEditing.value;
    if ((m as any).id) await updateStep((m as any).id, m);
    else await createStep(m);
    toast.add({ severity: 'success', summary: '步骤已保存', life: 1000 });
    showStepDlg.value = false;
    load();
}
async function removeStep(row: TestcaseStep) {
    const id = (row as any).id;
    if (!id) return;
    await deleteStep(id);
    toast.add({ severity: 'success', summary: '步骤已删除', life: 1000 });
    load();
}

onMounted(load);
</script>

<template>
    <div class="p-4" v-if="detail">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold">题目管理 #{{ detail.problem.id }} - {{ detail.problem.slug }}</h2>
            <Button label="刷新" icon="pi pi-refresh" outlined @click="load" />
        </div>

        <TabView>
            <TabPanel header="基础信息">
                <div class="grid grid-cols-2 gap-4 max-w-4xl">
                    <div class="flex items-center gap-3">
                        <label class="w-32 text-right">Slug</label>
                        <InputText v-model="detail.problem.slug" class="flex-1" />
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="w-32 text-right">类型</label>
                        <InputText v-model="detail.problem.problemType" class="flex-1" />
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="w-32 text-right">时间限制(ms)</label>
                        <InputNumber v-model="detail.problem.timeLimitMs" class="flex-1" :min="0" />
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="w-32 text-right">内存限制(KB)</label>
                        <InputNumber v-model="detail.problem.memoryLimitKb" class="flex-1" :min="0" />
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="w-32 text-right">可见</label>
                        <InputSwitch v-model="detail.problem.isVisible" />
                    </div>
                </div>
                <div class="mt-4">
                    <Button label="保存" icon="pi pi-check" @click="saveBase" />
                </div>
            </TabPanel>

            <TabPanel header="多语言内容">
                <div class="mb-3">
                    <Button label="新增语言" icon="pi pi-plus" @click="openCreateLocale" />
                </div>
                <DataTable :value="detail.locales" dataKey="id">
                    <Column field="id" header="ID" style="width: 80px" />
                    <Column field="langCode" header="语言" style="width: 120px" />
                    <Column field="title" header="标题" />
                    <Column header="操作" style="width: 220px">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button label="编辑" size="small" icon="pi pi-pencil" @click="openEditLocale(data)" />
                                <Button label="删除" size="small" icon="pi pi-trash" severity="danger" outlined @click="removeLocale(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>

            <TabPanel header="标签">
                <div class="max-w-3xl">
                    <MultiSelect v-model="selectedTagIds" display="chip" :options="tagsAll" optionLabel="name" optionValue="id" placeholder="选择标签" class="w-full" />
                    <div class="mt-3">
                        <Button label="保存标签" icon="pi pi-check" @click="saveTags" />
                    </div>
                </div>
            </TabPanel>

            <TabPanel header="语言配置">
                <div class="mb-3">
                    <Button label="新增配置" icon="pi pi-plus" @click="openCreateLangCfg" />
                </div>
                <DataTable :value="detail.languageConfigs" dataKey="id">
                    <Column field="id" header="ID" style="width: 80px" />
                    <Column field="language" header="语言" style="width: 140px" />
                    <Column field="functionName" header="入口函数" style="width: 160px" />
                    <Column header="操作" style="width: 220px">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button label="编辑" size="small" icon="pi pi-pencil" @click="openEditLangCfg(data)" />
                                <Button label="删除" size="small" icon="pi pi-trash" severity="danger" outlined @click="removeLangCfg(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>

            <TabPanel header="测试用例">
                <div class="mb-3">
                    <Button label="新增分组" icon="pi pi-plus" @click="openCreateGroup" />
                </div>
                <Accordion multiple>
                    <AccordionTab v-for="g in detail.groups" :key="g.group.id" :header="`${g.group.name} ${g.group.isSample ? '(样例)' : ''}`">
                        <div class="mb-2 flex justify-end">
                            <Button label="编辑分组" size="small" icon="pi pi-pencil" @click="openEditGroup(g.group)" class="mr-2" />
                            <Button label="删除分组" size="small" icon="pi pi-trash" severity="danger" outlined @click="removeGroup(g.group)" />
                        </div>
                        <div class="mb-2">
                            <Button label="新增用例" size="small" icon="pi pi-plus" @click="openCreateTestcase(g.group.id as number)" />
                        </div>
                        <DataTable :value="g.testcases" dataKey="testcase.id">
                            <Column field="testcase.id" header="ID" style="width: 80px" />
                            <Column field="testcase.orderIndex" header="序号" style="width: 90px" />
                            <Column field="testcase.outputType" header="输出类型" style="width: 140px" />
                            <Column field="testcase.score" header="分值" style="width: 100px" />
                            <Column header="步骤数" style="width: 100px">
                                <template #body="{ data }">{{ data.steps?.length || 0 }}</template>
                            </Column>
                            <Column header="操作" style="width: 320px">
                                <template #body="{ data }">
                                    <div class="flex gap-2 flex-wrap">
                                        <Button label="编辑用例" size="small" icon="pi pi-pencil" @click="openEditTestcase(data.testcase)" />
                                        <Button label="删除用例" size="small" icon="pi pi-trash" severity="danger" outlined @click="removeTestcase(data.testcase)" />
                                        <Button label="新增步骤" size="small" icon="pi pi-plus" outlined @click="openCreateStep(data.testcase.id as number)" />
                                    </div>
                                </template>
                            </Column>
                        </DataTable>

                        <div v-for="t in g.testcases" :key="t.testcase.id" class="mt-2 border p-3 rounded">
                            <h4 class="font-medium mb-2">用例 #{{ t.testcase.id }} 步骤</h4>
                            <DataTable :value="t.steps" dataKey="id">
                                <Column field="id" header="ID" style="width: 80px" />
                                <Column field="stepIndex" header="序号" style="width: 90px" />
                                <Column field="inputContent" header="输入" />
                                <Column field="expectedOutput" header="期望输出" />
                                <Column header="操作" style="width: 220px">
                                    <template #body="{ data }">
                                        <div class="flex gap-2">
                                            <Button label="编辑" size="small" icon="pi pi-pencil" @click="openEditStep(data)" />
                                            <Button label="删除" size="small" icon="pi pi-trash" severity="danger" outlined @click="removeStep(data)" />
                                        </div>
                                    </template>
                                </Column>
                            </DataTable>
                        </div>
                    </AccordionTab>
                </Accordion>
            </TabPanel>

            <TabPanel header="统计">
                <div class="grid grid-cols-4 gap-4">
                    <Card
                        ><template #title>提交数</template><template #content>{{ detail.stat?.submissionCount ?? 0 }}</template></Card
                    >
                    <Card
                        ><template #title>通过数</template><template #content>{{ detail.stat?.solvedCount ?? 0 }}</template></Card
                    >
                    <Card
                        ><template #title>赞同</template><template #content>{{ detail.stat?.likesCount ?? 0 }}</template></Card
                    >
                    <Card
                        ><template #title>反对</template><template #content>{{ detail.stat?.dislikesCount ?? 0 }}</template></Card
                    >
                </div>
            </TabPanel>
        </TabView>

        <!-- Locale Dialog -->
        <Dialog v-model:visible="showLocaleDlg" modal :style="{ width: '980px' }" header="编辑多语言">
            <div v-if="localeEditing" class="space-y-3">
                <div class="flex items-center gap-3">
                    <label class="w-24 text-right">语言</label>
                    <InputText v-model="localeEditing.langCode" class="w-48" placeholder="zh-CN/en" />
                    <label class="w-24 text-right">标题</label>
                    <InputText v-model="localeEditing.title" class="flex-1" placeholder="标题" />
                </div>
                <div>
                    <label class="block mb-2">描述</label>
                    <ProblemDescriptionEditor v-model="localeEditing.descriptionMd" placeholder="Markdown 描述" />
                </div>
                <div>
                    <label class="block mb-2">限制</label>
                    <ProblemDescriptionEditor v-model="localeEditing.constraintsMd" placeholder="输入输出限制等" />
                </div>
                <div>
                    <label class="block mb-2">样例</label>
                    <ProblemDescriptionEditor v-model="localeEditing.examplesMd" placeholder="样例说明" />
                </div>
            </div>
            <template #footer>
                <Button label="取消" icon="pi pi-times" outlined @click="showLocaleDlg = false" />
                <Button label="保存" icon="pi pi-check" @click="submitLocale" />
            </template>
        </Dialog>

        <!-- Language Config Dialog -->
        <Dialog v-model:visible="showLangCfgDlg" modal :style="{ width: '680px' }" header="编辑语言配置">
            <div v-if="langCfgEditing" class="space-y-3">
                <div class="flex items-center gap-3">
                    <label class="w-28 text-right">语言</label>
                    <InputText v-model="langCfgEditing.language" class="w-48" placeholder="java/python3/cpp" />
                    <label class="w-28 text-right">入口函数</label>
                    <InputText v-model="langCfgEditing.functionName" class="flex-1" placeholder="solve/main" />
                </div>
                <div>
                    <label class="block mb-2">模板代码</label>
                    <Textarea v-model="langCfgEditing.starterCode" rows="10" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="取消" icon="pi pi-times" outlined @click="showLangCfgDlg = false" />
                <Button label="保存" icon="pi pi-check" @click="submitLangCfg" />
            </template>
        </Dialog>

        <!-- Group Dialog -->
        <Dialog v-model:visible="showGroupDlg" modal header="编辑分组" :style="{ width: '520px' }">
            <div v-if="groupEditing" class="space-y-3">
                <div class="flex items-center gap-3">
                    <label class="w-28 text-right">名称</label>
                    <InputText v-model="groupEditing.name" class="flex-1" />
                </div>
                <div class="flex items-center gap-3">
                    <label class="w-28 text-right">是否样例</label>
                    <InputSwitch v-model="groupEditing.isSample" />
                </div>
                <div class="flex items-center gap-3">
                    <label class="w-28 text-right">权重</label>
                    <InputNumber v-model="groupEditing.weight" :min="0" />
                </div>
            </div>
            <template #footer>
                <Button label="取消" icon="pi pi-times" outlined @click="showGroupDlg = false" />
                <Button label="保存" icon="pi pi-check" @click="submitGroup" />
            </template>
        </Dialog>

        <!-- Testcase Dialog -->
        <Dialog v-model:visible="showTcDlg" modal header="编辑用例" :style="{ width: '700px' }">
            <div v-if="tcEditing" class="space-y-3">
                <div class="flex items-center gap-3">
                    <label class="w-28 text-right">序号</label>
                    <InputNumber v-model="tcEditing.orderIndex" :min="1" />
                    <label class="w-28 text-right">输出类型</label>
                    <InputText v-model="tcEditing.outputType" class="flex-1" placeholder="string/int/array<int>" />
                    <label class="w-20 text-right">分值</label>
                    <InputNumber v-model="tcEditing.score" :min="0" />
                </div>
                <div>
                    <label class="block mb-2">输入(JSON)</label>
                    <Textarea v-model="(tcEditing as any).inputJson" rows="6" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">输出(JSON)</label>
                    <Textarea v-model="(tcEditing as any).outputJson" rows="6" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="取消" icon="pi pi-times" outlined @click="showTcDlg = false" />
                <Button label="保存" icon="pi pi-check" @click="submitTestcase" />
            </template>
        </Dialog>

        <!-- Step Dialog -->
        <Dialog v-model:visible="showStepDlg" modal header="编辑步骤" :style="{ width: '680px' }">
            <div v-if="stepEditing" class="space-y-3">
                <div class="flex items-center gap-3">
                    <label class="w-28 text-right">序号</label>
                    <InputNumber v-model="stepEditing.stepIndex" :min="1" />
                </div>
                <div>
                    <label class="block mb-2">输入</label>
                    <Textarea v-model="stepEditing.inputContent" rows="6" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">期望输出</label>
                    <Textarea v-model="stepEditing.expectedOutput" rows="6" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="取消" icon="pi pi-times" outlined @click="showStepDlg = false" />
                <Button label="保存" icon="pi pi-check" @click="submitStep" />
            </template>
        </Dialog>
    </div>
    <div v-else class="p-6">
        <Skeleton height="2rem" class="mb-3" />
        <Skeleton height="20rem" />
    </div>
</template>

<style scoped></style>
