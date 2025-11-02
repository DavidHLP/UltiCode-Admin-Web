<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
    DashboardService,
    type RecentSubmission
} from '@/service/dashboard';

const submissions = ref<RecentSubmission[]>([]);
const loading = ref(true);

const verdictSeverity: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
    AC: 'success',
    WA: 'danger',
    TLE: 'warning',
    MLE: 'warning',
    RE: 'danger',
    CE: 'info',
    PD: 'info'
};

const verdictLabels: Record<string, string> = {
    AC: '通过',
    WA: '答案错误',
    TLE: '超时',
    MLE: '内存超限',
    RE: '运行错误',
    CE: '编译失败',
    PD: '判题中'
};

const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
};

const loadRecentSubmissions = async () => {
    loading.value = true;
    try {
        submissions.value = await DashboardService.getRecentSubmissions(6);
    } catch (error) {
        console.error('加载最近提交失败', error);
        submissions.value = [];
    } finally {
        loading.value = false;
    }
};

const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const resolveVerdictSeverity = (verdict: string) => verdictSeverity[verdict] ?? 'info';
const resolveVerdictLabel = (verdict: string) => verdictLabels[verdict] ?? verdict;
const resolveDifficulty = (difficulty: string | null) => (difficulty ? difficultyLabels[difficulty] ?? difficulty : '未设定');

onMounted(() => {
    void loadRecentSubmissions();
});
</script>

<template>
    <div class="card">
        <div class="font-semibold text-xl mb-4">最近提交</div>
        <DataTable
            :value="submissions"
            :rows="6"
            :loading="loading"
            :paginator="submissions.length > 6"
            responsiveLayout="scroll"
        >
            <Column header="题目" style="width: 40%">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <span class="text-surface-900 dark:text-surface-0 font-medium">{{ data.problemTitle }}</span>
                        <div class="flex items-center gap-2 text-sm text-muted-color mt-1">
                            <Tag severity="contrast" :value="resolveDifficulty(data.difficulty)" />
                            <span>{{ data.problemSlug }}</span>
                        </div>
                    </div>
                </template>
            </Column>
            <Column header="用户 / 语言" style="width: 25%">
                <template #body="{ data }">
                    <div class="flex flex-col">
                        <span class="text-surface-900 dark:text-surface-0">{{ data.username }}</span>
                        <span class="text-muted-color text-sm">{{ data.language }}</span>
                    </div>
                </template>
            </Column>
            <Column header="结果" style="width: 20%">
                <template #body="{ data }">
                    <Tag
                        :severity="resolveVerdictSeverity(data.verdict)"
                        :value="resolveVerdictLabel(data.verdict)"
                        rounded
                    />
                    <div class="text-muted-color text-sm mt-1">
                        得分：{{ data.score ?? '—' }}
                    </div>
                </template>
            </Column>
            <Column header="时间" style="width: 15%">
                <template #body="{ data }">
                    <span class="text-muted-color text-sm whitespace-nowrap">
                        {{ formatTime(data.submittedAt) }}
                    </span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>
