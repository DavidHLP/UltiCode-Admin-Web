<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { listProblems, type Problem, pageDifficulties, pageCategories, deleteProblem, createProblem, updateProblem } from '@/api/problem/problem';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const toast = useToast();

const loading = ref(false);
const problems = ref<Problem[]>([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const rowsPerPageOptions = [10, 20, 50];

const difficulties = ref<{ label: string; value: number }[]>([]);
const categories = ref<{ label: string; value: number }[]>([]);

// filters
const keyword = ref('');
const filterDifficulty = ref<number | null>(null);
const filterCategory = ref<number | null>(null);

const showCreate = ref(false);
const creating = ref(false);
const form = ref<Problem>({ slug: '', problemType: 'ALGO', isVisible: true });

const filtered = computed(() => {
    let rows = [...problems.value];
    if (keyword.value) {
        const k = keyword.value.toLowerCase();
        rows = rows.filter((r) => (r.slug || '').toLowerCase().includes(k));
    }
    if (filterDifficulty.value != null) rows = rows.filter((r) => r.difficultyId === filterDifficulty.value);
    if (filterCategory.value != null) rows = rows.filter((r) => r.categoryId === filterCategory.value);
    return rows;
});

async function loadDict() {
    const [diff, cate] = await Promise.all([pageDifficulties({ current: 1, size: 100 }), pageCategories({ current: 1, size: 100 })]);
    difficulties.value = diff.records.map((d) => ({ label: d.code, value: d.id }));
    categories.value = cate.records.map((c) => ({ label: c.name, value: c.id }));
}

async function loadData() {
    loading.value = true;
    try {
        const res = await listProblems({ current: page.value, size: size.value });
        problems.value = res.records;
        total.value = res.total;
    } finally {
        loading.value = false;
    }
}

function onPage(e: any) {
    page.value = (e.page ?? 0) + 1;
    size.value = e.rows;
    loadData();
}

function refresh() {
    loadData();
}

function clearFilters() {
    keyword.value = '';
    filterDifficulty.value = null;
    filterCategory.value = null;
    page.value = 1;
    loadData();
}

function toDetail(row: Problem) {
    router.push({ path: `/admin/problems/${row.id}` });
}

async function doDelete(row: Problem) {
    if (!row.id) return;
    await deleteProblem(row.id);
    toast.add({ severity: 'success', summary: '删除成功', life: 1500 });
    loadData();
}

async function toggleVisible(row: Problem) {
    if (!row.id) return;
    await updateProblem(row.id, { ...row, isVisible: !row.isVisible });
    row.isVisible = !row.isVisible;
    toast.add({ severity: 'success', summary: row.isVisible ? '已可见' : '已隐藏', life: 1200 });
}

async function submitCreate() {
    if (!form.value.slug) {
        toast.add({ severity: 'warn', summary: '请输入唯一标识 slug', life: 1500 });
        return;
    }
    creating.value = true;
    try {
        await createProblem(form.value);
        showCreate.value = false;
        toast.add({ severity: 'success', summary: '创建成功', life: 1200 });
        loadData();
    } finally {
        creating.value = false;
    }
}

onMounted(() => {
    loadDict();
    loadData();
});
</script>

<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <div class="font-semibold text-xl mb-4">题目列表</div>

                <DataTable :value="filtered" dataKey="id" :loading="loading" :paginator="true" :rows="size" :rowsPerPageOptions="rowsPerPageOptions" :totalRecords="total" :first="(page - 1) * size" showGridlines @page="onPage">
                    <template #header>
                        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div class="flex flex-wrap items-center gap-3">
                                <Button type="button" icon="pi pi-filter-slash" label="重置" outlined @click="clearFilters" />
                                <IconField iconPosition="left">
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText v-model="keyword" placeholder="搜索 slug" class="w-14rem md:w-16rem" />
                                </IconField>
                                <Select v-model="filterDifficulty" :options="difficulties" optionLabel="label" optionValue="value" placeholder="难度" showClear class="w-12rem" />
                                <Select v-model="filterCategory" :options="categories" optionLabel="label" optionValue="value" placeholder="分类" showClear class="w-12rem" />
                                <Button type="button" icon="pi pi-search" label="查询" outlined @click="loadData" />
                            </div>
                            <div class="flex items-center gap-2">
                                <Button type="button" icon="pi pi-refresh" label="刷新" severity="secondary" outlined :loading="loading" @click="refresh" />
                                <Button type="button" icon="pi pi-plus" label="新建题目" severity="success" outlined @click="showCreate = true" />
                            </div>
                        </div>
                    </template>

                    <template #empty> 暂无题目数据 </template>
                    <template #loading> 正在加载题目，请稍候… </template>

                    <Column field="id" header="ID" style="width: 6rem" />
                    <Column field="slug" header="Slug" style="min-width: 14rem" />
                    <Column field="problemType" header="类型" style="width: 8rem" />
                    <Column field="difficultyId" header="难度" style="width: 10rem">
                        <template #body="{ data }">
                            {{ difficulties.find((d) => d.value === data.difficultyId)?.label || '-' }}
                        </template>
                    </Column>
                    <Column field="categoryId" header="分类" style="width: 10rem">
                        <template #body="{ data }">
                            {{ categories.find((c) => c.value === data.categoryId)?.label || '-' }}
                        </template>
                    </Column>
                    <Column header="可见" style="width: 10rem">
                        <template #body="{ data }">
                            <Button :label="data.isVisible ? '可见' : '隐藏'" size="small" :severity="data.isVisible ? 'success' : 'secondary'" @click="toggleVisible(data)" />
                        </template>
                    </Column>
                    <Column header="操作" style="width: 14rem" bodyClass="text-right">
                        <template #body="{ data }">
                            <div class="flex justify-end gap-2">
                                <Button icon="pi pi-pencil" label="详情" severity="secondary" text size="small" @click="toDetail(data)" />
                                <Button icon="pi pi-trash" label="删除" severity="danger" text size="small" @click="doDelete(data)" />
                            </div>
                        </template>
                    </Column>

                    <template #footer>
                        <div class="flex flex-wrap justify-between gap-2 text-sm text-color-secondary">
                            <span>共 {{ total }} 道题目</span>
                            <span>每页 {{ size }} 条</span>
                        </div>
                    </template>
                </DataTable>

                <Dialog v-model:visible="showCreate" :modal="true" header="新建题目" :style="{ width: '520px' }" :closable="!creating" :draggable="false" contentClass="p-0">
                    <div class="flex flex-col gap-4 p-6">
                        <div class="flex items-center gap-3">
                            <label class="w-24 text-right">Slug</label>
                            <InputText v-model="form.slug" class="flex-1" placeholder="唯一标识，如 two-sum" />
                        </div>
                        <div class="flex items-center gap-3">
                            <label class="w-24 text-right">类型</label>
                            <InputText v-model="form.problemType" class="flex-1" placeholder="ALGO/SQL/..." />
                        </div>
                        <div class="flex items-center gap-3">
                            <label class="w-24 text-right">难度</label>
                            <Dropdown v-model="form.difficultyId" class="flex-1" :options="difficulties" optionLabel="label" optionValue="value" placeholder="选择难度" />
                        </div>
                        <div class="flex items-center gap-3">
                            <label class="w-24 text-right">分类</label>
                            <Dropdown v-model="form.categoryId" class="flex-1" :options="categories" optionLabel="label" optionValue="value" placeholder="选择分类" />
                        </div>
                        <div class="flex items-center gap-3">
                            <label class="w-24 text-right">可见</label>
                            <InputSwitch v-model="form.isVisible" />
                        </div>
                        <div class="flex justify-end gap-2 pt-2">
                            <Button label="取消" icon="pi pi-times" severity="secondary" outlined :disabled="creating" @click="showCreate = false" />
                            <Button label="创建" icon="pi pi-check" :loading="creating" @click="submitCreate" />
                        </div>
                    </div>
                </Dialog>
            </div>
        </div>
    </div>
</template>

<style scoped>
.text-color-secondary {
    color: var(--text-color-secondary);
}
</style>
