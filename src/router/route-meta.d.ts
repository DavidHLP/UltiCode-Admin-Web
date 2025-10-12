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
    }
}
