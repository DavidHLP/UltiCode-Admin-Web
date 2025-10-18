<script setup lang="ts">
import { Editor as MarkdownEditor } from '@bytemd/vue-next';
import { useProblemEditorContext } from './context';

const editor = useProblemEditorContext();
</script>

<template>
    <section class="editor-section statement-section">
        <div class="section-header with-actions">
            <div>
                <h3>题面内容</h3>
                <span class="section-subtitle">支持多语言 Markdown 描述</span>
            </div>
            <Button type="button" label="添加题面" icon="pi pi-plus" outlined
                @click="editor.addStatement(editor.form.statements.length - 1)" />
        </div>
        <div class="section-body statement-wrapper">
            <div class="statement-list">
                <div v-for="(statement, index) in editor.form.statements" :key="`statement-${index}`"
                    class="statement-item" :class="{ active: index === editor.activeStatementIndex.value }"
                    @click="editor.setActiveStatement(index)">
                    <div class="statement-item-header">
                        <div>
                            <div class="statement-item-title">
                                {{ editor.statementTitle(index) }}
                            </div>
                            <div class="statement-item-lang">
                                {{ editor.statementLanguageLabel(statement) }}
                            </div>
                        </div>
                        <div class="statement-item-actions">
                            <Button v-if="editor.form.statements.length > 1" icon="pi pi-trash" severity="danger" text
                                rounded @click.stop="editor.removeStatement(index)" />
                        </div>
                    </div>
                    <div class="statement-item-footer">
                        <Button icon="pi pi-copy" text rounded @click.stop="editor.duplicateStatement(index)" />
                        <Button icon="pi pi-arrow-up" text rounded :disabled="index === 0"
                            @click.stop="editor.moveStatement(index, -1)" />
                        <Button icon="pi pi-arrow-down" text rounded
                            :disabled="index === editor.form.statements.length - 1"
                            @click.stop="editor.moveStatement(index, 1)" />
                    </div>
                </div>
            </div>

            <div class="statement-editor-panel">
                <div v-if="editor.activeStatement.value" class="grid form-grid-inner">
                    <div class="col-12 md:col-4">
                        <label class="font-medium text-xs mb-1 block">语言代码</label>
                        <InputText v-model="editor.activeStatement.value!.langCode" placeholder="例如 zh-CN"
                            class="w-full" />
                    </div>
                    <div class="col-12 md:col-8">
                        <label class="font-medium text-xs mb-1 block">题面标题</label>
                        <InputText v-model="editor.activeStatement.value!.title" placeholder="题面标题" class="w-full" />
                    </div>
                    <div class="col-12">
                        <div class="markdown-block">
                            <label class="font-medium text-xs mb-1 block">
                                题面描述 (Markdown)
                            </label>
                            <MarkdownEditor :value="editor.activeStatement.value!.descriptionMd"
                                :plugins="editor.markdownPlugins" placeholder="支持 Markdown、公式与 Mermaid 图表"
                                @change="(val: string) => editor.updateStatementMarkdown('descriptionMd', val)" />
                        </div>
                    </div>
                    <div class="col-12">
                        <div class="markdown-block">
                            <label class="font-medium text-xs mb-1 block">
                                约束说明 (可选)
                            </label>
                            <MarkdownEditor :value="editor.activeStatement.value!.constraintsMd ?? ''"
                                :plugins="editor.markdownPlugins" placeholder="填写输入输出约束说明"
                                @change="(val: string) => editor.updateStatementMarkdown('constraintsMd', val)" />
                        </div>
                    </div>
                    <div class="col-12">
                        <div class="markdown-block">
                            <label class="font-medium text-xs mb-1 block">
                                示例说明 (可选)
                            </label>
                            <MarkdownEditor :value="editor.activeStatement.value!.examplesMd ?? ''"
                                :plugins="editor.markdownPlugins" placeholder="可包含多组样例输入输出"
                                @change="(val: string) => editor.updateStatementMarkdown('examplesMd', val)" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
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

.section-header.with-actions {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
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

.statement-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

@media (min-width: 992px) {
    .statement-wrapper {
        flex-direction: row;
    }
}

.statement-list {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
}

@media (min-width: 992px) {
    .statement-list {
        flex-direction: column;
        flex: 0 0 240px;
        max-height: 540px;
        overflow-y: auto;
        padding-right: 0.75rem;
    }
}

.statement-item {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    cursor: pointer;
    background: var(--surface-card);
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.statement-item:hover {
    border-color: var(--primary-color);
}

.statement-item.active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 1px rgba(79, 111, 255, 0.12);
}

.statement-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.statement-item-title {
    font-weight: 600;
    font-size: 0.95rem;
}

.statement-item-lang {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    margin-top: 0.25rem;
}

.statement-item-footer {
    display: flex;
    gap: 0.25rem;
}

.statement-editor-panel {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.markdown-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.markdown-block :deep(.bytemd) {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-card);
    min-height: 220px;
}

.markdown-block :deep(.bytemd-editor),
.markdown-block :deep(.bytemd-preview) {
    background: transparent;
}

.markdown-block :deep(.bytemd-editor) {
    min-height: 180px;
}

.markdown-block :deep(.bytemd-preview) {
    padding: 1rem;
}

.markdown-block :deep(.bytemd-toolbar) {
    background: rgba(0, 0, 0, 0.02);
}

.form-grid-inner {
    gap: 1rem;
}
</style>
