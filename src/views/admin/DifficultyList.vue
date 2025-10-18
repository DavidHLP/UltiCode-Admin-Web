<script setup lang="ts">
import {
    createDifficulty,
    deleteDifficulty,
    fetchDifficulties,
    updateDifficulty,
    type DifficultyCreatePayload,
    type DifficultyUpdatePayload,
    type DifficultyView
} from '@/api/problem/difficulty.ts';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

interface DifficultyForm {
    id: number | null;
    code: string;
    sortKey: number | null;
}

const difficulties = ref<DifficultyView[]>([]);
const keyword = ref('');
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const toast = useToast();

const form = ref<DifficultyForm>({
    id: null,
    code: '',
    sortKey: 0
});

onMounted(() => {
    loadDifficulties();
});

async function loadDifficulties() {
    loading.value = true;
    try {
        const query = keyword.value.trim();
        const data = await fetchDifficulties(
                {
                    keyword: query ? query : undefined,
                    page: page.value,
                    size: size.value
                }
        );
        difficulties.value = data.items ?? [];
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
            detail: (error as Error)?.message ?? '加载难度列表失败',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
}

function onSearch() {
    page.value = 1;
    loadDifficulties();
}

function clearFilters() {
    keyword.value = '';
    page.value = 1;
    loadDifficulties();
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

    const sortKey = form.value.sortKey ?? null;
    if (sortKey === null || Number.isNaN(sortKey)) {
        toast.add({ severity: 'warn', summary: '校验失败', detail: '请输入排序键', life: 4000 });
        return;
    }

    saving.value = true;
    try {
        if (editingId.value === null) {
            const id = form.value.id ?? null;
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
                <div class="flex flex-wrap gap-3 items-end justify-between mb-4">
                    <div class="flex flex-wrap gap-3 items-end">
                        <InputText
                            v-model="keyword"
                            placeholder="搜索难度ID或编码"
                            @keyup.enter="onSearch"
                            style="min-width: 18rem"
                        />
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <Button label="筛选" icon="pi pi-filter" @click="onSearch" />
                        <Button label="重置" icon="pi pi-refresh" severity="secondary" @click="clearFilters" />
                        <Button label="新建难度" icon="pi pi-plus" severity="success" @click="openCreate" />
                    </div>
                </div>

                <DataTable
                    :value="difficulties"
                    dataKey="id"
                    :loading="loading"
                    :rows="size"
                    :paginator="true"
                    :lazy="true"
                    :totalRecords="total"
                    :rowsPerPageOptions="[10, 20, 50]"
                    :first="(page - 1) * size"
                    responsiveLayout="scroll"
                    @page="onPageChange"
                >
                    <Column field="id" header="难度ID" style="min-width: 8rem" />
                    <Column field="code" header="难度编码" style="min-width: 10rem" />
                    <Column field="sortKey" header="排序键" style="min-width: 8rem" />
                    <Column header="操作" style="min-width: 10rem">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button label="编辑" icon="pi pi-pencil" text @click="openEdit(data)" />
                                <Button
                                    label="删除"
                                    icon="pi pi-trash"
                                    text
                                    severity="danger"
                                    @click="removeDifficulty(data)"
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
        :header="editingId === null ? '新建难度' : '编辑难度'"
        :style="{ width: '28rem' }"
        :breakpoints="{ '960px': '90vw', '640px': '95vw' }"
        @hide="closeDialog"
    >
        <form class="form-grid" @submit.prevent="submitForm">
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="difficulty-id">难度ID</label>
                <InputNumber
                    id="difficulty-id"
                    v-model="form.id"
                    :useGrouping="false"
                    placeholder="请输入唯一ID"
                    class="w-full"
                    :disabled="editingId !== null"
                    :min="1"
                />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="difficulty-code">难度编码</label>
                <InputText
                    id="difficulty-code"
                    v-model="form.code"
                    placeholder="如 easy"
                    autofocus
                    class="w-full"
                />
            </div>
            <div class="field">
                <label class="font-medium text-sm mb-1 block" for="difficulty-sort">排序键</label>
                <InputNumber
                    id="difficulty-sort"
                    v-model="form.sortKey"
                    :useGrouping="false"
                    placeholder="越小越靠前"
                    class="w-full"
                    :min="0"
                />
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
