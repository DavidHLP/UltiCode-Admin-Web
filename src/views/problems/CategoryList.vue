<script setup lang="ts">
import {
    createCategory,
    deleteCategory,
    fetchCategories,
    updateCategory,
    type CategoryCreatePayload,
    type CategoryQuery,
    type CategoryUpdatePayload,
    type CategoryView
} from '@/api/problem/category.ts';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref, watch } from 'vue';

interface CategoryForm {
    code: string;
    name: string;
}

type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;

const categories = ref<CategoryView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const toast = useToast();

const form = ref<CategoryForm>({
    code: '',
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
    loadCategories();
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
        code: textFilter(),
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

function buildQueryFromFilters(): CategoryQuery {
    const query: CategoryQuery = {
        page: page.value,
        size: size.value
    };
    const globalKeyword = resolveStringFilter('global');
    if (globalKeyword) {
        query.keyword = globalKeyword;
    }
    const codeFilter = resolveStringFilter('code');
    if (codeFilter) {
        query.code = codeFilter;
    }
    const nameFilter = resolveStringFilter('name');
    if (nameFilter) {
        query.name = nameFilter;
    }
    return query;
}

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadCategories();
    }, 300);
}

async function loadCategories() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;
    loading.value = true;
    try {
        const data = await fetchCategories(buildQueryFromFilters(), controller.signal);
        categories.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载分类列表失败',
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
        await loadCategories();
    } finally {
        skipFilterWatch = false;
    }
}

function openCreate() {
    editingId.value = null;
    form.value = {
        code: '',
        name: ''
    };
    dialogVisible.value = true;
}

function openEdit(category: CategoryView) {
    editingId.value = category.id;
    form.value = {
        code: category.code,
        name: category.name
    };
    dialogVisible.value = true;
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    const code = form.value.code.trim();
    if (!code) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入分类编码', life: 4000 });
        return;
    }
    const name = form.value.name.trim();
    if (!name) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入分类名称', life: 4000 });
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            const payload: CategoryCreatePayload = { code, name };
            await createCategory(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '分类已创建', life: 3000 });
        } else {
            const payload: CategoryUpdatePayload = { code, name };
            await updateCategory(editingId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '分类信息已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadCategories();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存分类失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function removeCategory(category: CategoryView) {
    const confirmed = window.confirm(`确定要删除分类「${category.name}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteCategory(category.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '分类已删除', life: 3000 });
        await loadCategories();
        if (!categories.value.length && total.value > 0 && page.value > 1) {
            page.value -= 1;
            await loadCategories();
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除分类失败',
            life: 4000
        });
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadCategories();
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="categories"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['code', 'name']"
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
                                        placeholder="搜索分类编码或名称"
                                    />
                                </IconField>
                            </div>
                            <Button label="新建分类" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>
                    <Column field="code" header="分类编码" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入分类编码" class="w-full" />
                        </template>
                    </Column>
                    <Column field="name" header="分类名称" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入分类名称" class="w-full" />
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
                                        label: '删除分类',
                                        icon: 'pi pi-trash',
                                        command: () => removeCategory(data)
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

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建分类' : '编辑分类'" :style="{ width: '26rem' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" @hide="closeDialog">
        <form class="form-grid" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="code">分类编码</label>
                <InputText id="code" v-model="form.code" placeholder="如 algorithms" autofocus class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="name">分类名称</label>
                <InputText id="name" v-model="form.name" placeholder="如 算法" class="w-full" />
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
