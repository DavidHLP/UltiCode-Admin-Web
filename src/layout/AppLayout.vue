<script setup lang="ts">
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationNormalizedLoaded, type RouteLocationRaw } from 'vue-router';
import AppFooter from './AppFooter.vue';
import AppSidebar from './AppSidebar.vue';
import AppTopbar from './AppTopbar.vue';
import { useLayout } from './composables/layout';

const { layoutConfig, layoutState, isSidebarActive } = useLayout();
const route = useRoute();
const router = useRouter();

const breadcrumbHome = computed<MenuItem>(() => {
    const resolved = router.resolve('/');

    return {
        icon: 'pi pi-home',
        url: resolved.href,
        command: (event: MenuItemCommandEvent) => {
            event.originalEvent.preventDefault();
            void router.push('/');
        }
    };
});

interface BreadcrumbEntry {
    label: string | ((currentRoute: RouteLocationNormalizedLoaded) => string);
    to?: RouteLocationRaw | ((currentRoute: RouteLocationNormalizedLoaded) => RouteLocationRaw | undefined);
}

const breadcrumbItems = computed<MenuItem[]>(() => {
    const metadata = route.meta?.breadcrumb as BreadcrumbEntry[] | undefined;
    if (!metadata) {
        return [];
    }

    const items: MenuItem[] = [];

    metadata.forEach((entry) => {
        const label = typeof entry.label === 'function' ? entry.label(route) : entry.label;
        if (!label) {
            return;
        }

        const target = typeof entry.to === 'function' ? entry.to(route) : entry.to;
        if (target) {
            const resolved = router.resolve(target);
            items.push({
                label,
                url: resolved.href,
                command: (event: MenuItemCommandEvent) => {
                    event.originalEvent.preventDefault();
                    void router.push(target);
                }
            });
        } else {
            items.push({ label });
        }
    });

    return items;
});

const outsideClickListener = ref<null | ((event: MouseEvent) => void)>(null);

watch(isSidebarActive, (newVal) => {
    if (newVal) {
        bindOutsideClickListener();
    } else {
        unbindOutsideClickListener();
    }
});

const containerClass = computed(() => {
    return {
        'layout-overlay': layoutConfig.menuMode === 'overlay',
        'layout-static': layoutConfig.menuMode === 'static',
        'layout-static-inactive': layoutState.staticMenuDesktopInactive && layoutConfig.menuMode === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive,
        'layout-mobile-active': layoutState.staticMenuMobileActive
    };
});

function bindOutsideClickListener() {
    if (!outsideClickListener.value) {
        outsideClickListener.value = (event) => {
            if (isOutsideClicked(event)) {
                layoutState.overlayMenuActive = false;
                layoutState.staticMenuMobileActive = false;
                layoutState.menuHoverActive = false;
            }
        };
        document.addEventListener('click', outsideClickListener.value);
    }
}

function unbindOutsideClickListener() {
    if (outsideClickListener.value) {
        document.removeEventListener('click', outsideClickListener.value);
        outsideClickListener.value = null;
    }
}

function isOutsideClicked(event: MouseEvent) {
    const sidebarEl = document.querySelector('.layout-sidebar');
    const topbarEl = document.querySelector('.layout-menu-button');

    if (!sidebarEl || !topbarEl) {
        return true;
    }

    const target = event.target as Node | null;
    if (!target) {
        return true;
    }

    return !(sidebarEl.isSameNode(target) || sidebarEl.contains(target) || topbarEl.isSameNode(target) || topbarEl.contains(target));
}
</script>

<template>
    <div class="layout-wrapper" :class="containerClass">
        <app-topbar></app-topbar>
        <app-sidebar></app-sidebar>
        <div class="layout-main-container">
            <div class="layout-main">
                <Transition name="fade">
                    <div v-if="breadcrumbItems.length" key="breadcrumb">
                        <Breadcrumb :home="breadcrumbHome" :model="breadcrumbItems" />
                    </div>
                </Transition>
                <router-view></router-view>
            </div>
            <app-footer></app-footer>
        </div>
        <div class="layout-mask animate-fadein"></div>
    </div>
    <Toast />
</template>

<style scoped></style>
