<script setup>
import { ref } from 'vue';

import AppMenuItem from './AppMenuItem.vue';

const model = ref([
    {
        label: '总览',
        items: [{ label: '仪表盘', icon: 'pi pi-fw pi-home', to: '/' }]
    },
    {
        label: '权限管理',
        items: [
            { label: '用户管理', icon: 'pi pi-fw pi-users', to: '/admin/users' },
            { label: '角色管理', icon: 'pi pi-fw pi-shield', to: '/admin/roles' }
        ]
    },
    {
        label: '题库管理',
        items: [{ label: '题目管理', icon: 'pi pi-fw pi-book', to: '/admin/problems' }]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
