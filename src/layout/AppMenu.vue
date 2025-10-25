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
            { label: '用户管理', icon: 'pi pi-fw pi-users', to: '/account/users' },
            { label: '角色管理', icon: 'pi pi-fw pi-shield', to: '/account/roles' }
        ]
    },
    {
        label: '安全中心',
        items: [
            { label: '权限列表', icon: 'pi pi-fw pi-key', to: '/security/permissions' },
            { label: '认证令牌', icon: 'pi pi-fw pi-id-card', to: '/security/tokens' },
            { label: '审计日志', icon: 'pi pi-fw pi-history', to: '/security/audit-logs' }
        ]
    },
    {
        label: '题库管理',
        items: [
            { label: '题目管理', icon: 'pi pi-fw pi-book', to: '/problems' },
            { label: '分类管理', icon: 'pi pi-fw pi-sitemap', to: '/problems/categories' },
            { label: '难度管理', icon: 'pi pi-fw pi-sliders-h', to: '/problems/difficulties' },
            { label: '语言管理', icon: 'pi pi-fw pi-code', to: '/problems/languages' },
            { label: '标签管理', icon: 'pi pi-fw pi-tags', to: '/problems/tags' }
        ]
    },
    {
        label: '竞赛管理',
        items: [{ label: '比赛列表', icon: 'pi pi-fw pi-flag', to: '/contests' }]
    },
    {
        label: '评测调度',
        items: [{ label: '节点与队列', icon: 'pi pi-fw pi-server', to: '/judge/monitor' }]
    },
    {
        label: '社区互动',
        items: [
            { label: '评论管理', icon: 'pi pi-fw pi-comments', to: '/interaction/comments' },
            { label: '内容审核', icon: 'pi pi-fw pi-eye', to: '/interaction/moderation' },
            { label: '敏感词库', icon: 'pi pi-fw pi-exclamation-triangle', to: '/interaction/sensitive-words' },
            { label: '互动反馈', icon: 'pi pi-fw pi-thumbs-up', to: '/interaction/reactions' },
            { label: '用户收藏', icon: 'pi pi-fw pi-bookmark', to: '/interaction/bookmarks' }
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
