<script setup lang="ts">
import { useLayout } from '@/layout/composables/layout';
import { onMounted, ref, watch } from 'vue';
import { DashboardService, type DashboardTrendPoint } from '@/service/dashboard';

const { getPrimary, getSurface, isDarkTheme } = useLayout();

const chartData = ref();
const chartOptions = ref();
const trendPoints = ref<DashboardTrendPoint[]>([]);
const loading = ref(true);

const setChartData = (points: DashboardTrendPoint[]) => {
    const documentStyle = getComputedStyle(document.documentElement);
    return {
        labels: points.map((point) => point.label),
        datasets: [
            {
                type: 'bar',
                label: '通过',
                backgroundColor: documentStyle.getPropertyValue('--p-primary-400'),
                data: points.map((point) => point.acceptedCount),
                barThickness: 32
            },
            {
                type: 'bar',
                label: '错误',
                backgroundColor: documentStyle.getPropertyValue('--p-primary-300'),
                data: points.map((point) => point.wrongCount),
                barThickness: 32
            },
            {
                type: 'bar',
                label: '待判定',
                backgroundColor: documentStyle.getPropertyValue('--p-primary-200'),
                data: points.map((point) => point.pendingCount),
                borderRadius: {
                    topLeft: 8,
                    topRight: 8
                },
                borderSkipped: true,
                barThickness: 32
            }
        ]
    };
};

const setChartOptions = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const borderColor = documentStyle.getPropertyValue('--surface-border');
    const textMutedColor = documentStyle.getPropertyValue('--text-color-secondary');

    return {
        maintainAspectRatio: false,
        aspectRatio: 0.8,
        scales: {
            x: {
                stacked: true,
                ticks: {
                    color: textMutedColor
                },
                grid: {
                    color: 'transparent',
                    borderColor: 'transparent'
                }
            },
            y: {
                stacked: true,
                ticks: {
                    color: textMutedColor,
                    precision: 0
                },
                grid: {
                    color: borderColor,
                    borderColor: 'transparent',
                    drawTicks: false
                }
            }
        }
    };
};

const loadTrendData = async () => {
    loading.value = true;
    try {
        trendPoints.value = await DashboardService.getSubmissionTrends();
        chartData.value = setChartData(trendPoints.value);
    } catch (error) {
        console.error('加载提交流水失败', error);
        trendPoints.value = [];
        chartData.value = setChartData(trendPoints.value);
    } finally {
        chartOptions.value = setChartOptions();
        loading.value = false;
    }
};

watch([getPrimary, getSurface, isDarkTheme], () => {
    chartData.value = setChartData(trendPoints.value);
    chartOptions.value = setChartOptions();
});

onMounted(() => {
    void loadTrendData();
});
</script>

<template>
    <div class="card">
        <div class="font-semibold text-xl mb-4">提交流水</div>
        <Skeleton v-if="loading" width="100%" height="18rem" />
        <Chart
            v-else
            type="bar"
            :data="chartData"
            :options="chartOptions"
            class="h-80"
        />
    </div>
</template>
