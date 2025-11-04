<script setup lang="ts">
import {
    createDifficulty,
    deleteDifficulty,
    fetchDifficulties,
    updateDifficulty,
    type DifficultyCreatePayload,
    type DifficultyQuery,
    type DifficultyUpdatePayload,
    type DifficultyView
} from '@/api/problem/difficulty.ts';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref, watch } from 'vue';

interface DifficultyForm {
    id: number | null;
    code: string;
    sortKey: number | null;
}

type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;

const difficulties = ref<DifficultyView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const toast = useToast();

const form = ref<DifficultyForm>({
    id: null,
    code: '',
    sortKey: 0
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
    loadDifficulties();
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
    const numberFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }]
    });

    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        id: numberFilter(),
        code: textFilter(),
        sortKey: numberFilter()
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

function resolveNumberFilter(field: string): number | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === null || raw === undefined || raw === '') {
        return undefined;
    }
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? undefined : parsed;
}

function buildQueryFromFilters(): DifficultyQuery {
    const query: DifficultyQuery = {
        page: page.value,
        size: size.value
    };
    const keyword = resolveStringFilter('global');
    if (keyword) {
        query.keyword = keyword;
    }
    const idFilter = resolveNumberFilter('id');
    if (idFilter !== undefined) {
        query.difficultyId = idFilter;
    }
    const codeFilter = resolveStringFilter('code');
    if (codeFilter) {
        query.code = codeFilter;
    }
    const sortFilter = resolveNumberFilter('sortKey');
    if (sortFilter !== undefined) {
        query.sortKey = sortFilter;
    }
    return query;
}

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadDifficulties();
    }, 300);
}

async function loadDifficulties() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;
    loading.value = true;
    try {
        const data = await fetchDifficulties(buildQueryFromFilters(), controller.signal);
        difficulties.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载难度列表失败',
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
        await loadDifficulties();
    } finally {
        skipFilterWatch = false;
    }
}

function openCreate() {
    editingId.value = null;
    form.value = {
        id: null,
        code: '',
        sortKey: 0
    };
    dialogVisible.value = true;
}

function openEdit(difficulty: DifficultyView) {
    editingId.value = difficulty.id;
    form.value = {
        id: difficulty.id,
        code: difficulty.code,
        sortKey: difficulty.sortKey
    };
    dialogVisible.value = true;
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    const code = form.value.code.trim();
    if (!code) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入难度编码', life: 4000 });
        return;
    }

    const sortKey = form.value.sortKey;
    if (sortKey === null || Number.isNaN(sortKey)) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入排序键', life: 4000 });
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            const id = form.value.id;
            if (id === null || Number.isNaN(id)) {
                toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入难度ID', life: 4000 });
                saving.value = false;
                return;
            }
            const payload: DifficultyCreatePayload = { id, code, sortKey };
            await createDifficulty(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '难度已创建', life: 3000 });
        } else {
            const payload: DifficultyUpdatePayload = { code, sortKey };
            await updateDifficulty(editingId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '难度信息已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadDifficulties();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存难度失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function removeDifficulty(difficulty: DifficultyView) {
    const confirmed = window.confirm(`确定要删除难度「${difficulty.code}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteDifficulty(difficulty.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '难度已删除', life: 3000 });
        await loadDifficulties();
        if (!difficulties.value.length && total.value > 0 && page.value > 1) {
            page.value -= 1;
            await loadDifficulties();
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除难度失败',
            life: 4000
        });
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadDifficulties();
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="difficulties"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['id', 'code']"
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
                                        placeholder="搜索难度ID或编码"
                                    />
                                </IconField>
                            </div>
                            <Button label="新建难度" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>
                    <Column field="id" header="难度ID" style="min-width: 8rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" :useGrouping="false" placeholder="输入难度ID" class="w-full" />
                        </template>
                    </Column>
                    <Column field="code" header="难度编码" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入难度编码" class="w-full" />
                        </template>
                    </Column>
                    <Column field="sortKey" header="排序键" style="min-width: 8rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputNumber v-model="filterModel.value" :useGrouping="false" placeholder="输入排序键" class="w-full" />
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
                                        label: '删除难度',
                                        icon: 'pi pi-trash',
                                        command: () => removeDifficulty(data)
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

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建难度' : '编辑难度'" :style="{ width: '28rem' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" @hide="closeDialog">
        <form class="form-grid" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="difficulty-id">难度ID</label>
                <InputNumber id="difficulty-id" v-model="form.id" :useGrouping="false" placeholder="请输入唯一ID" class="w-full" :disabled="editingId !== null" :min="1" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="difficulty-code">难度编码</label>
                <InputText id="difficulty-code" v-model="form.code" placeholder="如 easy" autofocus class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="difficulty-sort">排序键</label>
                <InputNumber id="difficulty-sort" v-model="form.sortKey" :useGrouping="false" placeholder="越小越靠前" class="w-full" :min="0" />
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
