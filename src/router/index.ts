import AppLayout from '@/layout/AppLayout.vue';
import { useAuthStore } from '@/stores/auth';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const dashboardRoute: RouteRecordRaw = {
    path: '',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: {
        requiresAuth: true,
        breadcrumb: [{ label: '仪表盘' }]
    }
};

const accountRoutes: RouteRecordRaw[] = [
    {
        path: '/admin/users',
        name: 'adminUsers',
        component: () => import('@/views/admin/UserList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '账户中心' }, { label: '用户管理' }]
        }
    },
    {
        path: '/admin/roles',
        name: 'adminRoles',
        component: () => import('@/views/admin/RoleList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '账户中心' }, { label: '角色管理' }]
        }
    }
];

const securityRoutes: RouteRecordRaw[] = [
    {
        path: '/admin/security/permissions',
        name: 'adminSecurityPermissions',
        component: () => import('@/views/security/PermissionList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '安全中心' }, { label: '权限列表' }]
        }
    },
    {
        path: '/admin/security/tokens',
        name: 'adminSecurityTokens',
        component: () => import('@/views/security/TokenList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '安全中心' }, { label: '认证令牌' }]
        }
    },
    {
        path: '/admin/security/audit-logs',
        name: 'adminSecurityAuditLogs',
        component: () => import('@/views/security/AuditLogList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '安全中心' }, { label: '审计日志' }]
        }
    }
];

const problemRoutes: RouteRecordRaw[] = [
    {
        path: '/admin/problems',
        name: 'adminProblems',
        component: () => import('@/views/admin/ProblemList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '题目列表' }]
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
                component: () => import('@/views/admin/problem-editor/ProblemEditorBasics.vue'),
                meta: {
                    requiresAuth: true,
                    breadcrumb: [
                        { label: '题库管理' },
                        { label: '题目列表', to: '/admin/problems' },
                        { label: '新建题目' },
                        { label: '基本信息' }
                    ]
                }
            },
            {
                path: 'statements',
                name: 'adminProblemsCreateStatements',
                component: () => import('@/views/admin/problem-editor/ProblemEditorStatements.vue'),
                meta: {
                    requiresAuth: true,
                    breadcrumb: [
                        { label: '题库管理' },
                        { label: '题目列表', to: '/admin/problems' },
                        { label: '新建题目' },
                        { label: '题面内容' }
                    ]
                }
            },
            {
                path: 'configurations',
                name: 'adminProblemsCreateConfigurations',
                component: () => import('@/views/admin/problem-editor/ProblemEditorConfigurations.vue'),
                alias: ['datasets'],
                meta: {
                    requiresAuth: true,
                    breadcrumb: [
                        { label: '题库管理' },
                        { label: '题目列表', to: '/admin/problems' },
                        { label: '新建题目' },
                        { label: '判题配置' }
                    ]
                }
            }
        ]
    },
    {
        path: '/admin/categories',
        name: 'adminCategories',
        component: () => import('@/views/admin/CategoryList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '分类管理' }]
        }
    },
    {
        path: '/admin/difficulties',
        name: 'adminDifficulties',
        component: () => import('@/views/admin/DifficultyList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '难度管理' }]
        }
    },
    {
        path: '/admin/languages',
        name: 'adminLanguages',
        component: () => import('@/views/admin/LanguageList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '语言管理' }]
        }
    },
    {
        path: '/admin/tags',
        name: 'adminTags',
        component: () => import('@/views/admin/TagList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '标签管理' }]
        }
    }
];

const contestRoutes: RouteRecordRaw[] = [
    {
        path: '/admin/contests',
        name: 'adminContests',
        component: () => import('@/views/contests/ContestList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '竞赛管理' }, { label: '比赛列表' }]
        }
    },
    {
        path: '/admin/contests/:contestId',
        name: 'adminContestDetail',
        component: () => import('@/views/contests/ContestDetail.vue'),
        props: true,
        meta: {
            requiresAuth: true,
            breadcrumb: [
                { label: '竞赛管理' },
                { label: '比赛列表', to: '/admin/contests' },
                { label: '比赛详情' }
            ]
        }
    }
];

const interactionRoutes: RouteRecordRaw[] = [
    {
        path: '/admin/interaction/comments',
        name: 'interactionComments',
        component: () => import('@/views/interaction/CommentList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '评论管理' }]
        }
    },
    {
        path: '/admin/interaction/moderation',
        name: 'interactionModeration',
        component: () => import('@/views/interaction/ModerationTaskList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '内容审核' }]
        }
    },
    {
        path: '/admin/interaction/sensitive-words',
        name: 'interactionSensitiveWords',
        component: () => import('@/views/interaction/SensitiveWordList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '敏感词库' }]
        }
    },
    {
        path: '/admin/interaction/reactions',
        name: 'interactionReactions',
        component: () => import('@/views/interaction/ReactionList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '互动反馈' }]
        }
    },
    {
        path: '/admin/interaction/bookmarks',
        name: 'interactionBookmarks',
        component: () => import('@/views/interaction/BookmarkList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '用户收藏' }]
        }
    }
];

const adminChildren: RouteRecordRaw[] = [
    dashboardRoute,
    ...accountRoutes,
    ...securityRoutes,
    ...problemRoutes,
    ...contestRoutes,
    ...interactionRoutes
];

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: AppLayout,
        meta: { requiresAuth: true },
        children: adminChildren
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore();
    if (to.meta.requiresAuth) {
        if (!authStore.isAuthenticated) {
            try {
                await authStore.ensureAccessToken();
            } catch (error) {
                return next({ name: 'login', query: { redirect: to.fullPath } });
            }
        }
        if (!authStore.isAuthenticated) {
            return next({ name: 'login', query: { redirect: to.fullPath } });
        }
    }
    next();
});

export default router;
