import AppLayout from '@/layout/AppLayout.vue';
import { useAuthStore } from '@/stores/auth';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

// ==================== 仪表盘路由 ====================
const dashboardRoute: RouteRecordRaw = {
    path: '',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: {
        requiresAuth: true,
        breadcrumb: [{ label: '仪表盘' }]
    }
};

// ==================== 权限管理路由 ====================
const accountRoutes: RouteRecordRaw[] = [
    {
        path: '/account/users',
        name: 'users',
        component: () => import('@/views/admin/UserList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '权限管理' }, { label: '用户管理' }]
        }
    },
    {
        path: '/account/roles',
        name: 'roles',
        component: () => import('@/views/admin/RoleList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '权限管理' }, { label: '角色管理' }]
        }
    }
];

// ==================== 安全中心路由 ====================
const securityRoutes: RouteRecordRaw[] = [
    {
        path: '/security/permissions',
        name: 'permissions',
        component: () => import('@/views/security/PermissionList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '安全中心' }, { label: '权限列表' }]
        }
    },
    {
        path: '/security/tokens',
        name: 'authTokens',
        component: () => import('@/views/security/TokenList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '安全中心' }, { label: '认证令牌' }]
        }
    },
    {
        path: '/security/audit-logs',
        name: 'auditLogs',
        component: () => import('@/views/security/AuditLogList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '安全中心' }, { label: '审计日志' }]
        }
    }
];

// ==================== 题库管理路由 ====================
const problemRoutes: RouteRecordRaw[] = [
    {
        path: '/problems',
        name: 'problems',
        component: () => import('@/views/admin/ProblemList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '题目列表' }]
        }
    },
    {
        path: '/problems/new',
        name: 'problemsCreate',
        component: () => import('@/views/admin/ProblemEdit.vue'),
        redirect: { name: 'problemsCreateBasic' },
        children: [
            {
                path: 'basic',
                name: 'problemsCreateBasic',
                component: () => import('@/views/admin/problem-editor/ProblemEditorBasics.vue'),
                meta: {
                    requiresAuth: true,
                    breadcrumb: [
                        { label: '题库管理' },
                        { label: '题目列表', to: '/problems' },
                        { label: '新建题目' },
                        { label: '基本信息' }
                    ]
                }
            },
            {
                path: 'statements',
                name: 'problemsCreateStatements',
                component: () => import('@/views/admin/problem-editor/ProblemEditorStatements.vue'),
                meta: {
                    requiresAuth: true,
                    breadcrumb: [
                        { label: '题库管理' },
                        { label: '题目列表', to: '/problems' },
                        { label: '新建题目' },
                        { label: '题面内容' }
                    ]
                }
            },
            {
                path: 'configurations',
                name: 'problemsCreateConfigurations',
                component: () => import('@/views/admin/problem-editor/ProblemEditorConfigurations.vue'),
                alias: ['datasets'],
                meta: {
                    requiresAuth: true,
                    breadcrumb: [
                        { label: '题库管理' },
                        { label: '题目列表', to: '/problems' },
                        { label: '新建题目' },
                        { label: '判题配置' }
                    ]
                }
            }
        ]
    },
    {
        path: '/problems/categories',
        name: 'categories',
        component: () => import('@/views/admin/CategoryList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '分类管理' }]
        }
    },
    {
        path: '/problems/difficulties',
        name: 'difficulties',
        component: () => import('@/views/admin/DifficultyList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '难度管理' }]
        }
    },
    {
        path: '/problems/languages',
        name: 'languages',
        component: () => import('@/views/admin/LanguageList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '语言管理' }]
        }
    },
    {
        path: '/problems/tags',
        name: 'tags',
        component: () => import('@/views/admin/TagList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '题库管理' }, { label: '标签管理' }]
        }
    }
];

// ==================== 竞赛管理路由 ====================
const contestRoutes: RouteRecordRaw[] = [
    {
        path: '/contests',
        name: 'contests',
        component: () => import('@/views/contests/ContestList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '竞赛管理' }, { label: '比赛列表' }]
        }
    },
    {
        path: '/contests/:contestId',
        name: 'contestDetail',
        component: () => import('@/views/contests/ContestDetail.vue'),
        props: true,
        meta: {
            requiresAuth: true,
            breadcrumb: [
                { label: '竞赛管理' },
                { label: '比赛列表', to: '/contests' },
                { label: '比赛详情' }
            ]
        }
    }
];

// ==================== 社区互动路由 ====================
const interactionRoutes: RouteRecordRaw[] = [
    {
        path: '/interaction/comments',
        name: 'comments',
        component: () => import('@/views/interaction/CommentList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '评论管理' }]
        }
    },
    {
        path: '/interaction/moderation',
        name: 'moderation',
        component: () => import('@/views/interaction/ModerationTaskList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '内容审核' }]
        }
    },
    {
        path: '/interaction/sensitive-words',
        name: 'sensitiveWords',
        component: () => import('@/views/interaction/SensitiveWordList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '敏感词库' }]
        }
    },
    {
        path: '/interaction/reactions',
        name: 'reactions',
        component: () => import('@/views/interaction/ReactionList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '互动反馈' }]
        }
    },
    {
        path: '/interaction/bookmarks',
        name: 'bookmarks',
        component: () => import('@/views/interaction/BookmarkList.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '社区互动' }, { label: '用户收藏' }]
        }
    }
];

// ==================== 评测调度路由 ====================
const judgeRoutes: RouteRecordRaw[] = [
    {
        path: '/judge/monitor',
        name: 'judgeMonitor',
        component: () => import('@/views/judge/JudgeMonitor.vue'),
        meta: {
            requiresAuth: true,
            breadcrumb: [{ label: '评测调度' }, { label: '节点与队列' }]
        }
    }
];

// ==================== 认证相关路由 ====================
const authRoutes: RouteRecordRaw[] = [
    {
        path: '/auth/login',
        name: 'login',
        component: () => import('@/views/pages/auth/Login.vue'),
        meta: {
            guestOnly: true,
            breadcrumb: [{ label: '登录' }]
        }
    },
    {
        path: '/auth/register',
        name: 'register',
        component: () => import('@/views/pages/auth/Register.vue'),
        meta: {
            guestOnly: true,
            breadcrumb: [{ label: '注册' }]
        }
    },
    {
        path: '/auth/forgot-password',
        name: 'forgotPassword',
        component: () => import('@/views/pages/auth/ForgotPassword.vue'),
        meta: {
            guestOnly: true,
            breadcrumb: [{ label: '忘记密码' }]
        }
    },
    {
        path: '/auth/error',
        name: 'error',
        component: () => import('@/views/pages/auth/Error.vue'),
        meta: {
            breadcrumb: [{ label: '错误' }]
        }
    },
    {
        path: '/auth/access',
        name: 'accessDenied',
        component: () => import('@/views/pages/auth/Access.vue'),
        meta: {
            breadcrumb: [{ label: '访问被拒绝' }]
        }
    }
];

// ==================== 主应用路由结构 ====================
const adminChildren: RouteRecordRaw[] = [
    dashboardRoute,
    ...accountRoutes,
    ...securityRoutes,
    ...problemRoutes,
    ...contestRoutes,
    ...interactionRoutes,
    ...judgeRoutes
];

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: AppLayout,
        meta: { requiresAuth: true },
        children: adminChildren
    },
    ...authRoutes,
    // 404 路由
    {
        path: '/:pathMatch(.*)*',
        name: 'notFound',
        redirect: '/auth/error'
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

// ==================== 路由守卫 ====================
router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore();

    // 需要认证的路由
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

    // 仅访客可访问的路由（已登录用户访问会重定向到首页）
    if (to.meta.guestOnly && authStore.isAuthenticated) {
        return next({ name: 'dashboard' });
    }

    next();
});

export default router;
