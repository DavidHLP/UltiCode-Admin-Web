<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { DashboardService, type TrendingProblem } from '@/service/dashboard';

const problems = ref<TrendingProblem[]>([]);
const loading = ref(true);

const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
};

const accentConfigs: Record<string, { progress: string; text: string }> = {
    orange: { progress: 'bg-orange-500', text: 'text-orange-500' },
    cyan: { progress: 'bg-cyan-500', text: 'text-cyan-500' },
    purple: { progress: 'bg-purple-500', text: 'text-purple-500' },
    blue: { progress: 'bg-blue-500', text: 'text-blue-500' },
    teal: { progress: 'bg-teal-500', text: 'text-teal-500' },
    green: { progress: 'bg-green-500', text: 'text-green-500' },
    pink: { progress: 'bg-pink-500', text: 'text-pink-500' }
};

const resolveAccent = (accent: string) => accentConfigs[accent] ?? accentConfigs.blue;

const loadTrendingProblems = async () => {
    loading.value = true;
    try {
        problems.value = await DashboardService.getTrendingProblems(6);
    } catch (error) {
        console.error('加载题目热度榜失败', error);
        problems.value = [];
    } finally {
        loading.value = false;
    }
};

const resolveDifficulty = (difficulty: string | null) => (difficulty ? difficultyLabels[difficulty] ?? difficulty : '未设定');

const acceptanceRate = (problem: TrendingProblem) => {
    if (problem.acceptanceRate === null || Number.isNaN(problem.acceptanceRate)) {
        return '—';
    }
    return `${problem.acceptanceRate.toFixed(1)}%`;
};

const solvedRatio = (problem: TrendingProblem) => {
    if (problem.submissionCount <= 0) {
        return 0;
    }
    return Math.min(
        100,
        Math.round((problem.solvedCount / problem.submissionCount) * 100)
    );
};

onMounted(() => {
    void loadTrendingProblems();
});

const menu = ref();

const menuItems = [
    { label: '刷新数据', icon: 'pi pi-refresh', command: () => void loadTrendingProblems() }
];
</script>

<template>
    <div class="card">
        <div class="flex justify-between items-center mb-6">
            <div class="font-semibold text-xl">题目热度榜</div>
            <div>
                <Button
                    icon="pi pi-ellipsis-v"
                    class="p-button-text p-button-plain p-button-rounded"
                    @click="menu?.toggle($event)"
                ></Button>
                <Menu ref="menu" popup :model="menuItems" class="!min-w-40"></Menu>
            </div>
        </div>
        <template v-if="loading">
            <ul class="list-none p-0 m-0">
                <li v-for="index in 4" :key="`trending-skeleton-${index}`" class="mb-6">
                    <Skeleton width="50%" height="1.25rem" class="mb-2" />
                    <Skeleton width="60%" height="0.75rem" />
                </li>
            </ul>
        </template>
        <template v-else>
            <ul class="list-none p-0 m-0">
                <li
                    v-for="problem in problems"
                    :key="problem.id"
                    class="flex flex-col md:flex-row md:items-center md:justify-between mb-6"
                >
                    <div>
                        <span class="text-surface-900 dark:text-surface-0 font-medium mr-2 mb-1 md:mb-0">
                            {{ problem.title }}
                        </span>
                        <div class="flex items-center gap-2 mt-1 text-muted-color">
                            <Tag severity="contrast" :value="resolveDifficulty(problem.difficulty)" />
                            <span>提交 {{ problem.submissionCount }}</span>
                        </div>
                    </div>
                    <div class="mt-2 md:mt-0 flex items-center md:min-w-52">
                        <div
                            class="bg-surface-300 dark:bg-surface-500 rounded-border overflow-hidden w-40 lg:w-32"
                            style="height: 8px"
                        >
                            <div
                                class="h-full transition-all duration-300"
                                :class="resolveAccent(problem.accent).progress"
                                :style="{ width: `${solvedRatio(problem)}%` }"
                            ></div>
                        </div>
                        <span class="ml-4 font-medium" :class="resolveAccent(problem.accent).text">
                            通过 {{ problem.solvedCount }}
                        </span>
                        <span class="text-muted-color ml-4 text-sm">
                            通过率 {{ acceptanceRate(problem) }}
                        </span>
                    </div>
                </li>
            </ul>
        </template>
    </div>
</template>
