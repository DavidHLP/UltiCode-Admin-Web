<script setup lang="ts">
import {
    createLanguage,
    deleteLanguage,
    fetchLanguages,
    updateLanguage,
    type LanguageCreatePayload,
    type LanguageQuery,
    type LanguageUpdatePayload,
    type LanguageView
} from '@/api/problem/language.ts';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import type { DataTableFilterMetaData, DataTableOperatorFilterMetaData } from 'primevue/datatable';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

interface LanguageForm {
    code: string;
    displayName: string;
    runtimeImage: string;
    isActive: boolean;
}

type FilterValue = DataTableFilterMetaData | DataTableOperatorFilterMetaData;
type FiltersState = Record<string, FilterValue>;

const languages = ref<LanguageView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const filters = ref<FiltersState>(createEmptyFilters());
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const toast = useToast();

const form = ref<LanguageForm>({
    code: '',
    displayName: '',
    runtimeImage: '',
    isActive: true
});

const statusTagSeverity = computed(
    () => (isActive: boolean) => (isActive ? 'success' : 'danger')
);

const statusFilterOptions = [
    { label: '全部状态', value: null },
    { label: '启用', value: true },
    { label: '停用', value: false }
];

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
    loadLanguages();
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
        displayName: textFilter(),
        isActive: { value: null, matchMode: FilterMatchMode.EQUALS }
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

function resolveBooleanFilter(field: string): boolean | undefined {
    const raw = resolveRawFilterValue(field);
    if (raw === null || raw === undefined || raw === '') {
        return undefined;
    }
    if (typeof raw === 'string') {
        if (raw === 'true') {
            return true;
        }
        if (raw === 'false') {
            return false;
        }
    }
    return Boolean(raw);
}

function buildQueryFromFilters(): LanguageQuery {
    const query: LanguageQuery = {
        page: page.value,
        size: size.value
    };
    const keyword = resolveStringFilter('global');
    if (keyword) {
        query.keyword = keyword;
    }
    const code = resolveStringFilter('code');
    if (code) {
        query.code = code;
    }
    const displayName = resolveStringFilter('displayName');
    if (displayName) {
        query.displayName = displayName;
    }
    const isActive = resolveBooleanFilter('isActive');
    if (isActive !== undefined) {
        query.isActive = isActive;
    }
    return query;
}

function debouncedSearch() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        page.value = 1;
        loadLanguages();
    }, 300);
}

async function loadLanguages() {
    if (abortController) {
        abortController.abort();
    }
    const controller = new AbortController();
    abortController = controller;
    loading.value = true;
    try {
        const data = await fetchLanguages(buildQueryFromFilters(), controller.signal);
        languages.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载语言列表失败',
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
        await loadLanguages();
    } finally {
        skipFilterWatch = false;
    }
}

function openCreate() {
    editingId.value = null;
    form.value = {
        code: '',
        displayName: '',
        runtimeImage: '',
        isActive: true
    };
    dialogVisible.value = true;
}

function openEdit(language: LanguageView) {
    editingId.value = language.id;
    form.value = {
        code: language.code,
        displayName: language.displayName,
        runtimeImage: language.runtimeImage ?? '',
        isActive: language.isActive
    };
    dialogVisible.value = true;
}

function closeDialog() {
    dialogVisible.value = false;
}

async function submitForm() {
    const code = form.value.code.trim();
    if (!code) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入语言编码', life: 4000 });
        return;
    }
    const displayName = form.value.displayName.trim();
    if (!displayName) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入展示名称', life: 4000 });
        return;
    }
    const runtimeImageRaw = form.value.runtimeImage?.trim();
    const runtimeImageValue = runtimeImageRaw ? runtimeImageRaw : '';

    saving.value = true;
    try {
        if (editingId.value === null) {
            const payload: LanguageCreatePayload = {
                code,
                displayName,
                runtimeImage: runtimeImageValue || undefined,
                isActive: form.value.isActive
            };
            await createLanguage(payload);
            toast.add({ severity: 'success', summary: '创建成功', detail: '语言已创建', life: 3000 });
        } else {
            const payload: LanguageUpdatePayload = {
                code,
                displayName,
                runtimeImage: runtimeImageValue || null,
                isActive: form.value.isActive
            };
            await updateLanguage(editingId.value, payload);
            toast.add({ severity: 'success', summary: '更新成功', detail: '语言信息已更新', life: 3000 });
        }
        dialogVisible.value = false;
        await loadLanguages();
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '操作失败',
            detail: (error as Error)?.message ?? '保存语言失败',
            life: 4000
        });
    } finally {
        saving.value = false;
    }
}

async function removeLanguage(language: LanguageView) {
    const confirmed = window.confirm(`确定要删除语言「${language.displayName}」吗？`);
    if (!confirmed) {
        return;
    }
    try {
        await deleteLanguage(language.id);
        toast.add({ severity: 'success', summary: '删除成功', detail: '语言已删除', life: 3000 });
        await loadLanguages();
        if (!languages.value.length && total.value > 0 && page.value > 1) {
            page.value -= 1;
            await loadLanguages();
        }
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除语言失败',
            life: 4000
        });
    }
}

function onPageChange(event: { page: number; rows: number }) {
    page.value = event.page + 1;
    size.value = event.rows;
    loadLanguages();
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <DataTable
                    :value="languages"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    v-model:filters="filters"
                    filterDisplay="menu"
                    :globalFilterFields="['displayName', 'code']"
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
                                        placeholder="搜索语言编码或名称"
                                    />
                                </IconField>
                            </div>
                            <Button label="新建语言" icon="pi pi-plus" severity="success" @click="openCreate" />
                        </div>
                    </template>
                    <Column field="displayName" header="语言名称" style="min-width: 12rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入展示名称" class="w-full" />
                        </template>
                    </Column>
                    <Column field="code" header="语言编码" style="min-width: 10rem" :showFilterMatchModes="false">
                        <template #filter="{ filterModel }">
                            <InputText v-model="filterModel.value" type="text" placeholder="输入语言编码" class="w-full" />
                        </template>
                    </Column>
                    <Column field="runtimeImage" header="运行镜像" style="min-width: 14rem">
                        <template #body="{ data }">
                            <span v-if="data.runtimeImage">
                                <a :href="data.runtimeImage" target="_blank" rel="noopener noreferrer">
                                    {{ data.runtimeImage }}
                                </a>
                            </span>
                            <span v-else>-</span>
                        </template>
                    </Column>
                    <Column field="isActive" header="状态" style="min-width: 8rem" :showFilterMatchModes="false">
                        <template #body="{ data }">
                            <Tag :value="data.isActive ? '启用' : '停用'" :severity="statusTagSeverity(data.isActive)" />
                        </template>
                        <template #filter="{ filterModel }">
                            <Dropdown
                                v-model="filterModel.value"
                                :options="statusFilterOptions"
                                optionLabel="label"
                                optionValue="value"
                                class="w-full"
                                placeholder="全部状态"
                                :showClear="true"
                            />
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
                                        label: '删除语言',
                                        icon: 'pi pi-trash',
                                        command: () => removeLanguage(data)
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

    <Dialog v-model:visible="dialogVisible" modal :header="editingId === null ? '新建语言' : '编辑语言'" :style="{ width: '32rem' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" @hide="closeDialog">
        <form class="form-grid" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="lang-code">语言编码</label>
                <InputText id="lang-code" v-model="form.code" placeholder="如 cpp17" autofocus class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="lang-name">展示名称</label>
                <InputText id="lang-name" v-model="form.displayName" placeholder="如 C++17" class="w-full" />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="lang-image">运行镜像</label>
                <InputText id="lang-image" v-model="form.runtimeImage" placeholder="容器镜像地址，可留空" class="w-full" />
            </div>
            <div class="field flex-row items-center gap-3">
                <label class="font-medium text-sm mb-0 block">启用状态</label>
                <InputSwitch v-model="form.isActive" />
                <span>{{ form.isActive ? '启用' : '停用' }}</span>
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

.field.flex-row {
    flex-direction: row;
    align-items: center;
}

.form-grid {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}
</style>
