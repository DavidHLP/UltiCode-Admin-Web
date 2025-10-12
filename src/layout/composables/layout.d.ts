import type { ComputedRef } from 'vue';

declare interface LayoutConfigState {
    preset: string;
    primary: string;
    surface: string | null;
    darkTheme: boolean;
    menuMode: 'static' | 'overlay';
}

declare interface LayoutReactiveState {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    profileSidebarVisible: boolean;
    configSidebarVisible: boolean;
    staticMenuMobileActive: boolean;
    menuHoverActive: boolean;
    activeMenuItem: unknown;
}

declare interface LayoutComposable {
    layoutConfig: LayoutConfigState;
    layoutState: LayoutReactiveState;
    toggleMenu: () => void;
    isSidebarActive: ComputedRef<boolean>;
    isDarkTheme: ComputedRef<boolean>;
    getPrimary: ComputedRef<string>;
    getSurface: ComputedRef<string | null>;
    setActiveMenuItem: (item: unknown) => void;
    toggleDarkMode: () => void;
}

export declare function useLayout(): LayoutComposable;
