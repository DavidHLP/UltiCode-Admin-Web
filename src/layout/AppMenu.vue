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
        items: [
            { label: '题目管理', icon: 'pi pi-fw pi-book', to: '/admin/problems' },
            { label: '分类管理', icon: 'pi pi-fw pi-sitemap', to: '/admin/categories' },
            { label: '难度管理', icon: 'pi pi-fw pi-sliders-h', to: '/admin/difficulties' },
            { label: '语言管理', icon: 'pi pi-fw pi-code', to: '/admin/languages' },
            { label: '标签管理', icon: 'pi pi-fw pi-tags', to: '/admin/tags' }
        ]
    },
    {
        label: '社区互动',
        items: [
            { label: '评论管理', icon: 'pi pi-fw pi-comments', to: '/admin/interaction/comments' },
            { label: '内容审核', icon: 'pi pi-fw pi-shield', to: '/admin/interaction/moderation' },
            { label: '敏感词库', icon: 'pi pi-fw pi-exclamation-triangle', to: '/admin/interaction/sensitive-words' },
            { label: '互动反馈', icon: 'pi pi-fw pi-thumbs-up', to: '/admin/interaction/reactions' },
            { label: '用户收藏', icon: 'pi pi-fw pi-bookmark', to: '/admin/interaction/bookmarks' }
        ]
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
