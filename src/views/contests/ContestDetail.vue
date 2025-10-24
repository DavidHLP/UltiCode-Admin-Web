<script setup lang="ts">
import type {
    ContestRegistration,
    ContestRegistrationDecisionPayload,
    ContestRegistrationQuery,
    ContestRegistrationStatusCode,
    ContestScoreboardRecord,
    ProblemSummaryOption,
    UserSummaryOption
} from '@/api/contests/contest';
import {
    addContestParticipants,
    createContestRegistration,
    fetchContest,
    fetchContestOptions,
    fetchContestRegistrations,
    fetchContestScoreboard,
    fetchContestSubmissions,
    decideContestRegistrations,
    removeContestParticipant,
    saveContestProblems,
    searchContestProblems,
    searchContestUsers,
    updateContest,
    type ContestDetail,
    type ContestKindOption,
    type ContestOptions,
    type ContestParticipantsPayload,
    type ContestProblemInput,
    type ContestScoreboard,
    type ContestSubmission,
    type ContestUpsertPayload
} from '@/api/contests/contest';
import { NDescriptions, NDescriptionsItem, NEmpty, NSkeleton } from 'naive-ui';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref, watch } from 'vue';

interface Props {
    contestId: string | number;
}

interface ProblemDraftItem extends ContestProblemInput {
    option?: ProblemSummaryOption | null;
}

const props = defineProps<Props>();
const toast = useToast();

const contestId = computed(() => Number(props.contestId));

const detail = ref<ContestDetail | null>(null);
const detailLoading = ref(false);
const options = ref<ContestOptions | null>(null);

const editDialogVisible = ref(false);
const editSubmitting = ref(false);
const editForm = reactive({
    title: '',
    descriptionMd: '',
    kind: '',
    visible: true,
    startTime: null as Date | null,
    endTime: null as Date | null,
    registrationMode: 'open',
    registrationStartTime: null as Date | null,
    registrationEndTime: null as Date | null,
    maxParticipants: null as number | null,
    penaltyPerWrong: 20,
    scoreboardFreezeMinutes: 0,
    hideScoreDuringFreeze: true
});

const problemDialogVisible = ref(false);
const problemDraft = ref<ProblemDraftItem[]>([]);
const problemSuggestions = ref<ProblemSummaryOption[]>([]);
const problemSearchLoading = ref(false);
const problemSubmitting = ref(false);

const participantSearchResults = ref<UserSummaryOption[]>([]);
const selectedParticipants = ref<UserSummaryOption[]>([]);
const participantSubmitting = ref(false);
const participantSearchLoading = ref(false);
const registrationInviteOption = ref<UserSummaryOption | null>(null);
const registrationInviteSuggestions = ref<UserSummaryOption[]>([]);
const registrationInviteLoading = ref(false);
const creatingRegistration = ref(false);
const registrationStatusOptionsItems: { label: string; value: ContestRegistrationStatusCode }[] = [
    { label: '待审核', value: 'pending' },
    { label: '已通过', value: 'approved' },
    { label: '已驳回', value: 'rejected' },
    { label: '已取消', value: 'cancelled' }
];

const scoreboard = ref<ContestScoreboard | null>(null);
const scoreboardLoading = ref(false);

const registrations = ref<ContestRegistration[]>([]);
const registrationsLoading = ref(false);
const registrationPage = ref(1);
const registrationSize = ref(20);
const registrationTotal = ref(0);
const registrationStatusFilter = ref<ContestRegistrationStatusCode | null>(null);

const submissions = ref<ContestSubmission[]>([]);
const submissionPage = ref(1);
const submissionSize = ref(20);
const submissionTotal = ref(0);
const submissionsLoading = ref(false);
const verdictFilter = ref<string | null>(null);
const userFilter = ref<number | null>(null);
const problemFilter = ref<number | null>(null);

const verdictOptions = [
    'PD',
    'AC',
    'WA',
    'TLE',
    'MLE',
    'RE',
    'CE',
    'OLE',
    'PE',
    'IE'
];

onMounted(async () => {
    await loadOptions();
    await loadContest();
    await loadScoreboard();
    await loadSubmissions();
    await loadRegistrations();
});

watch([verdictFilter, userFilter, problemFilter], () => {
    submissionPage.value = 1;
    loadSubmissions();
});

watch(registrationStatusFilter, () => {
    registrationPage.value = 1;
    loadRegistrations();
});

async function loadOptions() {
    try {
        options.value = await fetchContestOptions();
        if (!editForm.registrationMode && options.value?.registrationModes?.length) {
            editForm.registrationMode = options.value.registrationModes[0] ?? 'open';
        }
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: (error as Error)?.message ?? '加载字典失败',
            life: 3000
        });
    }
}

async function loadContest() {
    detailLoading.value = true;
    try {
        detail.value = await fetchContest(contestId.value);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载比赛详情失败',
            life: 4000
        });
    } finally {
        detailLoading.value = false;
    }
}

async function loadScoreboard() {
    scoreboardLoading.value = true;
    try {
        scoreboard.value = await fetchContestScoreboard(contestId.value);
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: (error as Error)?.message ?? '生成榜单失败',
            life: 4000
        });
    } finally {
        scoreboardLoading.value = false;
    }
}

async function loadSubmissions() {
    submissionsLoading.value = true;
    try {
        const data = await fetchContestSubmissions(contestId.value, {
            page: submissionPage.value,
            size: submissionSize.value,
            verdict: verdictFilter.value ?? undefined,
            userId: userFilter.value ?? undefined,
            problemId: problemFilter.value ?? undefined
        });
        submissions.value = data.items ?? [];
        submissionTotal.value = Number(data.total ?? 0);
        if (data.page !== undefined) {
            submissionPage.value = Number(data.page);
        }
        if (data.size !== undefined) {
            submissionSize.value = Number(data.size);
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载提交列表失败',
            life: 4000
        });
    } finally {
        submissionsLoading.value = false;
    }
}

async function loadRegistrations() {
    registrationsLoading.value = true;
    try {
        const data = await fetchContestRegistrations(contestId.value, {
            page: registrationPage.value,
            size: registrationSize.value,
            status: registrationStatusFilter.value ?? undefined
        });
        registrations.value = data.items ?? [];
        registrationTotal.value = Number(data.total ?? 0);
        if (data.page !== undefined) {
            registrationPage.value = Number(data.page);
        }
        if (data.size !== undefined) {
            registrationSize.value = Number(data.size);
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载报名列表失败',
            life: 4000
        });
    } finally {
        registrationsLoading.value = false;
    }
}

async function updateRegistrationStatus(ids: number[], target: ContestRegistrationStatusCode) {
    if (!ids.length) {
        return;
    }
    try {
        await decideContestRegistrations(contestId.value, {
            registrationIds: ids,
            targetStatus: target
        } satisfies ContestRegistrationDecisionPayload);
        toast.add({
            severity: 'success',
            summary: '操作成功',
            detail: target === 'approved' ? '报名已通过审批' : '报名已驳回',
            life: 3000
        });
        await loadRegistrations();
        await loadContest();
        await loadScoreboard();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '更新报名状态失败',
            life: 4000
        });
    }
}

function approveRegistration(registration: ContestRegistration) {
    updateRegistrationStatus([registration.id], 'approved');
}

function rejectRegistration(registration: ContestRegistration) {
    updateRegistrationStatus([registration.id], 'rejected');
}

function openEditDialog() {
    if (!detail.value) {
        return;
    }
    const contest = detail.value;
    editForm.title = contest.title;
    editForm.descriptionMd = contest.descriptionMd ?? '';
    editForm.kind = contest.kind;
    editForm.visible = contest.visible ?? true;
    editForm.startTime = contest.startTime ? new Date(contest.startTime) : null;
    editForm.endTime = contest.endTime ? new Date(contest.endTime) : null;
    editForm.registrationMode = contest.registrationMode ?? 'open';
    editForm.registrationStartTime = contest.registrationStartTime
        ? new Date(contest.registrationStartTime)
        : null;
    editForm.registrationEndTime = contest.registrationEndTime
        ? new Date(contest.registrationEndTime)
        : null;
    editForm.maxParticipants = contest.maxParticipants ?? null;
    editForm.penaltyPerWrong = contest.penaltyPerWrong ?? 20;
    editForm.scoreboardFreezeMinutes = contest.scoreboardFreezeMinutes ?? 0;
    editForm.hideScoreDuringFreeze = contest.hideScoreDuringFreeze ?? true;
    editDialogVisible.value = true;
}

function closeEditDialog() {
    if (!editSubmitting.value) {
        editDialogVisible.value = false;
    }
}

function buildUpsertPayload(): ContestUpsertPayload | null {
    if (!editForm.startTime || !editForm.endTime) {
        toast.add({ severity: 'warn', summary: '提示', detail: '请填写比赛起止时间', life: 3000 });
        return null;
    }
    if (editForm.endTime < editForm.startTime) {
        toast.add({ severity: 'warn', summary: '提示', detail: '结束时间必须晚于开始时间', life: 3000 });
        return null;
    }
    if (
        editForm.registrationStartTime &&
        editForm.registrationEndTime &&
        editForm.registrationEndTime < editForm.registrationStartTime
    ) {
        toast.add({ severity: 'warn', summary: '提示', detail: '报名结束时间必须晚于报名开始时间', life: 3000 });
        return null;
    }
    const payload: ContestUpsertPayload = {
        title: editForm.title.trim(),
        descriptionMd: editForm.descriptionMd?.trim() || undefined,
        kind: editForm.kind,
        startTime: editForm.startTime.toISOString(),
        endTime: editForm.endTime.toISOString(),
        visible: editForm.visible,
        registrationMode: editForm.registrationMode,
        registrationStartTime: editForm.registrationStartTime
            ? editForm.registrationStartTime.toISOString()
            : null,
        registrationEndTime: editForm.registrationEndTime
            ? editForm.registrationEndTime.toISOString()
            : null,
        maxParticipants:
            editForm.maxParticipants == null ? null : Number(editForm.maxParticipants),
        penaltyPerWrong:
            editForm.penaltyPerWrong == null ? null : Math.max(0, Number(editForm.penaltyPerWrong)),
        scoreboardFreezeMinutes:
            editForm.scoreboardFreezeMinutes == null
                ? null
                : Math.max(0, Number(editForm.scoreboardFreezeMinutes)),
        hideScoreDuringFreeze: editForm.hideScoreDuringFreeze
    };
    if (!payload.title) {
        toast.add({ severity: 'warn', summary: '提示', detail: '比赛标题不能为空', life: 3000 });
        return null;
    }
    if (payload.maxParticipants !== null && payload.maxParticipants <= 0) {
        toast.add({ severity: 'warn', summary: '提示', detail: '参赛人数上限必须为正整数', life: 3000 });
        return null;
    }
    return payload;
}

async function submitEdit() {
    const payload = buildUpsertPayload();
    if (!payload) {
        return;
    }
    editSubmitting.value = true;
    try {
        await updateContest(contestId.value, payload);
        toast.add({ severity: 'success', summary: '保存成功', detail: '比赛基础信息已更新', life: 3000 });
        editDialogVisible.value = false;
        await loadContest();
        await loadScoreboard();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '保存失败',
            detail: (error as Error)?.message ?? '更新比赛信息失败',
            life: 4000
        });
    } finally {
        editSubmitting.value = false;
    }
}

function openProblemDialog() {
    if (!detail.value) {
        return;
    }
    problemDraft.value = detail.value.problems.map((item) => ({
        problemId: item.problemId,
        alias: item.alias ?? '',
        points: item.points ?? null,
        orderNo: item.orderNo ?? null,
        option: {
            id: item.problemId,
            slug: item.problemSlug ?? undefined,
            title: item.problemTitle ?? undefined,
            difficulty: item.acceptanceRate != null ? String(item.acceptanceRate) : undefined
        } as ProblemSummaryOption
    }));
    if (problemDraft.value.length === 0) {
        problemDraft.value.push({
            problemId: 0,
            alias: '',
            points: null,
            orderNo: 10,
            option: null
        });
    }
    problemDialogVisible.value = true;
}

function addProblemRow() {
    problemDraft.value.push({
        problemId: 0,
        alias: '',
        points: null,
        orderNo: (problemDraft.value.length + 1) * 10,
        option: null
    });
}

function removeProblemRow(index: number) {
    if (problemDraft.value.length <= 1) {
        toast.add({ severity: 'warn', summary: '提示', detail: '至少保留一道题目', life: 3000 });
        return;
    }
    problemDraft.value.splice(index, 1);
}

async function submitProblems() {
    const payloadList: ContestProblemInput[] = problemDraft.value.map((item) => ({
        problemId: Number(item.problemId || item.option?.id || 0),
        alias: item.alias?.trim() || undefined,
        points: item.points == null ? undefined : Number(item.points),
        orderNo: item.orderNo == null ? undefined : Number(item.orderNo)
    }));

    if (payloadList.some((item) => !item.problemId || item.problemId <= 0)) {
        toast.add({ severity: 'warn', summary: '提示', detail: '题目ID必须为正整数', life: 3000 });
        return;
    }

    problemSubmitting.value = true;
    try {
        await saveContestProblems(contestId.value, { problems: payloadList });
        toast.add({ severity: 'success', summary: '保存成功', detail: '题目配置已更新', life: 3000 });
        problemDialogVisible.value = false;
        await loadContest();
        await loadScoreboard();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '保存失败',
            detail: (error as Error)?.message ?? '更新比赛题目失败',
            life: 4000
        });
    } finally {
        problemSubmitting.value = false;
    }
}

function closeProblemDialog() {
    if (!problemSubmitting.value) {
        problemDialogVisible.value = false;
    }
}

async function addParticipants() {
    if (selectedParticipants.value.length === 0) {
        toast.add({ severity: 'warn', summary: '提示', detail: '请选择需加入的用户', life: 3000 });
        return;
    }
    const ids = selectedParticipants.value
        .map((item) => Number(item.id))
        .filter((value) => !Number.isNaN(value) && value > 0);
    if (ids.length === 0) {
        toast.add({ severity: 'warn', summary: '提示', detail: '未找到有效的用户ID', life: 3000 });
        return;
    }
    const payload: ContestParticipantsPayload = { userIds: ids };
    participantSubmitting.value = true;
    try {
        await addContestParticipants(contestId.value, payload);
        toast.add({ severity: 'success', summary: '添加成功', detail: '参赛者列表已更新', life: 3000 });
        selectedParticipants.value = [];
        await loadContest();
        await loadScoreboard();
        await loadRegistrations();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '添加参赛者失败',
            life: 4000
        });
    } finally {
        participantSubmitting.value = false;
    }
}

async function removeParticipant(userId: number) {
    const confirmed = window.confirm(`确定移除用户 ${userId} 吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await removeContestParticipant(contestId.value, userId);
        toast.add({ severity: 'success', summary: '已移除', detail: '参赛者已移除', life: 3000 });
        await loadContest();
        await loadScoreboard();
        await loadRegistrations();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '移除参赛者失败',
            life: 4000
        });
    }
}

function kindLabel(kind: string) {
    const list = options.value?.kinds ?? [];
    const match = list.find((item: ContestKindOption) => item.code === kind);
    return match?.displayName ?? kind;
}

function registrationModeLabel(mode?: string | null) {
    switch (mode) {
        case 'open':
            return '开放报名';
        case 'approval':
            return '审核报名';
        case 'invite_only':
            return '邀请制';
        default:
            return mode ?? '开放报名';
    }
}

function statusLabel(status?: string | null) {
    switch (status) {
        case 'RUNNING':
            return '进行中';
        case 'UPCOMING':
            return '未开始';
        case 'ENDED':
            return '已结束';
        default:
            return '-';
    }
}

function statusSeverity(status?: string | null) {
    switch (status) {
        case 'RUNNING':
            return 'success';
        case 'UPCOMING':
            return 'info';
        case 'ENDED':
            return 'warning';
        default:
            return 'secondary';
    }
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

function formatRecord(record: ContestScoreboardRecord) {
    if (record.pendingAttempts && record.pendingAttempts > 0) {
        return `${record.alias ?? record.problemId}: 封榜 ${record.pendingAttempts} 次`;
    }
    if (record.firstAcceptedAt) {
        return `${record.alias ?? record.problemId}: AC`;
    }
    if (record.bestScore && record.bestScore > 0) {
        return `${record.alias ?? record.problemId}: ${record.bestScore}`;
    }
    if (record.attempts && record.attempts > 0) {
        return `${record.alias ?? record.problemId}: ${record.attempts}次`;
    }
    return `${record.alias ?? record.problemId}: -`;
}

function recordSeverity(record: ContestScoreboardRecord) {
    if (record.pendingAttempts && record.pendingAttempts > 0) {
        return 'warning';
    }
    if (record.firstAcceptedAt) {
        return 'success';
    }
    if (record.bestScore && record.bestScore > 0) {
        return 'info';
    }
    if (record.attempts && record.attempts > 0) {
        return 'warning';
    }
    return 'secondary';
}

function verdictLabel(verdict: string) {
    const map: Record<string, string> = {
        PD: '评测中',
        AC: '通过',
        WA: '答案错误',
        TLE: '超时',
        MLE: '超内存',
        RE: '运行错误',
        CE: '编译错误',
        OLE: '输出超限',
        PE: '格式错误',
        IE: '评测异常'
    };
    return map[verdict] ?? verdict;
}

function visibilityLabel(flag?: boolean | null) {
    return flag ? '公开' : '私有';
}

function visibilitySeverity(flag?: boolean | null) {
    return flag ? 'success' : 'info';
}

async function completeProblemSearch(event: { query: string }) {
    const keyword = event.query?.trim();
    if (!keyword) {
        problemSuggestions.value = [];
        return;
    }
    problemSearchLoading.value = true;
    try {
        problemSuggestions.value = await searchContestProblems(keyword, 10);
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: (error as Error)?.message ?? '搜索题目失败',
            life: 3000
        });
    } finally {
        problemSearchLoading.value = false;
    }
}

function problemOptionLabel(option?: ProblemSummaryOption | null) {
    if (!option) {
        return '';
    }
    const parts = [option.slug ?? option.id, option.title].filter(Boolean);
    return parts.join(' - ');
}

function handleProblemSelect(option: ProblemSummaryOption, index: number) {
    const row = problemDraft.value[index];
    if (!row) {
        return;
    }
    row.option = option;
    row.problemId = option.id;
    if (!row.alias && option.slug) {
        row.alias = option.slug.toUpperCase();
    }
}

function clearProblemSelection(index: number) {
    const row = problemDraft.value[index];
    if (!row) {
        return;
    }
    row.option = null;
    row.problemId = 0;
}

async function completeParticipantSearch(event: { query: string }) {
    const keyword = event.query?.trim();
    if (!keyword) {
        participantSearchResults.value = [];
        return;
    }
    participantSearchLoading.value = true;
    try {
        participantSearchResults.value = await searchContestUsers(keyword, 10);
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: (error as Error)?.message ?? '搜索用户失败',
            life: 3000
        });
    } finally {
        participantSearchLoading.value = false;
    }
}

function participantOptionLabel(option?: UserSummaryOption | null) {
    if (!option) {
        return '';
    }
    const parts = [option.username, option.displayName].filter(Boolean);
    return parts.join(' / ');
}

function onRegistrationPageChange(event: { page: number; rows: number }) {
    registrationPage.value = event.page + 1;
    registrationSize.value = event.rows;
    loadRegistrations();
}

async function completeRegistrationInviteSearch(event: { query: string }) {
    const keyword = event.query?.trim();
    if (!keyword) {
        registrationInviteSuggestions.value = [];
        return;
    }
    registrationInviteLoading.value = true;
    try {
        registrationInviteSuggestions.value = await searchContestUsers(keyword, 10);
    } catch (error) {
        toast.add({
            severity: 'warn',
            summary: '提示',
            detail: (error as Error)?.message ?? '搜索用户失败',
            life: 3000
        });
    } finally {
        registrationInviteLoading.value = false;
    }
}

async function createRegistrationInvite() {
    if (!registrationInviteOption.value) {
        toast.add({ severity: 'warn', summary: '提示', detail: '请选择需要添加的用户', life: 3000 });
        return;
    }
    creatingRegistration.value = true;
    try {
        await createContestRegistration(contestId.value, {
            userId: registrationInviteOption.value.id,
            source: 'admin'
        });
        toast.add({ severity: 'success', summary: '已创建', detail: '报名记录已添加', life: 3000 });
        registrationInviteOption.value = null;
        registrationInviteSuggestions.value = [];
        await loadRegistrations();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '创建报名记录失败',
            life: 4000
        });
    } finally {
        creatingRegistration.value = false;
    }
}

function registrationStatusLabel(status: ContestRegistrationStatusCode) {
    switch (status) {
        case 'pending':
            return '待审核';
        case 'approved':
            return '已通过';
        case 'rejected':
            return '已驳回';
        case 'cancelled':
            return '已取消';
        default:
            return status;
    }
}

function registrationStatusSeverity(status: ContestRegistrationStatusCode) {
    switch (status) {
        case 'pending':
            return 'info';
        case 'approved':
            return 'success';
        case 'rejected':
            return 'danger';
        case 'cancelled':
        default:
            return 'secondary';
    }
}

function registrationSourceLabel(source?: string | null) {
    switch (source) {
        case 'self':
            return '用户报名';
        case 'invite':
            return '邀请';
        case 'admin':
            return '管理员添加';
        default:
            return source ?? '-';
    }
}

function onSubmissionPageChange(event: { page: number; rows: number }) {
    submissionPage.value = event.page + 1;
    submissionSize.value = event.rows;
    loadSubmissions();
}

const hasContestData = computed(() => detail.value !== null);

const freezeStatusTag = computed(() => {
    const board = scoreboard.value;
    if (!board || !board.freezeMinutes || board.freezeMinutes <= 0) {
        return null;
    }
    if (board.freezeActive) {
        return board.freezeHideScore
            ? `封榜中 · 隐藏最新结果 · 提前 ${board.freezeMinutes} 分钟`
            : `封榜中 · 仅标记提交 · 提前 ${board.freezeMinutes} 分钟`;
    }
    return `封榜配置 · 提前 ${board.freezeMinutes} 分钟`;
});

const penaltyTag = computed(() => {
    const board = scoreboard.value;
    const penalty = board?.penaltyPerWrong ?? detail.value?.penaltyPerWrong ?? 20;
    return `罚时 ${penalty} 分钟`;
});

const pendingSubmissionTag = computed(() => {
    const count = scoreboard.value?.pendingSubmissionCount ?? 0;
    if (!count) {
        return null;
    }
    return `封榜待揭晓 ${count} 次提交`;
});

</script>

<template>
    <div class="grid" v-if="hasContestData">
        <!-- 比赛概览卡片 -->
        <div class="col-12">
            <div class="card" :class="{ 'opacity-60 pointer-events-none': detailLoading }">
                <div class="flex justify-between flex-wrap gap-3 mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-3">
                            <i class="pi pi-trophy text-3xl text-primary"></i>
                            <h2 class="text-2xl font-bold m-0">{{ detail?.title }}</h2>
                        </div>
                        <div class="flex flex-wrap gap-3 text-sm">
                            <div class="flex items-center gap-2">
                                <i class="pi pi-flag text-color-secondary"></i>
                                <span class="text-color-secondary">赛制：</span>
                                <Tag :value="kindLabel(detail?.kind ?? '')" severity="info" />
                            </div>
                            <div class="flex items-center gap-2">
                                <i class="pi pi-circle-fill text-color-secondary" style="font-size: 0.5rem"></i>
                                <span class="text-color-secondary">状态：</span>
                                <Tag :value="statusLabel(detail?.status)" :severity="statusSeverity(detail?.status)" />
                            </div>
                            <div class="flex items-center gap-2">
                                <i class="pi pi-eye text-color-secondary"></i>
                                <span class="text-color-secondary">公开：</span>
                                <Tag :value="visibilityLabel(detail?.visible)"
                                    :severity="visibilitySeverity(detail?.visible)" />
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 items-start">
                        <Button label="编辑信息" icon="pi pi-pencil" severity="secondary" @click="openEditDialog" />
                        <Button label="刷新榜单" icon="pi pi-refresh" outlined @click="loadScoreboard" />
                    </div>
                </div>

                <Divider />

                <!-- 统计信息 -->
                <NDescriptions bordered :column="4" label-placement="top" size="medium">
                    <NDescriptionsItem label="题目数量">
                        <div class="flex items-center gap-2">
                            <i class="pi pi-file text-primary text-xl"></i>
                            <span class="text-2xl font-bold">{{ detail?.problemCount ?? 0 }}</span>
                        </div>
                    </NDescriptionsItem>
                    <NDescriptionsItem label="参赛人数">
                        <div class="flex items-center gap-2">
                            <i class="pi pi-users text-green-500 text-xl"></i>
                            <span class="text-2xl font-bold">{{ detail?.participantCount ?? 0 }}</span>
                        </div>
                    </NDescriptionsItem>
                    <NDescriptionsItem label="报名模式">
                        <div class="flex items-center gap-2">
                            <i class="pi pi-sign-in text-color-secondary"></i>
                            <Tag :value="registrationModeLabel(detail?.registrationMode)" severity="info" />
                        </div>
                    </NDescriptionsItem>
                    <NDescriptionsItem label="人数上限">
                        <div class="flex items-center gap-2">
                            <i class="pi pi-sort-amount-up text-color-secondary"></i>
                            <span class="text-2xl font-bold">
                                {{ detail?.maxParticipants != null ? detail?.maxParticipants : '不限' }}
                            </span>
                        </div>
                    </NDescriptionsItem>
                    <NDescriptionsItem label="开始时间">
                        <div class="font-medium">{{ formatDate(detail?.startTime) }}</div>
                    </NDescriptionsItem>
                    <NDescriptionsItem label="结束时间">
                        <div class="font-medium">{{ formatDate(detail?.endTime) }}</div>
                    </NDescriptionsItem>
                </NDescriptions>

                <div v-if="detail?.descriptionMd" class="mt-4">
                    <Divider />
                    <div
                        class="text-sm whitespace-pre-line text-color-secondary p-3 bg-surface-50 dark:bg-surface-900 border-round">
                        <i class="pi pi-info-circle mr-2"></i>{{ detail?.descriptionMd }}
                    </div>
                </div>
            </div>
        </div>

        <!-- 题目配置卡片 -->
        <div class="col-12 lg:col-6">
            <div class="card">
                <div class="flex justify-between mb-4 items-center">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-list text-xl text-primary"></i>
                        <h3 class="text-lg font-semibold m-0">题目配置</h3>
                    </div>
                    <Button label="配置题目" icon="pi pi-cog" size="small" @click="openProblemDialog" />
                </div>
                <Divider class="my-3" />
                <DataTable :value="detail?.problems ?? []" responsiveLayout="stack" stripedRows>
                    <template #empty>
                        <NEmpty description="暂无题目配置" class="py-6">
                            <template #icon>
                                <i class="pi pi-inbox text-4xl text-color-secondary"></i>
                            </template>
                            <template #extra>
                                <Button label="添加题目" icon="pi pi-plus" size="small" text @click="openProblemDialog" />
                            </template>
                        </NEmpty>
                    </template>
                    <Column header="#" style="width: 4rem">
                        <template #body="{ index }">
                            <Tag :value="`${index + 1}`" severity="secondary" rounded />
                        </template>
                    </Column>
                    <Column field="alias" header="别名">
                        <template #body="{ data }">
                            <span class="font-medium">{{ data.alias || '-' }}</span>
                        </template>
                    </Column>
                    <Column field="problemId" header="题目ID" />
                    <Column field="problemTitle" header="题目标题">
                        <template #body="{ data }">
                            <span class="text-color-secondary">{{ data.problemTitle || '-' }}</span>
                        </template>
                    </Column>
                    <Column field="points" header="分值">
                        <template #body="{ data }">
                            <Tag v-if="data.points" :value="`${data.points}分`" severity="success" />
                            <span v-else class="text-color-secondary">-</span>
                        </template>
                    </Column>
                    <Column field="submissionCount" header="提交数">
                        <template #body="{ data }">
                            <span class="text-color-secondary">{{ data.submissionCount ?? 0 }}</span>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- 参赛成员卡片 -->
        <div class="col-12 lg:col-6">
            <div class="card">
                <div class="flex justify-between mb-4 items-center flex-wrap gap-3">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-users text-xl text-primary"></i>
                        <h3 class="text-lg font-semibold m-0">参赛成员</h3>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <AutoComplete v-model="selectedParticipants" :suggestions="participantSearchResults"
                            optionLabel="username" dataKey="id" :completeMethod="completeParticipantSearch"
                            dropdown multiple :loading="participantSearchLoading" style="min-width: 20rem"
                            placeholder="搜索用户名或邮箱">
                            <template #option="{ option }">
                                <div class="flex flex-column">
                                    <span class="font-medium">{{ participantOptionLabel(option) }}</span>
                                    <small class="text-color-secondary">{{ option?.email ?? '无邮箱' }}</small>
                                </div>
                            </template>
                            <template #chip="{ value }">
                                <span>{{ participantOptionLabel(value) }}</span>
                            </template>
                        </AutoComplete>
                        <Button label="添加" icon="pi pi-user-plus" size="small" :loading="participantSubmitting"
                            @click="addParticipants" />
                    </div>
                </div>
                <Divider class="my-3" />
                <DataTable :value="detail?.participants ?? []" responsiveLayout="stack" stripedRows>
                    <template #empty>
                        <NEmpty description="暂无参赛者" class="py-6">
                            <template #icon>
                                <i class="pi pi-user-plus text-4xl text-color-secondary"></i>
                            </template>
                        </NEmpty>
                    </template>
                    <Column header="#" style="width: 4rem">
                        <template #body="{ index }">
                            <Tag :value="`${index + 1}`" severity="secondary" rounded />
                        </template>
                    </Column>
                    <Column field="userId" header="用户ID">
                        <template #body="{ data }">
                            <span class="font-medium">{{ data.userId }}</span>
                        </template>
                    </Column>
                    <Column field="username" header="用户名">
                        <template #body="{ data }">
                            <div class="flex items-center gap-2">
                                <i class="pi pi-user text-color-secondary"></i>
                                <span>{{ data.username ?? '-' }}</span>
                            </div>
                        </template>
                    </Column>
                    <Column field="registeredAt" header="报名时间">
                        <template #body="{ data }">
                            <span class="text-color-secondary text-sm">{{ formatDate(data.registeredAt) }}</span>
                        </template>
                    </Column>
                    <Column header="操作" style="width: 8rem">
                        <template #body="{ data }">
                            <Button icon="pi pi-times" text rounded severity="danger" size="small" v-tooltip.top="'移除'"
                                @click="removeParticipant(data.userId)" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- 报名审核卡片 -->
        <div class="col-12 lg:col-6">
            <div class="card">
                <div class="flex justify-between mb-4 items-center flex-wrap gap-3">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-user-edit text-xl text-primary"></i>
                        <h3 class="text-lg font-semibold m-0">报名审核</h3>
                        <Tag v-if="detail?.pendingRegistrationCount"
                            :value="`待审核 ${detail?.pendingRegistrationCount}`" severity="warning" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Dropdown v-model="registrationStatusFilter" :options="registrationStatusOptionsItems"
                            optionLabel="label" optionValue="value" placeholder="全部状态" size="small"
                            :showClear="true" />
                        <Button icon="pi pi-refresh" text rounded size="small" :loading="registrationsLoading"
                            @click="loadRegistrations" />
                    </div>
                </div>
                <div class="flex gap-2 flex-wrap mb-3">
                    <AutoComplete v-model="registrationInviteOption" :suggestions="registrationInviteSuggestions"
                        dropdown optionLabel="username" dataKey="id"
                        :completeMethod="completeRegistrationInviteSearch"
                        :loading="registrationInviteLoading" placeholder="搜索用户以创建报名"
                        style="min-width: 20rem">
                        <template #option="{ option }">
                            <div class="flex flex-column">
                                <span class="font-medium">{{ participantOptionLabel(option) }}</span>
                                <small class="text-color-secondary">{{ option?.email ?? '无邮箱' }}</small>
                            </div>
                        </template>
                    </AutoComplete>
                    <Button label="创建报名" icon="pi pi-user-plus" size="small"
                        :loading="creatingRegistration" :disabled="!registrationInviteOption"
                        @click="createRegistrationInvite" />
                </div>
                <div class="text-sm text-color-secondary mb-3">
                    报名窗口：
                    <span>
                        {{ detail?.registrationStartTime ? formatDate(detail?.registrationStartTime) : '立即开放' }}
                    </span>
                    <span> 至 </span>
                    <span>
                        {{ detail?.registrationEndTime ? formatDate(detail?.registrationEndTime) : '比赛结束前' }}
                    </span>
                </div>
                <Divider class="my-3" />
                <DataTable :value="registrations" :loading="registrationsLoading" dataKey="id"
                    :rows="registrationSize" :paginator="true" :lazy="true"
                    :totalRecords="registrationTotal" :rowsPerPageOptions="[10, 20, 50]"
                    @page="onRegistrationPageChange" responsiveLayout="stack" stripedRows>
                    <template #empty>
                        <NEmpty description="暂无报名记录" class="py-6">
                            <template #icon>
                                <i class="pi pi-address-book text-4xl text-color-secondary"></i>
                            </template>
                        </NEmpty>
                    </template>
                    <Column header="#" style="width: 4rem">
                        <template #body="{ index }">
                            <Tag :value="`${index + 1}`" severity="secondary" rounded />
                        </template>
                    </Column>
                    <Column field="username" header="用户">
                        <template #body="{ data }">
                            <div class="flex flex-column">
                                <span class="font-medium">{{ data.username ?? `用户 ${data.userId}` }}</span>
                                <small class="text-color-secondary">ID: {{ data.userId }}</small>
                            </div>
                        </template>
                    </Column>
                    <Column field="status" header="状态">
                        <template #body="{ data }">
                            <Tag :value="registrationStatusLabel(data.status)"
                                :severity="registrationStatusSeverity(data.status)" />
                        </template>
                    </Column>
                    <Column field="source" header="来源">
                        <template #body="{ data }">
                            <span class="text-color-secondary">{{ registrationSourceLabel(data.source) }}</span>
                        </template>
                    </Column>
                    <Column field="createdAt" header="报名时间">
                        <template #body="{ data }">
                            <span class="text-color-secondary text-sm">{{ formatDate(data.createdAt) }}</span>
                        </template>
                    </Column>
                    <Column field="reviewedAt" header="审核时间">
                        <template #body="{ data }">
                            <div class="flex flex-column">
                                <span class="text-color-secondary text-sm">{{ formatDate(data.reviewedAt) }}</span>
                                <small v-if="data.reviewerName" class="text-color-tertiary">{{
                                    data.reviewerName }}</small>
                            </div>
                        </template>
                    </Column>
                    <Column header="操作" style="width: 10rem">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button v-if="data.status === 'pending'" label="通过" icon="pi pi-check" size="small"
                                    severity="success" text @click="approveRegistration(data)" />
                                <Button v-if="data.status === 'pending'" label="驳回" icon="pi pi-times"
                                    size="small" severity="danger" text @click="rejectRegistration(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>

        <!-- 实时榜单卡片 -->
        <div class="col-12">
            <div class="card">
                <div class="flex justify-between mb-4 items-center">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-chart-bar text-xl text-primary"></i>
                        <h3 class="text-lg font-semibold m-0">实时榜单</h3>
                    </div>
                    <Button icon="pi pi-refresh" rounded text v-tooltip.top="'刷新榜单'" @click="loadScoreboard" />
                </div>
                <Divider class="my-3" />

                <div class="flex flex-wrap gap-2 mb-3">
                    <Tag :value="penaltyTag" severity="info" />
                    <Tag v-if="freezeStatusTag" :value="freezeStatusTag"
                        :severity="scoreboard?.freezeActive ? 'warning' : 'secondary'" />
                    <Tag v-if="pendingSubmissionTag" :value="pendingSubmissionTag" severity="danger" />
                </div>

                <template v-if="scoreboardLoading">
                    <div class="flex flex-col gap-3">
                        <NSkeleton height="60px" v-for="i in 5" :key="i" />
                    </div>
                </template>

                <template v-else>
                    <DataTable :value="scoreboard?.participants ?? []" responsiveLayout="stack" stripedRows>
                        <template #empty>
                            <NEmpty description="暂无榜单数据" class="py-6">
                                <template #icon>
                                    <i class="pi pi-chart-bar text-4xl text-color-secondary"></i>
                                </template>
                            </NEmpty>
                        </template>
                        <Column field="rank" header="名次" style="width: 6rem">
                            <template #body="{ data }">
                                <div class="flex items-center gap-2">
                                    <i v-if="data.rank === 1" class="pi pi-star-fill text-yellow-500"></i>
                                    <i v-else-if="data.rank === 2" class="pi pi-star-fill text-gray-400"></i>
                                    <i v-else-if="data.rank === 3" class="pi pi-star-fill text-orange-600"></i>
                                    <span class="font-bold">{{ data.rank }}</span>
                                </div>
                            </template>
                        </Column>
                        <Column header="选手">
                            <template #body="{ data }">
                                <div class="flex items-center gap-2">
                                    <i class="pi pi-user text-primary"></i>
                                    <div class="flex flex-column">
                                        <span class="font-medium">{{ data.username ?? data.userId }}</span>
                                        <small class="text-color-secondary">ID: {{ data.userId }}</small>
                                    </div>
                                </div>
                            </template>
                        </Column>
                        <Column field="solvedCount" header="通过数" style="width: 7rem">
                            <template #body="{ data }">
                                <Tag :value="`${data.solvedCount} 题`" severity="success" />
                            </template>
                        </Column>
                        <Column field="totalScore" header="得分" style="width: 7rem">
                            <template #body="{ data }">
                                <span class="font-bold text-primary">{{ data.totalScore }}</span>
                            </template>
                        </Column>
                        <Column field="pendingCount" header="封榜待揭" style="width: 8rem">
                            <template #body="{ data }">
                                <Tag v-if="data.pendingCount" :value="`${data.pendingCount}`" severity="warning" />
                                <span v-else class="text-color-secondary">-</span>
                            </template>
                        </Column>
                        <Column field="penalty" header="罚时" style="width: 7rem">
                            <template #body="{ data }">
                                <span class="text-color-secondary">{{ data.penalty ?? '-' }}</span>
                            </template>
                        </Column>
                        <Column field="lastAcceptedAt" header="最后通过" style="min-width: 10rem">
                            <template #body="{ data }">
                                <span class="text-sm text-color-secondary">
                                    {{ data.lastAcceptedAt ? formatDate(data.lastAcceptedAt) : '-' }}
                                </span>
                            </template>
                        </Column>
                        <Column header="题目表现" style="min-width: 20rem">
                            <template #body="{ data }">
                                <div class="flex flex-wrap gap-2">
                                    <Tag v-for="record in data.records" :key="record.problemId"
                                        :value="formatRecord(record)" :severity="recordSeverity(record)" />
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </template>
            </div>
        </div>

        <!-- 实时提交卡片 -->
        <div class="col-12">
            <div class="card">
                <div class="flex justify-between items-end mb-4 flex-wrap gap-3">
                    <div class="flex items-center gap-2">
                        <i class="pi pi-send text-xl text-primary"></i>
                        <h3 class="text-lg font-semibold m-0">实时提交</h3>
                    </div>
                    <div class="flex gap-2 flex-wrap items-end">
                        <Dropdown v-model="verdictFilter" :options="verdictOptions" placeholder="评测结果" :showClear="true"
                            size="small" />
                        <InputNumber v-model="userFilter" placeholder="用户ID" :min="1" inputId="submission-user"
                            size="small" style="width: 10rem" />
                        <InputNumber v-model="problemFilter" placeholder="题目ID" :min="1" inputId="submission-problem"
                            size="small" style="width: 10rem" />
                        <Button icon="pi pi-refresh" rounded text v-tooltip.top="'刷新'" @click="loadSubmissions" />
                    </div>
                </div>
                <Divider class="my-3" />
                <DataTable :value="submissions" :loading="submissionsLoading" dataKey="id" :rows="submissionSize"
                    :paginator="true" :lazy="true" :totalRecords="submissionTotal" :rowsPerPageOptions="[10, 20, 50]"
                    @page="onSubmissionPageChange" responsiveLayout="stack" stripedRows>
                    <template #empty>
                        <NEmpty description="暂无提交记录" class="py-6">
                            <template #icon>
                                <i class="pi pi-inbox text-4xl text-color-secondary"></i>
                            </template>
                        </NEmpty>
                    </template>
                    <Column field="id" header="提交ID" style="width: 7rem">
                        <template #body="{ data }">
                            <span class="font-mono text-sm">#{{ data.id }}</span>
                        </template>
                    </Column>
                    <Column field="userId" header="用户" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="flex flex-column gap-1">
                                <span class="font-medium">{{ data.username ?? `用户 ${data.userId}` }}</span>
                                <small class="text-color-secondary">ID: {{ data.userId }}</small>
                            </div>
                        </template>
                    </Column>
                    <Column field="problemId" header="题目" style="min-width: 8rem">
                        <template #body="{ data }">
                            <div class="flex items-center gap-2">
                                <Tag v-if="data.alias" :value="data.alias" severity="info" />
                                <span class="text-sm">#{{ data.problemId }}</span>
                            </div>
                        </template>
                    </Column>
                    <Column field="verdict" header="判题" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="verdictLabel(data.verdict)"
                                :severity="data.verdict === 'AC' ? 'success' : data.verdict === 'PD' ? 'info' : 'danger'" />
                        </template>
                    </Column>
                    <Column field="score" header="得分" style="width: 6rem">
                        <template #body="{ data }">
                            <span class="font-bold" :class="data.score > 0 ? 'text-green-500' : 'text-color-secondary'">
                                {{ data.score ?? '-' }}
                            </span>
                        </template>
                    </Column>
                    <Column field="timeMs" header="耗时" style="width: 7rem">
                        <template #body="{ data }">
                            <span class="text-sm text-color-secondary">{{ data.timeMs ?? '-' }}ms</span>
                        </template>
                    </Column>
                    <Column field="memoryKb" header="内存" style="width: 7rem">
                        <template #body="{ data }">
                            <span class="text-sm text-color-secondary">{{ data.memoryKb ?? '-' }}KB</span>
                        </template>
                    </Column>
                    <Column field="submittedAt" header="提交时间" style="min-width: 10rem">
                        <template #body="{ data }">
                            <span class="text-sm text-color-secondary">{{ formatDate(data.submittedAt) }}</span>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="editDialogVisible" header="编辑比赛信息" :modal="true" :style="{ width: '42rem' }"
        :closable="!editSubmitting" @hide="closeEditDialog">
        <div class="flex flex-col gap-4">
            <!-- 比赛标题 -->
            <div class="flex flex-col gap-2">
                <label for="edit-title">比赛标题</label>
                <InputText id="edit-title" v-model="editForm.title" placeholder="请输入比赛标题" />
            </div>

            <!-- 赛制类型与公开状态 -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex flex-col gap-2 w-full">
                    <label for="edit-kind">赛制类型</label>
                    <Dropdown id="edit-kind" v-model="editForm.kind" :options="options?.kinds ?? []"
                        optionLabel="displayName" optionValue="code" placeholder="选择赛制" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="edit-visible">公开状态</label>
                    <SelectButton id="edit-visible" v-model="editForm.visible" :options="[
                        { label: '公开', value: true },
                        { label: '私有', value: false }
                    ]" optionLabel="label" optionValue="value" />
                </div>
            </div>

            <!-- 开始时间与结束时间 -->
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex flex-col gap-2 w-full">
                    <label for="edit-start">开始时间</label>
                    <Calendar id="edit-start" v-model="editForm.startTime" showIcon showTime hourFormat="24"
                        placeholder="选择开始时间" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label for="edit-end">结束时间</label>
                    <Calendar id="edit-end" v-model="editForm.endTime" showIcon showTime hourFormat="24"
                        placeholder="选择结束时间" />
                </div>
            </div>

            <!-- 比赛简介 -->
            <div class="flex flex-col gap-2">
                <label for="edit-description">比赛简介 (可选)</label>
                <Textarea id="edit-description" v-model="editForm.descriptionMd" rows="4" autoResize
                    placeholder="请输入比赛简介..." />
            </div>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="取消" severity="secondary" :disabled="editSubmitting" @click="closeEditDialog" />
                <Button label="保存" icon="pi pi-check" :loading="editSubmitting" @click="submitEdit" />
            </div>
        </template>
    </Dialog>

    <Dialog v-model:visible="problemDialogVisible" header="配置比赛题目" :modal="true" :style="{ width: '56rem' }"
        :closable="!problemSubmitting" @hide="closeProblemDialog">
        <div class="flex flex-col gap-4">
            <!-- 说明和添加按钮 -->
            <div class="flex justify-between items-center">
                <div class="flex flex-col gap-1">
                    <span class="font-medium">题目配置列表</span>
                    <small class="text-color-secondary">设置题目顺序、别名与分值，题目ID需为现有题目</small>
                </div>
                <Button label="添加题目" icon="pi pi-plus" severity="success" size="small" @click="addProblemRow" />
            </div>

            <!-- 题目列表 -->
            <div class="flex flex-col gap-3">
                <div v-for="(item, index) in problemDraft" :key="index"
                    class="p-4 border-1 surface-border border-round">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-medium text-color-secondary">题目 #{{ index + 1 }}</span>
                        <Button icon="pi pi-trash" text rounded severity="danger" size="small"
                            @click="removeProblemRow(index)" />
                    </div>

                    <!-- 题目ID和别名 -->
                    <div class="flex flex-col md:flex-row gap-4 mb-3">
                        <div class="flex flex-col gap-2 w-full">
                            <label :for="`problem-search-${index}`">题目搜索</label>
                            <AutoComplete :id="`problem-search-${index}`" v-model="problemDraft[index].option"
                                :suggestions="problemSuggestions" optionLabel="title" dataKey="id" dropdown
                                :loading="problemSearchLoading" :completeMethod="completeProblemSearch"
                                placeholder="输入标题或别名关键词"
                                @item-select="({ value }) => handleProblemSelect(value, index)"
                                @clear="clearProblemSelection(index)">
                                <template #option="{ option }">
                                    <div class="flex flex-column">
                                        <span class="font-medium">{{ problemOptionLabel(option) }}</span>
                                        <small class="text-color-secondary">ID: {{ option.id }}</small>
                                    </div>
                                </template>
                                <template #chip="{ value }">
                                    <span>{{ problemOptionLabel(value) || `#${item.problemId || '-'}` }}</span>
                                </template>
                            </AutoComplete>
                            <small class="text-color-secondary">选择后可继续调整题目ID或别名</small>
                        </div>
                        <div class="flex flex-col gap-2 w-full">
                            <label :for="`problem-id-${index}`">题目ID <span class="text-red-500">*</span></label>
                            <InputNumber :id="`problem-id-${index}`" v-model="item.problemId" :useGrouping="false"
                                :min="1" placeholder="输入题目ID" />
                        </div>
                    </div>

                    <!-- 别名、分值、排序值 -->
                    <div class="flex flex-col md:flex-row gap-4">
                        <div class="flex flex-col gap-2 w-full">
                            <label :for="`problem-alias-${index}`">别名 (可选)</label>
                            <InputText :id="`problem-alias-${index}`" v-model="item.alias"
                                placeholder="例如：A, B, C 或自定义" />
                        </div>
                        <div class="flex flex-col gap-2 w-full">
                            <label :for="`problem-points-${index}`">分值</label>
                            <InputNumber :id="`problem-points-${index}`" v-model="item.points" :useGrouping="false"
                                :min="0" placeholder="题目分值" />
                            <small class="text-color-secondary">留空表示不计分</small>
                        </div>
                    </div>

                    <div class="flex flex-col md:flex-row gap-4">
                        <div class="flex flex-col gap-2 w-full">
                            <label :for="`problem-order-${index}`">排序值</label>
                            <InputNumber :id="`problem-order-${index}`" v-model="item.orderNo" :useGrouping="false"
                                placeholder="排序权重" />
                            <small class="text-color-secondary">数值越小越靠前</small>
                        </div>
                    </div>
                </div>

                <!-- 空状态 -->
                <div v-if="problemDraft.length === 0" class="text-center py-8 text-color-secondary">
                    <i class="pi pi-inbox text-4xl mb-3"></i>
                    <p>暂无题目，点击上方按钮添加</p>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="取消" severity="secondary" :disabled="problemSubmitting" @click="closeProblemDialog" />
                <Button label="保存配置" icon="pi pi-check" :loading="problemSubmitting" @click="submitProblems" />
            </div>
        </template>
    </Dialog>
</template>
