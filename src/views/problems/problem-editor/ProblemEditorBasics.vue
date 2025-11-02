<script setup lang="ts">
import { useProblemEditorContext } from './context.ts';

const editor = useProblemEditorContext();
</script>

<template>
    <div class="grid editor-main">
        <div class="col-12 xl:col-4 editor-sidebar">
            <section class="editor-section">
                <div class="section-header">
                    <h3>基本信息</h3>
                    <span class="section-subtitle">题目标识与分类配置</span>
                </div>
                <div class="section-body">
                    <div class="field">
                        <label class="font-medium text-sm">题目别名 (slug)</label>
                        <InputText v-model="editor.form.slug" placeholder="two-sum" class="w-full" />
                    </div>
                    <div class="field">
                        <label class="font-medium text-sm">题目类型</label>
                        <Dropdown v-model="editor.form.problemType" :options="editor.problemTypeOptions.value"
                            optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div class="field">
                        <label class="font-medium text-sm">难度</label>
                        <Dropdown v-model="editor.form.difficultyId" :options="editor.difficultyOptions.value"
                            optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                    <div class="field">
                        <label class="font-medium text-sm">分类</label>
                        <Dropdown v-model="editor.form.categoryId" :options="editor.categoryOptions.value"
                            optionLabel="label" optionValue="value" :showClear="true" placeholder="请选择分类"
                            class="w-full" />
                    </div>
                    <div class="field">
                        <label class="font-medium text-sm">标签</label>
                        <MultiSelect v-model="editor.form.tagIds" :options="editor.tagSelectOptions.value"
                            optionLabel="label" optionValue="value" display="chip" placeholder="选择标签" class="w-full" />
                    </div>
                </div>
            </section>
        </div>

        <div class="col-12 xl:col-8 editor-content">
            <section class="editor-section">
                <div class="section-header">
                    <h3>判题限制</h3>
                    <span class="section-subtitle">运行环境与可见性</span>
                </div>
                <div class="section-body">
                    <div class="grid small-gap">
                        <div class="col-12">
                            <label class="font-medium text-sm">创建者用户 ID (可选)</label>
                            <InputNumber v-model="editor.form.creatorId" placeholder="例如 10001" class="w-full"
                                :useGrouping="false" :allowEmpty="true" />
                        </div>
                        <div class="col-12 md:col-6">
                            <label class="font-medium text-sm">时间限制 (ms)</label>
                            <InputNumber v-model="editor.form.timeLimitMs" :useGrouping="false" :allowEmpty="true"
                                placeholder="如 1000" class="w-full" />
                        </div>
                        <div class="col-12 md:col-6">
                            <label class="font-medium text-sm">内存限制 (KB)</label>
                            <InputNumber v-model="editor.form.memoryLimitKb" :useGrouping="false" :allowEmpty="true"
                                placeholder="如 262144" class="w-full" />
                        </div>
                        <div class="col-12">
                            <label class="font-medium text-sm">参考解答入口 (可选)</label>
                            <InputText v-model="editor.form.solutionEntry" placeholder="如 solutions/solution.cpp"
                                class="w-full" />
                        </div>
                        <div class="col-12">
                            <label class="font-medium text-sm mb-1">公开状态</label>
                            <div class="flex items-center gap-2">
                                <InputSwitch v-model="editor.form.isPublic" />
                                <span>{{ editor.form.isPublic ? '公开' : '私有' }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.editor-main {
    gap: 1.5rem;
}

.editor-section {
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    padding: 1.25rem;
    background: var(--surface-ground);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.section-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.section-subtitle {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.section-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.small-gap {
    gap: 1rem;
}

.editor-sidebar,
.editor-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}
</style>
