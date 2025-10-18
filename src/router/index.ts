import AppLayout from '@/layout/AppLayout.vue';
import { useAuthStore } from '@/stores/auth';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: AppLayout,
        meta: {requiresAuth: true},
        children: [
            {
                path: '/',
                name: 'dashboard',
                component: () => import('@/views/Dashboard.vue'),
                meta: {
                    breadcrumb: [{label: '仪表盘'}]
                }
            },
            {
                path: '/admin/users',
                name: 'adminUsers',
                component: () => import('@/views/admin/UserList.vue'),
                meta: {
                    breadcrumb: [{label: '权限管理'}, {label: '用户管理'}]
                }
            },
            {
                path: '/admin/roles',
                name: 'adminRoles',
                component: () => import('@/views/admin/RoleList.vue'),
                meta: {
                    breadcrumb: [{label: '权限管理'}, {label: '角色管理'}]
                }
            },
            {
                path: '/admin/problems',
                name: 'adminProblems',
                component: () => import('@/views/admin/ProblemList.vue'),
                meta: {
                    breadcrumb: [{label: '题库管理'}, {label: '题目管理'}]
                }
            },
            {
                path: '/admin/categories',
                name: 'adminCategories',
                component: () => import('@/views/admin/CategoryList.vue'),
                meta: {
                    breadcrumb: [{label: '题库管理'}, {label: '分类管理'}]
                }
            },
            {
                path: '/admin/difficulties',
                name: 'adminDifficulties',
                component: () => import('@/views/admin/DifficultyList.vue'),
                meta: {
                    breadcrumb: [{label: '题库管理'}, {label: '难度管理'}]
                }
            },
            {
                path: '/admin/languages',
                name: 'adminLanguages',
                component: () => import('@/views/admin/LanguageList.vue'),
                meta: {
                    breadcrumb: [{label: '题库管理'}, {label: '语言管理'}]
                }
            },
            {
                path: '/admin/tags',
                name: 'adminTags',
                component: () => import('@/views/admin/TagList.vue'),
                meta: {
                    breadcrumb: [{label: '题库管理'}, {label: '标签管理'}]
                }
            },
            {
                path: '/admin/problems/new',
                name: 'adminProblemsCreate',
                component: () => import('@/views/admin/ProblemEdit.vue'),
                redirect: { name: 'adminProblemsCreateBasic' },
                children: [
                    {
                        path: 'basic',
                        name: 'adminProblemsCreateBasic',
                        component: () => import('@/views/admin/problem-editor/ProblemEditorBasics.vue')
                    },
                    {
                        path: 'statements',
                        name: 'adminProblemsCreateStatements',
                        component: () => import('@/views/admin/problem-editor/ProblemEditorStatements.vue')
                    },
                    {
                        path: 'configurations',
                        name: 'adminProblemsCreateConfigurations',
                        component: () => import('@/views/admin/problem-editor/ProblemEditorConfigurations.vue')
                    }
                ],
                meta: {
                    breadcrumb: [
                        {label: '题库管理'},
                        {label: '题目管理', to: '/admin/problems'},
                        {label: '新建题目'}
                    ]
                }
            },
            {
                path: '/admin/problems/:problemId',
                name: 'adminProblemsEdit',
                component: () => import('@/views/admin/ProblemEdit.vue'),
                redirect: { name: 'adminProblemsEditBasic' },
                children: [
                    {
                        path: 'basic',
                        name: 'adminProblemsEditBasic',
                        component: () => import('@/views/admin/problem-editor/ProblemEditorBasics.vue')
                    },
                    {
                        path: 'statements',
                        name: 'adminProblemsEditStatements',
                        component: () => import('@/views/admin/problem-editor/ProblemEditorStatements.vue')
                    },
                    {
                        path: 'configurations',
                        name: 'adminProblemsEditConfigurations',
                        component: () => import('@/views/admin/problem-editor/ProblemEditorConfigurations.vue')
                    }
                ],
                meta: {
                    breadcrumb: [
                        {label: '题库管理'},
                        {label: '题目管理', to: '/admin/problems'},
                        {label: '编辑题目'}
                    ]
                }
            },
            {
                path: '/uikit/formlayout',
                name: 'formlayout',
                component: () => import('@/views/uikit/FormLayout.vue')
            },
            {
                path: '/uikit/input',
                name: 'input',
                component: () => import('@/views/uikit/InputDoc.vue')
            },
            {
                path: '/uikit/button',
                name: 'button',
                component: () => import('@/views/uikit/ButtonDoc.vue')
            },
            {
                path: '/uikit/table',
                name: 'table',
                component: () => import('@/views/uikit/TableDoc.vue')
            },
            {
                path: '/uikit/list',
                name: 'list',
                component: () => import('@/views/uikit/ListDoc.vue')
            },
            {
                path: '/uikit/tree',
                name: 'tree',
                component: () => import('@/views/uikit/TreeDoc.vue')
            },
            {
                path: '/uikit/panel',
                name: 'panel',
                component: () => import('@/views/uikit/PanelsDoc.vue')
            },
            {
                path: '/uikit/overlay',
                name: 'overlay',
                component: () => import('@/views/uikit/OverlayDoc.vue')
            },
            {
                path: '/uikit/media',
                name: 'media',
                component: () => import('@/views/uikit/MediaDoc.vue')
            },
            {
                path: '/uikit/message',
                name: 'message',
                component: () => import('@/views/uikit/MessagesDoc.vue')
            },
            {
                path: '/uikit/file',
                name: 'file',
                component: () => import('@/views/uikit/FileDoc.vue')
            },
            {
                path: '/uikit/menu',
                name: 'menu',
                component: () => import('@/views/uikit/MenuDoc.vue')
            },
            {
                path: '/uikit/charts',
                name: 'charts',
                component: () => import('@/views/uikit/ChartDoc.vue')
            },
            {
                path: '/uikit/misc',
                name: 'misc',
                component: () => import('@/views/uikit/MiscDoc.vue')
            },
            {
                path: '/uikit/timeline',
                name: 'timeline',
                component: () => import('@/views/uikit/TimelineDoc.vue')
            },
            {
                path: '/pages/empty',
                name: 'empty',
                component: () => import('@/views/pages/Empty.vue')
            },
            {
                path: '/pages/crud',
                name: 'crud',
                component: () => import('@/views/pages/Crud.vue')
            },
            {
                path: '/documentation',
                name: 'documentation',
                component: () => import('@/views/pages/Documentation.vue')
            }
        ]
    },
    {
        path: '/landing',
        name: 'landing',
        component: () => import('@/views/pages/Landing.vue')
    },
    {
        path: '/pages/notfound',
        name: 'notfound',
        component: () => import('@/views/pages/NotFound.vue')
    },
    {
        path: '/auth/login',
        name: 'login',
        component: () => import('@/views/pages/auth/Login.vue'),
        meta: {guestOnly: true}
    },
    {
        path: '/auth/forgot-password',
        name: 'forgotPassword',
        component: () => import('@/views/pages/auth/Forget.vue'),
        meta: {guestOnly: true}
    },
    {
        path: '/auth/register',
        name: 'register',
        component: () => import('@/views/pages/auth/Register.vue'),
        meta: {guestOnly: true}
    },
    {
        path: '/auth/access',
        name: 'accessDenied',
        component: () => import('@/views/pages/auth/Access.vue')
    },
    {
        path: '/auth/error',
        name: 'error',
        component: () => import('@/views/pages/auth/Error.vue')
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore();
    const isAuthenticated = authStore.isAuthenticated;

    if (to.meta.requiresAuth && !isAuthenticated) {
        next({name: 'login', query: {redirect: to.fullPath}});
        return;
    }

    if (to.meta.guestOnly && isAuthenticated) {
        next({name: 'dashboard'});
        return;
    }

    next();
});

export default router;
