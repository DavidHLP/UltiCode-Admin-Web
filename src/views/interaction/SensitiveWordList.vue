<script setup lang="ts">
import {
    createSensitiveWord,
    deleteSensitiveWord,
    fetchSensitiveWords,
    updateSensitiveWord,
    type SensitiveWordQuery,
    type SensitiveWordUpsertPayload,
    type SensitiveWordView
} from '@/api/interaction/sensitive-words';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type LevelOption = { label: string; value: SensitiveWordUpsertPayload['level'] | '' };
type FormModel = {
    word: string;
    category: string;
    level: SensitiveWordUpsertPayload['level'];
    replacement: string;
    description: string;
    active: boolean;
};
type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;

const words = ref<SensitiveWordView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const filters = ref<FiltersState>(createEmptyFilters());

const dialogVisible = ref(false);
const editingId = ref<number | null>(null);
const saving = ref(false);

const form = ref<FormModel>({
    word: '',
    category: '',
    level: 'review',
    replacement: '',
    description: '',
    active: true
});

const toast = useToast();

const levelOptions: LevelOption[] = [
    { label: '全部等级', value: '' },
    { label: '拦截 (block)', value: 'block' },
    { label: '审核 (review)', value: 'review' },
    { label: '替换 (replace)', value: 'replace' }
];

const paginationFirst = computed(() => (page.value - 1) * size.value);

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

onMounted(async () => {
    await loadWords();
});

onBeforeUnmount(() => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
});

function createEmptyFilters(): FiltersState {
    const textFilter = (): DataTableOperatorFilterMetaData => ({
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }]
    });
    const exactFilter = (): DataTableFilterMetaData => ({
        value: null,
        matchMode: FilterMatchMode.EQUALS
    });

    return {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        keyword: textFilter(),
        category: textFilter(),
        level: exactFilter(),
        active: exactFilter()
    };
}

function isOperatorFilterMeta(meta: FilterValue | undefined): meta is DataTableOperatorFilterMetaData {
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

function resolveBooleanFilter(field: string): boolean | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === true || raw === 'true') {
        return true;
    }
    if (raw === false || raw === 'false') {
        return false;
    }
    return undefined;
}

function buildQueryFromFilters(): SensitiveWordQuery {
    const query: SensitiveWordQuery = {
        page: page.value,
        size: size.value
    };

    const keywordFilter = resolveStringFilter('keyword');
    const globalFilter = resolveStringFilter('global');
    if (keywordFilter) {
        query.keyword = keywordFilter;
    } else if (globalFilter) {
        query.keyword = globalFilter;
    }

    const category = resolveStringFilter('category');
    if (category) {
        query.category = category;
    }
    const level = resolveStringFilter('level');
    if (level) {
        query.level = level;
    }
    const active = resolveBooleanFilter('active');
    if (active !== undefined) {
        query.active = active;
    }

    return query;
}

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadWords();
    }, 300);
}

async function loadWords() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;

    loading.value = true;
    try {
        const params = buildQueryFromFilters();
        const data = await fetchSensitiveWords(params, controller.signal);
        words.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载敏感词失败',
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
        await loadWords();
    } finally {
        skipFilterWatch = false;
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadWords();
}

function openCreate() {
    editingId.value = null;
    form.value = {
        word: '',
        category: '',
        level: 'review',
        replacement: '',
        description: '',
        active: true
    };
    dialogVisible.value = true;
}

function openEdit(word: SensitiveWordView) {
    editingId.value = word.id;
    form.value = {
        word: word.word ?? '',
        category: word.category ?? '',
        level: (word.level as FormModel['level']) ?? 'review',
        replacement: word.replacement ?? '',
        description: word.description ?? '',
        active: word.active ?? true
    };
    dialogVisible.value = true;
}

async function submitForm() {
    const payload: SensitiveWordUpsertPayload = {
        word: form.value.word.trim(),
        category: form.value.category.trim() || undefined,
        level: form.value.level,
        replacement: form.value.replacement.trim() || undefined,
        description: form.value.description.trim() || undefined,
        active: form.value.active
    };
    if (!payload.word) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入敏感词', life: 4000 });
        return;
    }
    if (!payload.level) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请选择处理等级', life: 4000 });
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            await createSensitiveWord(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '敏感词已新增', life: 3000 });
        } else {
            await updateSensitiveWord(editingId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '敏感词已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadWords();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '保存失败',
            detail: (error as Error)?.message ?? '保存敏感词失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function removeWord(word: SensitiveWordView) {
    const confirmed = window.confirm(`确定删除敏感词「${word.word}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteSensitiveWord(word.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '敏感词已删除', life: 3000 });
        await loadWords();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除敏感词失败',
            life: 4000
        });
    }
}

async function toggleWordActive(word: SensitiveWordView) {
    const newStatus = !word.active;
    const payload: SensitiveWordUpsertPayload = {
        word: word.word,
        category: word.category ?? undefined,
        level: word.level as SensitiveWordUpsertPayload['level'],
        replacement: word.replacement ?? undefined,
        description: word.description ?? undefined,
        active: newStatus
    };
    try {
        await updateSensitiveWord(word.id, payload);
        toast.add({
            severity: 'success',
            summary: '状态更新',
            detail: `敏感词已${newStatus ? '启用' : '停用'}`,
            life: 3000
        });
        await loadWords();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '更新失败',
            detail: (error as Error)?.message ?? '更新状态失败',
            life: 4000
        });
    }
}

function copyWord(word: SensitiveWordView) {
    navigator.clipboard
        .writeText(word.word)
        .then(() => {
            toast.add({
                severity: 'success',
                summary: '复制成功',
                detail: `已复制: ${word.word}`,
                life: 3000
            });
        })
        .catch(() => {
            toast.add({
                severity: 'error',
                summary: '复制失败',
                detail: '无法访问剪贴板',
                life: 3000
            });
        });
}

function getActiveSeverity(active: boolean) {
    return active ? 'success' : 'danger';
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="words"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['word', 'category', 'description']"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :first="paginationFirst"
                    :currentPageReportTemplate="`第 ${page} 页，共 ${Math.ceil(total / size) || 1} 页`"
                    @page="onPageChange"
                    responsiveLayout="scroll"
                    showGridlines
                >
                    <template #header>
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <Button type="button" label="重置筛选" icon="pi pi-filter-slash" outlined @click="clearFilters" />
                                <IconField>
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText
                                        v-model="(filters['global'] as DataTableFilterMetaData).value"
                                        placeholder="搜索敏感词或描述"
                                    />
                                </IconField>
                            </div>
                            <Button label="新增敏感词" icon="pi pi-plus" @click="openCreate" />
                        </div>
                    </template>

                    <Column field="word" header="敏感词" filterField="keyword" :showFilterMatchModes="false" style="min-width: 12rem">
                        <template #body="{ data }">
                            <span class="font-medium">{{ data.word }}</span>
                        </template>
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="模糊搜索敏感词" class="w-full" />
                        </template>
                    </Column>
                    <Column field="category" header="分类" filterField="category" :showFilterMatchModes="false" style="min-width: 10rem">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" placeholder="分类" class="w-full" />
                        </template>
                    </Column>
                    <Column field="level" header="处理方式" filterField="level" :showFilterMatchModes="false" style="min-width: 10rem">
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="levelOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="全部等级"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="replacement" header="替换词" style="min-width: 10rem">
                        <template #body="{ data }">
                            {{ data.replacement ?? '-' }}
                        </template>
                    </Column>
                    <Column field="description" header="描述" style="min-width: 16rem">
                        <template #body="{ data }">
                            <span class="block text-overflow-ellipsis whitespace-nowrap" style="max-width: 16rem">
                                {{ data.description ?? '-' }}
                            </span>
                        </template>
                    </Column>
                    <Column field="active" header="状态" filterField="active" :showFilterMatchModes="false" style="min-width: 8rem">
                        <template #body="{ data }">
                            <Tag :value="data.active ? '启用' : '停用'" :severity="getActiveSeverity(data.active)" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="[
                                    { label: '全部', value: null },
                                    { label: '启用', value: true },
                                    { label: '停用', value: false }
                                ]"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="状态"
                                class="w-full"
                            />
                        </template>
                    </Column>
                    <Column field="updatedAt" header="更新时间" sortable style="min-width: 12rem" />
                    <Column header="操作" style="min-width: 12rem">
                        <template #body="{ data }">
                            <SplitButton
                                label="编辑"
                                icon="pi pi-pencil"
                                size="small"
                                :model="[
                                    {
                                        label: data.active ? '停用' : '启用',
                                        icon: data.active ? 'pi pi-ban' : 'pi pi-check',
                                        command: () => toggleWordActive(data)
                                    },
                                    {
                                        label: '删除',
                                        icon: 'pi pi-trash',
                                        command: () => removeWord(data)
                                    },
                                    {
                                        label: '复制词条',
                                        icon: 'pi pi-copy',
                                        command: () => copyWord(data)
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

    <Dialog v-model:visible="dialogVisible" modal :header="editingId ? '编辑敏感词' : '新增敏感词'" :style="{ width: '32rem' }">
        <div class="flex flex-column gap-3">
            <InputText v-model="form.word" placeholder="敏感词" />
            <InputText v-model="form.category" placeholder="分类 (可选)" />
            <Dropdown
                v-model="form.level"
                :options="levelOptions.slice(1)"
                optionLabel="label"
                optionValue="value"
                placeholder="处理等级"
            />
            <InputText v-model="form.replacement" placeholder="替换词 (替换模式下可选)" />
            <Textarea v-model="form.description" rows="4" placeholder="描述" autoResize />
            <div class="flex items-center gap-2">
                <InputSwitch v-model="form.active" inputId="active-switch" />
                <label for="active-switch">启用</label>
            </div>
            <div class="flex justify-end gap-2 mt-3">
                <Button label="取消" severity="secondary" @click="dialogVisible = false" />
                <Button label="保存" icon="pi pi-save" :loading="saving" @click="submitForm" />
            </div>
        </div>
    </Dialog>
</template>
