<script setup lang="ts">
import {
    deleteBookmark,
    fetchBookmarks,
    type BookmarkDeletePayload,
    type BookmarkQuery,
    type BookmarkView
} from '@/api/interaction/bookmarks';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

type FilterOption = { label: string; value: string };

const bookmarks = ref<BookmarkView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const userIdFilter = ref<number | null>(null);
const entityTypeFilter = ref('');
const entityIdFilter = ref<number | null>(null);
const visibilityFilter = ref('');
const sourceFilter = ref('');

const toast = useToast();

const entityTypeOptions: FilterOption[] = [
    { label: '全部类型', value: '' },
    { label: '题目', value: 'problem' },
    { label: '比赛', value: 'contest' },
    { label: '评论', value: 'comment' },
    { label: '讨论', value: 'discussion' }
];

const visibilityOptions: FilterOption[] = [
    { label: '全部可见性', value: '' },
    { label: '公开', value: 'public' },
    { label: '私密', value: 'private' },
    { label: '团队', value: 'team' }
];

const sourceOptions: FilterOption[] = [
    { label: '全部来源', value: '' },
    { label: '用户', value: 'user' },
    { label: '系统', value: 'system' },
    { label: '迁移', value: 'migration' }
];

onMounted(() => {
    loadBookmarks();
});

async function loadBookmarks() {
    loading.value = true;
    try {
        const params: BookmarkQuery = {
            page: page.value,
            size: size.value,
            userId: userIdFilter.value ?? undefined,
            entityType: entityTypeFilter.value || undefined,
            entityId: entityIdFilter.value ?? undefined,
            visibility: visibilityFilter.value || undefined,
            source: sourceFilter.value || undefined
        };
        const data = await fetchBookmarks(params);
        bookmarks.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (typeof data.page === 'number') {
            page.value = Math.max(1, Number(data.page));
        }
        if (typeof data.size === 'number' && Number(data.size) > 0) {
            size.value = Number(data.size);
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载收藏列表失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    page.value = 1;
    loadBookmarks();
}

function resetFilters() {
    userIdFilter.value = null;
    entityTypeFilter.value = '';
    entityIdFilter.value = null;
    visibilityFilter.value = '';
    sourceFilter.value = '';
    page.value = 1;
    loadBookmarks();
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadBookmarks();
}

async function removeBookmark(row: BookmarkView) {
    const payload: BookmarkDeletePayload = {
        userId: row.userId,
        entityType: row.entityType,
        entityId: row.entityId
    };
    try {
        await deleteBookmark(payload);
        toast.add({ severity: 'success', summary: '删除成功', detail: '收藏已删除', life: 3000 });
        await loadBookmarks();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除收藏失败',
            life: 4000
        });
    }
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputNumber v-model="userIdFilter" placeholder="用户ID" :min="1" inputId="bookmark-user" />
                        <Dropdown v-model="entityTypeFilter" :options="entityTypeOptions" optionLabel="label" optionValue="value" placeholder="实体类型" style="width: 10rem" />
                        <InputNumber v-model="entityIdFilter" placeholder="实体ID" :min="1" inputId="bookmark-entity" />
                        <Dropdown v-model="visibilityFilter" :options="visibilityOptions" optionLabel="label" optionValue="value" placeholder="可见性" style="width: 10rem" />
                        <Dropdown v-model="sourceFilter" :options="sourceOptions" optionLabel="label" optionValue="value" placeholder="来源" style="width: 10rem" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="resetFilters" />
                    </div>
                </div>

                <DataTable
                    :value="bookmarks"
                    :loading="loading"
                    :paginator="true"
                    :lazy="true"
                    :rows="size"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :first="(page - 1) * size"
                    dataKey="entityId"
                    responsiveLayout="scroll"
                    @page="onPageChange"
                >
                    <Column field="userId" header="用户ID" sortable />
                    <Column field="entityType" header="实体类型" sortable />
                    <Column field="entityId" header="实体ID" sortable />
                    <Column field="visibility" header="可见性" sortable />
                    <Column field="note" header="备注">
                        <template #body="slotProps">
                            <span class="block text-overflow-ellipsis whitespace-nowrap" style="max-width: 16rem">{{ slotProps.data.note ?? '-' }}</span>
                        </template>
                    </Column>
                    <Column field="tags" header="标签">
                        <template #body="slotProps">
                            <div class="flex gap-1 flex-wrap">
                                <Tag v-for="tag in slotProps.data.tags" :key="tag" severity="info" :value="tag" />
                                <span v-if="!slotProps.data.tags?.length">-</span>
                            </div>
                        </template>
                    </Column>
                    <Column field="source" header="来源" sortable />
                    <Column field="createdAt" header="创建时间" sortable />
                    <Column header="操作">
                        <template #body="slotProps">
                            <Button label="删除" icon="pi pi-trash" severity="danger" size="small" @click="removeBookmark(slotProps.data)" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
</template>
