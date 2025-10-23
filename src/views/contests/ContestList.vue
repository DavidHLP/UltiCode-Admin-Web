<script setup lang="ts">
import {
    createContest,
    deleteContest,
    fetchContestOptions,
    fetchContests,
    updateContest,
    type ContestDetail,
    type ContestKindOption,
    type ContestOptions,
    type ContestQuery,
    type ContestStatus,
    type ContestSummary,
    type ContestUpsertPayload
} from '@/api/contests/contest';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const toast = useToast();

const contests = ref<ContestSummary[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const keyword = ref('');
const kindFilter = ref<string | null>(null);
const statusFilter = ref<ContestStatus | null>(null);
const visibilityFilter = ref<'public' | 'private' | null>(null);
const loading = ref(false);

const options = ref<ContestOptions | null>(null);
const createDialogVisible = ref(false);
const editingContestId = ref<number | null>(null);
const submitting = ref(false);

const formModel = reactive({
    title: '',
    descriptionMd: '',
    kind: '',
    visible: true,
    startTime: null as Date | null,
    endTime: null as Date | null
});

const kindOptions = computed(() => options.value?.kinds ?? []);
const statusOptions = computed(() => options.value?.statuses ?? []);

const visibilityOptions = [
    { label: '公开', value: 'public' as const },
    { label: '私有', value: 'private' as const }
];

onMounted(async () => {
    await loadOptions();
    await loadContests();
});

watch([kindFilter, statusFilter, visibilityFilter], () => {
    page.value = 1;
    loadContests();
});

function resetForm() {
    formModel.title = '';
    formModel.descriptionMd = '';
    formModel.kind = kindOptions.value[0]?.code ?? 'icpc';
    formModel.visible = true;
    formModel.startTime = null;
    formModel.endTime = null;
}

async function loadOptions() {
    try {
        const data = await fetchContestOptions();
        options.value = data;
        if (!formModel.kind && data.kinds?.length) {
            formModel.kind = data.kinds[0]?.code ?? 'icpc';
        }
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: (error as Error)?.message ?? '加载比赛选项失败',
            life: 4000
        });
    }
}

async function loadContests() {
    loading.value = true;
    try {
        const params: ContestQuery = {
            page: page.value,
            size: size.value,
            keyword: keyword.value?.trim() || undefined,
            kind: kindFilter.value || undefined,
            status: statusFilter.value || undefined,
            visible:
                visibilityFilter.value == null
                    ? undefined
                    : visibilityFilter.value === 'public',
            startFrom: undefined,
            endTo: undefined
        };
        const data = await fetchContests(params);
        contests.value = data.items ?? [];
        total.value = Number(data.total ?? 0);
        if (data.page !== undefined) {
            page.value = Number(data.page);
        }
        if (data.size !== undefined) {
            size.value = Number(data.size);
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载比赛列表失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function openCreateDialog() {
    editingContestId.value = null;
    resetForm();
    createDialogVisible.value = true;
}

function openEditDialog(contest: ContestSummary) {
    editingContestId.value = contest.id;
    formModel.title = contest.title;
    formModel.descriptionMd = '';
    formModel.kind = contest.kind;
    formModel.visible = !!contest.visible;
    formModel.startTime = contest.startTime ? new Date(contest.startTime) : null;
    formModel.endTime = contest.endTime ? new Date(contest.endTime) : null;
    createDialogVisible.value = true;
}

function closeDialog() {
    if (submitting.value) {
        return;
    }
    createDialogVisible.value = false;
}

function buildPayload(): ContestUpsertPayload | null {
    if (!formModel.startTime || !formModel.endTime) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: '请完善比赛起止时间',
            life: 3000
        });
        return null;
    }
    if (formModel.endTime < formModel.startTime) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: '结束时间必须晚于开始时间',
            life: 3000
        });
        return null;
    }
    const payload: ContestUpsertPayload = {
        title: formModel.title.trim(),
        descriptionMd: formModel.descriptionMd?.trim() || undefined,
        kind: formModel.kind,
        startTime: formModel.startTime.toISOString(),
        endTime: formModel.endTime.toISOString(),
        visible: formModel.visible
    };
    if (!payload.title) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: '比赛标题不能为空',
            life: 3000
        });
        return null;
    }
    return payload;
}

async function submitContest() {
    const payload = buildPayload();
    if (!payload) {
        return;
    }
    submitting.value = true;
    try {
        let result: ContestDetail;
        if (editingContestId.value) {
            result = await updateContest(editingContestId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '比赛信息已更新', life: 3000 });
        } else {
            result = await createContest(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '已创建新比赛', life: 3000 });
        }
        createDialogVisible.value = false;
        await loadContests();
        if (!editingContestId.value && result.id != null) {
            router.push({ name: 'adminContestDetail', params: { contestId: result.id } });
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存比赛失败',
            life: 4000
        });
    } finally {
        submitting.value = false;
    }
}

async function removeContest(contest: ContestSummary) {
    const confirmed = window.confirm(`确定删除比赛“${contest.title}”吗？该操作不可恢复。`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteContest(contest.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '比赛已删除', life: 3000 });
        await loadContests();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除比赛失败',
            life: 4000
        });
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadContests();
}

function visibilitySeverity(flag: boolean) {
    return flag ? 'success' : 'info';
}

function visibilityLabel(flag: boolean) {
    return flag ? '公开' : '私有';
}

function statusSeverity(status: string) {
    switch (status) {
        case 'RUNNING':
            return 'success';
        case 'UPCOMING':
            return 'info';
        case 'ENDED':
        default:
            return 'warning';
    }
}

function statusLabel(status: string) {
    switch (status) {
        case 'RUNNING':
            return '进行中';
        case 'UPCOMING':
            return '未开始';
        case 'ENDED':
        default:
            return '已结束';
    }
}

function kindLabel(kind: string) {
    const match = kindOptions.value.find((item: ContestKindOption) => item.code === kind);
    return match?.displayName ?? kind;
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

function openContestDetail(contest: ContestSummary) {
    router.push({ name: 'adminContestDetail', params: { contestId: contest.id } });
}

function onSearch() {
    page.value = 1;
    loadContests();
}

function clearFilters() {
    keyword.value = '';
    kindFilter.value = null;
    statusFilter.value = null;
    visibilityFilter.value = null;
    page.value = 1;
    loadContests();
}

function mapStatusOption(status: ContestStatus) {
    return { label: statusLabel(status), value: status };
}

const statusFilterOptions = computed(() => statusOptions.value.map(mapStatusOption));

</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 justify-between items-end mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <span class="p-input-icon-left">
                            <i class="pi pi-search" />
                            <InputText v-model="keyword" placeholder="搜索比赛标题" style="min-width: 18rem"
                                @keyup.enter="onSearch" />
                        </span>
                        <Dropdown v-model="kindFilter" :options="kindOptions" optionLabel="displayName"
                            optionValue="code" placeholder="比赛类型" :showClear="true" style="min-width: 12rem" />
                        <Dropdown v-model="statusFilter" :options="statusFilterOptions" optionLabel="label"
                            optionValue="value" placeholder="比赛状态" :showClear="true" style="min-width: 12rem" />
                        <Dropdown v-model="visibilityFilter" :options="visibilityOptions" optionLabel="label"
                            optionValue="value" placeholder="公开状态" :showClear="true" style="min-width: 10rem" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                        <Button label="新建比赛" icon="pi pi-plus" severity="success" @click="openCreateDialog" />
                    </div>
                </div>

                <DataTable :value="contests" dataKey="id" :loading="loading" :rows="size" :paginator="true" :lazy="true"
                    :totalRecords="total" :rowsPerPageOptions="[10, 20, 50]"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`" @page="onPageChange"
                    responsiveLayout="scroll">
                    <Column field="title" header="比赛名称" style="min-width: 18rem">
                        <template #body="{ data }">
                            <a class="hover:underline cursor-pointer" @click="openContestDetail(data)">
                                {{ data.title }}
                            </a>
                        </template>
                    </Column>
                    <Column field="kind" header="赛制" style="min-width: 8rem">
                        <template #body="{ data }">
                            {{ kindLabel(data.kind) }}
                        </template>
                    </Column>
                    <Column field="status" header="状态" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
                        </template>
                    </Column>
                    <Column field="startTime" header="开始时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.startTime) }}
                        </template>
                    </Column>
                    <Column field="endTime" header="结束时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.endTime) }}
                        </template>
                    </Column>
                    <Column field="visible" header="公开状态" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="visibilityLabel(data.visible)" :severity="visibilitySeverity(data.visible)" />
                        </template>
                    </Column>
                    <Column field="problemCount" header="题目数" style="min-width: 6rem" />
                    <Column field="participantCount" header="参赛人数" style="min-width: 6rem" />
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button label="详情" icon="pi pi-eye" text @click="openContestDetail(data)" />
                                <Button label="编辑" icon="pi pi-pencil" text severity="secondary"
                                    @click="openEditDialog(data)" />
                                <Button label="删除" icon="pi pi-trash" text severity="danger"
                                    @click="removeContest(data)" />
                            </div>
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无比赛信息</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="createDialogVisible" :header="editingContestId ? '编辑比赛' : '新建比赛'" :modal="true"
        :style="{ width: '42rem' }" :closable="!submitting" @hide="closeDialog">
        <div class="flex flex-col gap-4">
            <!-- 比赛标题 -->
            <div class="flex flex-col gap-2">
                <label for="contest-title">比赛标题</label>
                <InputText id="contest-title" v-model="formModel.title" placeholder="请输入比赛标题" />
            </div>

            <!-- 赛制类型与公开状态 -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex flex-col gap-2 w-full">
                    <label for="contest-kind">赛制类型</label>
                    <Dropdown id="contest-kind" v-model="formModel.kind" :options="kindOptions"
                        optionLabel="displayName" optionValue="code" placeholder="选择赛制" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="contest-visible">公开状态</label>
                    <SelectButton id="contest-visible" v-model="formModel.visible" :options="[
                        { label: '公开', value: true },
                        { label: '私有', value: false }
                    ]" optionLabel="label" optionValue="value" />
                </div>
            </div>

            <!-- 开始时间与结束时间 -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex flex-col gap-2 w-full">
                    <label for="contest-start">开始时间</label>
                    <Calendar id="contest-start" v-model="formModel.startTime" showIcon hourFormat="24" showTime
                        placeholder="选择开始时间" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="contest-end">结束时间</label>
                    <Calendar id="contest-end" v-model="formModel.endTime" showIcon hourFormat="24" showTime
                        placeholder="选择结束时间" />
                </div>
            </div>

            <!-- 比赛简介 -->
            <div class="flex flex-col gap-2">
                <label for="contest-description">比赛简介 (可选)</label>
                <Textarea id="contest-description" v-model="formModel.descriptionMd" rows="4" autoResize
                    placeholder="请输入比赛简介..." />
            </div>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="取消" severity="secondary" :disabled="submitting" @click="closeDialog" />
                <Button label="保存" icon="pi pi-check" :loading="submitting" @click="submitContest" />
            </div>
        </template>
    </Dialog>
</template>
