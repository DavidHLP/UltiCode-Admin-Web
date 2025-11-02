<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
    DashboardService,
    type DashboardActivityGroup
} from '@/service/dashboard';

const groups = ref<DashboardActivityGroup[]>([]);
const loading = ref(true);
const menu = ref();

const accentConfigs: Record<string, { background: string; icon: string }> = {
    blue: { background: 'bg-blue-100 dark:bg-blue-400/10', icon: 'text-blue-500' },
    orange: { background: 'bg-orange-100 dark:bg-orange-400/10', icon: 'text-orange-500' },
    green: { background: 'bg-green-100 dark:bg-green-400/10', icon: 'text-green-500' },
    pink: { background: 'bg-pink-100 dark:bg-pink-400/10', icon: 'text-pink-500' },
    purple: { background: 'bg-purple-100 dark:bg-purple-400/10', icon: 'text-purple-500' },
    cyan: { background: 'bg-cyan-100 dark:bg-cyan-400/10', icon: 'text-cyan-500' },
    teal: { background: 'bg-teal-100 dark:bg-teal-400/10', icon: 'text-teal-500' }
};

const resolveAccent = (accent: string) => accentConfigs[accent] ?? accentConfigs.blue;

const loadActivities = async () => {
    loading.value = true;
    try {
        groups.value = await DashboardService.getActivities(9);
    } catch (error) {
        console.error('加载仪表盘动态失败', error);
        groups.value = [];
    } finally {
        loading.value = false;
    }
};

const formatTimestamp = (value: string) => {
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

const menuItems = [
    { label: '刷新', icon: 'pi pi-refresh', command: () => void loadActivities() }
];

onMounted(() => {
    void loadActivities();
});
</script>

<template>
    <div class="card">
        <div class="flex items-center justify-between mb-6">
            <div class="font-semibold text-xl">平台动态</div>
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
            <Skeleton width="40%" height="1rem" class="mb-4" />
            <ul class="p-0 m-0 list-none">
                <li v-for="index in 4" :key="`activity-skeleton-${index}`" class="flex items-center py-2">
                    <Skeleton shape="circle" size="3rem" class="mr-4" />
                    <div class="flex-1">
                        <Skeleton width="70%" height="0.85rem" class="mb-2" />
                        <Skeleton width="40%" height="0.75rem" />
                    </div>
                </li>
            </ul>
        </template>
        <template v-else>
            <template v-if="groups.length === 0">
                <div class="text-muted-color">暂无动态</div>
            </template>
            <template v-else>
                <div
                    v-for="group in groups"
                    :key="group.label"
                    class="mb-6 last:mb-0"
                >
                    <span class="block text-muted-color font-medium mb-4">{{ group.label }}</span>
                    <ul class="p-0 m-0 list-none">
                        <li
                            v-for="item in group.items"
                            :key="`${group.label}-${item.message}-${item.occurredAt}`"
                            class="flex items-start py-2 border-b border-surface last:border-b-0"
                        >
                            <div
                                class="w-12 h-12 flex items-center justify-center rounded-full mr-4 shrink-0"
                                :class="resolveAccent(item.accent).background"
                            >
                                <i :class="[item.icon, '!text-xl', resolveAccent(item.accent).icon]"></i>
                            </div>
                            <div class="flex-1">
                                <span class="text-surface-900 dark:text-surface-0 leading-normal block">
                                    {{ item.message }}
                                </span>
                                <span class="text-muted-color text-sm">
                                    {{ formatTimestamp(item.occurredAt) }}
                                </span>
                            </div>
                        </li>
                    </ul>
                </div>
            </template>
        </template>
    </div>
</template>
