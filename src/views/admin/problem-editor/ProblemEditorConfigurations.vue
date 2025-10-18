<script setup lang="ts">
import MonacoEditor from 'monaco-editor-vue3';
import { useProblemEditorContext } from './context';

const editor = useProblemEditorContext();
</script>

<template>
    <div class="config-layout">
        <main class="editor-card language-card" aria-labelledby="language-config-heading">
            <header class="card-header">
                <div>
                    <h3 id="language-config-heading">编程语言配置</h3>
                    <span class="card-subtitle">维护入口函数与代码模板</span>
                </div>
                <Button type="button" label="添加语言配置" icon="pi pi-plus" outlined
                    @click="editor.addLanguageConfig(editor.form.languageConfigs.length - 1)" />
            </header>
            <div class="card-body">
                <div v-if="!editor.form.languageConfigs.length" class="empty-hint text-sm text-color-secondary">
                    当前没有语言配置，可根据需要添加不同语言的入口函数与默认代码。
                </div>
                <div v-else class="language-list">
                    <article v-for="(config, index) in editor.form.languageConfigs" :key="`language-${index}`"
                        class="language-panel">
                        <header class="language-panel__header">
                            <div class="language-panel__title">
                                {{ editor.getLanguageDisplayName(config.languageId) }}
                            </div>
                            <div class="language-panel__actions">
                                <Button icon="pi pi-copy" text rounded @click="editor.duplicateLanguageConfig(index)" />
                                <Button icon="pi pi-arrow-up" text rounded :disabled="index === 0"
                                    @click="editor.moveLanguageConfig(index, -1)" />
                                <Button icon="pi pi-arrow-down" text rounded
                                    :disabled="index === editor.form.languageConfigs.length - 1"
                                    @click="editor.moveLanguageConfig(index, 1)" />
                                <Button icon="pi pi-times" text rounded severity="danger"
                                    @click="editor.removeLanguageConfig(index)" />
                            </div>
                        </header>
                        <div class="grid form-grid-inner">
                            <div class="col-12 md:col-6">
                                <label class="field-label">语言</label>
                                <Dropdown v-model="config.languageId" :options="editor.languageSelectOptions.value"
                                    optionLabel="label" optionValue="value" placeholder="选择语言" class="w-full" />
                            </div>
                            <div class="col-12 md:col-6">
                                <label class="field-label">入口函数名 (可选)</label>
                                <InputText v-model="config.functionName" placeholder="如 main 或 solution"
                                    class="w-full" />
                            </div>
                            <div class="col-12">
                                <div class="monaco-block">
                                    <label class="field-label">初始代码模板 (可选)</label>
                                    <MonacoEditor v-model:value="config.starterCode"
                                        :language="editor.editorLanguageForConfig(config)" theme="vs-light"
                                        height="240px" :options="editor.codeEditorOptions" />
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </main>

        <aside class="editor-card metadata-card" aria-labelledby="metadata-heading">
            <header class="card-header">
                <div>
                    <h3 id="metadata-heading">元数据</h3>
                    <span class="card-subtitle">存储额外业务字段 (JSON 对象)</span>
                </div>
                <Button v-if="editor.form.metaText" type="button" label="格式化" icon="pi pi-brush" text
                    @click="editor.formatMetaJson" />
            </header>
            <div class="card-body">
                <div class="monaco-block">
                    <MonacoEditor v-model:value="editor.form.metaText" language="json" theme="vs-light" height="260px"
                        :options="editor.jsonEditorOptions" />
                    <small class="text-color-secondary text-xs">
                        元数据会原样存入数据库并随题目详情返回，可用于记录来源、测试配置等信息。
                    </small>
                </div>
            </div>
        </aside>
    </div>
</template>

<style scoped>
.config-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

@media (min-width: 992px) {
    .config-layout {
        display: grid;
        grid-template-columns: minmax(0, 4fr) minmax(0, 1fr);
        gap: 1.5rem;
        align-items: flex-start;
    }
}

.editor-card {
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    padding: 1.25rem;
    background: var(--surface-ground);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.card-subtitle {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-color-secondary);
}

.card-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.language-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.language-panel {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1rem;
    background: var(--surface-card);
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.language-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.language-panel__title {
    font-weight: 600;
}

.language-panel__actions {
    display: flex;
    gap: 0.25rem;
}

.field-label {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.monaco-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-grid-inner {
    gap: 1rem;
}

.empty-hint {
    border-radius: 8px;
    padding: 1rem;
    background: var(--surface-ground);
}

@media (min-width: 992px) {
    .metadata-card {
        position: sticky;
        top: 1.5rem;
    }
}
</style>
