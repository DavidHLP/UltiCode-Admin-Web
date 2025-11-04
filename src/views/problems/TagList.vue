<script setup lang="ts">
import {
    createTag,
    deleteTag,
    fetchTags,
    updateTag,
    type TagCreatePayload,
    type TagQuery,
    type TagUpdatePayload,
    type TagView
} from '@/api/problem/tag.ts';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref, watch } from 'vue';

interface TagForm {
    slug: string;
    name: string;
}

type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;

const tags = ref<TagView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const toast = useToast();

const form = ref<TagForm>({
    slug: '',
    name: ''
});

let abortController: AbortController | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let skipFilterWatch = false;

watch(
    filters,
    () => {
        if (skipFilterWatch) {
            return;
        }
        debouncedSearch();
    },
    { deep: true }
);

onMounted(() => {
    loadTags();
});

onUnmounted(() => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    if (abortController) {
        abortController.abort();
    }
});

function createEmptyFilters(): FiltersState {
    const textFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }]
    });
    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        slug: textFilter(),
        name: textFilter()
    };
}

function isOperatorFilterMeta(
    meta: FilterValue | undefined
): meta is DataTableOperatorFilterMetaData {
    return !!meta && typeof meta === 'object' && 'constraints' in meta;
}

function resolveRawFilterValue(field: string): unknown {
    const meta = filters.value[field];
    if (!meta) {
        return undefined;
    }
    if (isOperatorFilterMeta(meta)) {
        const [constraint] = meta.constraints ?? [];
        return constraint?.value;
    }
    return meta.value;
}

function resolveStringFilter(field: string): string | undefined {
    const raw = resolveRawFilterValue(field);
    if (typeof raw !== 'string') {
        return undefined;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function buildQueryFromFilters(): TagQuery {
    const query: TagQuery = {
        page: page.value,
        size: size.value
    };
    const keyword = resolveStringFilter('global');
    if (keyword) {
        query.keyword = keyword;
    }
    const slug = resolveStringFilter('slug');
    if (slug) {
        query.slug = slug;
    }
    const name = resolveStringFilter('name');
    if (name) {
        query.name = name;
    }
    return query;
}

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadTags();
    }, 300);
}

async function loadTags() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;
    loading.value = true;
    try {
        const data = await fetchTags(buildQueryFromFilters(), controller.signal);
        tags.value = data.items ?? [];
        total.value = data.total ?? 0;
        if (data.page !== undefined && Number(data.page) !== page.value) {
            page.value = Number(data.page);
        }
        if (data.size !== undefined && Number(data.size) !== size.value) {
            size.value = Number(data.size);
        }
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
            return;
        }
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载标签列表失败',
            life: 4000
        });
    } finally {
        if (abortController === controller) {
            loading.value = false;
            abortController = null;
        }
    }
}

async function clearFilters() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    skipFilterWatch = true;
    filters.value = createEmptyFilters();
    page.value = 1;
    try {
        await loadTags();
    } finally {
        skipFilterWatch = false;
    }
}

function openCreate() {
    editingId.value = null;
    form.value = {
        slug: '',
        name: ''
    };
    dialogVisible.value = true;
}

function openEdit(tag: TagView) {
    editingId.value = tag.id;
    form.value = {
        slug: tag.slug,
        name: tag.name
    };
    dialogVisible.value = true;
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    const slug = form.value.slug.trim();
    if (!slug) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入标签别名', life: 4000 });
        return;
    }
    const name = form.value.name.trim();
    if (!name) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入标签名称', life: 4000 });
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            const payload: TagCreatePayload = { slug, name };
            await createTag(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '标签已创建', life: 3000 });
        } else {
            const payload: TagUpdatePayload = { slug, name };
            await updateTag(editingId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '标签信息已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadTags();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存标签失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function removeTag(tag: TagView) {
    const confirmed = window.confirm(`确定要删除标签「${tag.name}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteTag(tag.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '标签已删除', life: 3000 });
        await loadTags();
        if (!tags.value.length && total.value > 0 && page.value > 1) {
            page.value -= 1;
            await loadTags();
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除标签失败',
            life: 4000
        });
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadTags();
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
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="tags"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['slug', 'name']"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
                    @page="onPageChange"
                    responsiveLayout="scroll"
                    showGridlines
                >
                    <template #header>
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <Button type="button" label="重置" icon="pi pi-filter-slash" outlined @click="clearFilters" />
                                <IconField>
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText
                                        v-model="(filters['global'] as DataTableFilterMetaData).value"
                                        placeholder="搜索标签别名或名称"
                                    />
                                </IconField>
                            </div>
                            <Button label="新建标签" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>
                    <Column field="slug" header="标签别名" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入标签别名" class="w-full" />
                        </template>
                    </Column>
                    <Column field="name" header="标签名称" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入标签名称" class="w-full" />
                        </template>
                    </Column>
                    <Column field="createdAt" header="创建时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.createdAt) }}
                        </template>
                    </Column>
                    <Column field="updatedAt" header="更新时间" style="min-width: 12rem">
                        <template #body="{ data }">
                            {{ formatDate(data.updatedAt) }}
                        </template>
                    </Column>
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="编辑"
                                icon="pi pi-pencil"
                                size="small"
                                :model="[
                                    {
                                        label: '删除标签',
                                        icon: 'pi pi-trash',
                                        command: () => removeTag(data)
                                    }
                                ]"
                                @click="openEdit(data)"
                            />
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建标签' : '编辑标签'" :style="{ width: '26rem' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" @hide="closeDialog">
        <form class="form-grid" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="slug">标签别名</label>
                <InputText id="slug" v-model="form.slug" placeholder="如 dynamic-programming" autofocus class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="name">标签名称</label>
                <InputText id="name" v-model="form.name" placeholder="如 动态规划" class="w-full" />
            </div>
            <div class="flex justify-end gap-2 mt-3">
                <Button type="button" label="取消" severity="secondary" @click="closeDialog" />
                <Button type="submit" label="保存" icon="pi pi-check" :loading="saving" />
            </div>
        </form>
    </Dialog>
</template>

<style scoped>
.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-grid {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}
</style>
