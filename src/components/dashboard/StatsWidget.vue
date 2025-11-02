<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { DashboardService, type DashboardSummaryCard } from '@/service/dashboard';

const cards = ref<DashboardSummaryCard[]>([]);
const loading = ref(true);
const skeletonCount = 4;

const accentConfigs: Record<string, { background: string; icon: string }> = {
    blue: {
        background: 'bg-blue-100 dark:bg-blue-400/10',
        icon: 'text-blue-500'
    },
    orange: {
        background: 'bg-orange-100 dark:bg-orange-400/10',
        icon: 'text-orange-500'
    },
    cyan: {
        background: 'bg-cyan-100 dark:bg-cyan-400/10',
        icon: 'text-cyan-500'
    },
    purple: {
        background: 'bg-purple-100 dark:bg-purple-400/10',
        icon: 'text-purple-500'
    }
};

const formatNumber = (value: number) =>
    new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);

const resolvedCards = computed(() => cards.value);

const resolveAccent = (accent: string) => accentConfigs[accent] ?? accentConfigs.blue;

const loadSummary = async () => {
    loading.value = true;
    try {
        const response = await DashboardService.getSummary();
        cards.value = response.cards ?? [];
    } catch (error) {
        console.error('加载仪表盘概览失败', error);
        cards.value = [];
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    void loadSummary();
});
</script>

<template>
    <template v-if="loading">
        <div v-for="index in skeletonCount" :key="`stats-skeleton-${index}`" class="col-span-12 lg:col-span-6 xl:col-span-3">
            <div class="card mb-0">
                <Skeleton width="6rem" height="1rem" class="mb-4" />
                <Skeleton width="4rem" height="1.5rem" class="mb-6" />
                <Skeleton width="5rem" height="0.75rem" />
            </div>
        </div>
    </template>
    <template v-else>
        <div
            v-for="card in resolvedCards"
            :key="card.key"
            class="col-span-12 lg:col-span-6 xl:col-span-3"
        >
            <div class="card mb-0">
                <div class="flex justify-between mb-4">
                    <div>
                        <span class="block text-muted-color font-medium mb-4">{{ card.title }}</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                            {{ formatNumber(card.value) }}
                        </div>
                    </div>
                    <div
                        class="flex items-center justify-center rounded-border"
                        style="width: 2.5rem; height: 2.5rem"
                        :class="resolveAccent(card.accent).background"
                    >
                        <i :class="[card.icon, resolveAccent(card.accent).icon, '!text-xl']"></i>
                    </div>
                </div>
                <span class="text-primary font-medium mr-2">{{ card.highlightText }}</span>
                <span class="text-muted-color">{{ card.helperText }}</span>
            </div>
        </div>
    </template>
</template>
