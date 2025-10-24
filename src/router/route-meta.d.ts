import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router';

export type BreadcrumbLabelResolver = string | ((route: RouteLocationNormalizedLoaded) => string);
export type BreadcrumbTargetResolver = RouteLocationRaw | ((route: RouteLocationNormalizedLoaded) => RouteLocationRaw | undefined);

export interface BreadcrumbConfig {
    label: BreadcrumbLabelResolver;
    to?: BreadcrumbTargetResolver;
}

declare module 'vue-router' {
    interface RouteMeta {
        breadcrumb?: BreadcrumbConfig[];
        /** 路由需要认证才能访问 */
        requiresAuth?: boolean;
        /** 路由仅允许访客访问（未登录用户） */
        guestOnly?: boolean;
    }
}
