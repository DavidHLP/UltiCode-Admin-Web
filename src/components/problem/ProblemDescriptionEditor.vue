<script setup lang="ts">
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';
import { Editor } from '@bytemd/vue-next';
import { computed } from 'vue';

import 'bytemd/dist/index.css';
import 'highlight.js/styles/github.css';

interface Props {
    modelValue: string;
    placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    placeholder: ''
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
}>();

const plugins = [gfm(), highlight()];

const value = computed(() => props.modelValue);

function handleChange(content: string) {
    emit('update:modelValue', content);
}
</script>

<template>
    <div class="problem-description-editor">
        <Editor :value="value" :plugins="plugins" :placeholder="placeholder" @change="handleChange" />
    </div>
</template>

<style scoped>
.problem-description-editor :deep(.bytemd) {
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
    background: var(--surface-card);
    min-height: 360px;
}

.problem-description-editor :deep(.bytemd-toolbar) {
    background: var(--surface-ground);
}

.problem-description-editor :deep(.bytemd-body) {
    min-height: 280px;
    font-size: 0.95rem;
}
</style>
