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
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

type LevelOption = { label: string; value: SensitiveWordUpsertPayload['level'] | '' };

type FormModel = {
    word: string;
    category: string;
    level: SensitiveWordUpsertPayload['level'];
    replacement: string;
    description: string;
    active: boolean;
};

const words = ref<SensitiveWordView[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const loading = ref(false);

const keyword = ref('');
const categoryFilter = ref('');
const levelFilter = ref('');
const activeFilter = ref<boolean | null>(null);

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

onMounted(() => {
    loadWords();
});

async function loadWords() {
    loading.value = true;
    try {
        const params: SensitiveWordQuery = {
            page: page.value,
            size: size.value,
            keyword: keyword.value.trim() || undefined,
            category: categoryFilter.value.trim() || undefined,
            level: levelFilter.value || undefined,
            active: activeFilter.value ?? undefined
        };
        const data = await fetchSensitiveWords(params);
        words.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载敏感词失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    page.value = 1;
    loadWords();
}

function resetFilters() {
    keyword.value = '';
    categoryFilter.value = '';
    levelFilter.value = '';
    activeFilter.value = null;
    page.value = 1;
    loadWords();
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
    const info = `${word.word} (${word.level})`;
    navigator.clipboard.writeText(word.word).then(() => {
        toast.add({
            severity: 'success',
            summary: '复制成功',
            detail: `已复制: ${info}`,
            life: 3000
        });
    }).catch(() => {
        toast.add({
            severity: 'error',
            summary: '复制失败',
            detail: '无法访问剪贴板',
            life: 3000
        });
    });
}
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputText v-model="keyword" placeholder="敏感词 / 描述" style="min-width: 16rem"
                            @keyup.enter="onSearch" />
                        <InputText v-model="categoryFilter" placeholder="分类" style="min-width: 12rem"
                            @keyup.enter="onSearch" />
                        <Dropdown v-model="levelFilter" :options="levelOptions" optionLabel="label" optionValue="value"
                            placeholder="处理等级" style="width: 12rem" />
                        <Dropdown v-model="activeFilter" :options="[
                            { label: '全部状态', value: null },
                            { label: '启用', value: true },
                            { label: '停用', value: false }
                        ]" optionLabel="label" optionValue="value" placeholder="状态" style="width: 10rem" />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="resetFilters" />
                        <Button label="新增敏感词" icon="pi pi-plus" severity="success" @click="openCreate" />
                    </div>
                </div>

                <DataTable :value="words" :loading="loading" :paginator="true" :lazy="true" :rows="size"
                    :totalRecords="total" :rowsPerPageOptions="[10, 20, 50]" :first="(page - 1) * size" dataKey="id"
                    responsiveLayout="scroll" @page="onPageChange">
                    <Column field="word" header="敏感词" sortable />
                    <Column field="category" header="分类" sortable />
                    <Column field="level" header="处理方式" sortable />
                    <Column field="replacement" header="替换词" />
                    <Column field="description" header="描述">
                        <template #body="slotProps">
                            <span class="block text-overflow-ellipsis whitespace-nowrap" style="max-width: 16rem">{{
                                slotProps.data.description ?? '-' }}</span>
                        </template>
                    </Column>
                    <Column field="active" header="状态">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.active ? '启用' : '停用'"
                                :severity="slotProps.data.active ? 'success' : 'danger'" />
                        </template>
                    </Column>
                    <Column field="updatedAt" header="更新时间" sortable />
                    <Column header="操作">
                        <template #body="slotProps">
                            <SplitButton label="编辑" icon="pi pi-pencil" size="small" severity="info" :model="[
                                {
                                    label: '删除',
                                    icon: 'pi pi-trash',
                                    command: () => removeWord(slotProps.data)
                                },
                                {
                                    label: slotProps.data.active ? '停用' : '启用',
                                    icon: slotProps.data.active ? 'pi pi-ban' : 'pi pi-check',
                                    command: () => toggleWordActive(slotProps.data)
                                },
                                {
                                    label: '复制词语',
                                    icon: 'pi pi-copy',
                                    command: () => copyWord(slotProps.data)
                                }
                            ]" @click="openEdit(slotProps.data)" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog v-model:visible="dialogVisible" modal :header="editingId ? '编辑敏感词' : '新增敏感词'" :style="{ width: '32rem' }">
        <div class="flex flex-column gap-3">
            <InputText v-model="form.word" placeholder="敏感词" />
            <InputText v-model="form.category" placeholder="分类 (可选)" />
            <Dropdown v-model="form.level" :options="levelOptions.slice(1)" optionLabel="label" optionValue="value"
                placeholder="处理等级" />
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
