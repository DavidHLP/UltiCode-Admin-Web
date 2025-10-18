<script setup lang="ts">
import {
    createCategory,
    deleteCategory,
    fetchCategories,
    updateCategory,
    type CategoryCreatePayload,
    type CategoryUpdatePayload,
    type CategoryView
} from '@/api/problem/category.ts';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

interface CategoryForm {
    code: string;
    name: string;
}

const categories = ref<CategoryView[]>([]);
const keyword = ref('');
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const toast = useToast();

const form = ref<CategoryForm>({
    code: '',
    name: ''
});

onMounted(() => {
    loadCategories();
});

async function loadCategories() {
    loading.value = true;
    try {
        const query = keyword.value.trim();
        categories.value = await fetchCategories(query ? { keyword: query } : undefined);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '加载失败',
            detail: (error as Error)?.message ?? '加载分类列表失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    loadCategories();
}

function clearFilters() {
    keyword.value = '';
    loadCategories();
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
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '删除失败',
            detail: (error as Error)?.message ?? '删除分类失败',
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
                        <InputText
                            v-model="keyword"
                            placeholder="搜索分类编码或名称"
                            @keyup.enter="onSearch"
                            style="min-width: 18rem"
                        />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                        <Button label="新建分类" icon="pi pi-plus" severity="success" @click="openCreate" />
                    </div>
                </div>

                <DataTable :value="categories" dataKey="id" :loading="loading" responsiveLayout="scroll">
                    <Column field="code" header="分类编码" style="min-width: 10rem" />
                    <Column field="name" header="分类名称" style="min-width: 10rem" />
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button label="编辑" icon="pi pi-pencil" text @click="openEdit(data)" />
                                <Button
                                    label="删除"
                                    icon="pi pi-trash"
                                    text
                                    severity="danger"
                                    @click="removeCategory(data)"
                                />
                            </div>
                        </template>
                    </Column>
                    <template #empty>
                        <div class="py-6 text-center text-color-secondary">暂无数据</div>
                    </template>
                </DataTable>
            </div>
        </div>
    </div>

    <Dialog
        v-model:visible="dialogVisible"
        modal
        :header="editingId === null ? '新建分类' : '编辑分类'"
        :style="{ width: '26rem' }"
        :breakpoints="{ '960px': '90vw', '640px': '95vw' }"
        @hide="closeDialog"
    >
        <form class="form-grid" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="code">分类编码</label>
                <InputText
                    id="code"
                    v-model="form.code"
                    placeholder="如 algorithms"
                    autofocus
                    class="w-full"
                />
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
