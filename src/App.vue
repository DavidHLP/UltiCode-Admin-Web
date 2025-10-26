<script setup>
import GlobalToast from '@/components/GlobalToast.vue';
import SensitiveActionDialog from '@/components/SensitiveActionDialog.vue';
</script>

<template>
    <GlobalToast />
    <SensitiveActionDialog global />
    <router-view />
</template>

<style scoped></style>
