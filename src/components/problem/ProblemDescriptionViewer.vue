<script setup lang="ts">
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';
import { Viewer } from '@bytemd/vue-next';
import { computed } from 'vue';

import 'bytemd/dist/index.css';
import 'highlight.js/styles/github.css';

interface Props {
    content?: string | null;
}

const props = defineProps<Props>();

const plugins = [gfm(), highlight()];

const source = computed(() => props.content?.trim() ?? '');
const hasContent = computed(() => source.value.length > 0);
</script>

<template>
    <div class="problem-description-viewer">
        <Viewer v-if="hasContent" :value="source" :plugins="plugins" />
        <p v-else class="empty-placeholder">暂无题目描述</p>
    </div>
</template>

<style scoped>
.problem-description-viewer :deep(.bytemd-body) {
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--text-color);
}

.problem-description-viewer :deep(h2) {
    font-size: 1.2rem;
    margin-top: 1.75rem;
}

.problem-description-viewer :deep(h3) {
    font-size: 1.05rem;
    margin-top: 1.5rem;
}

.problem-description-viewer :deep(pre) {
    background: var(--surface-section);
    border-radius: var(--border-radius);
    padding: 1rem;
    overflow-x: auto;
}

.problem-description-viewer :deep(code) {
    font-family: var(--font-family-monospace);
}

.empty-placeholder {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
    padding: 0.75rem 0;
}
</style>
