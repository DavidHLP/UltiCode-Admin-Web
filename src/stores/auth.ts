import {
    disableTwoFactor as disableTwoFactorRequest,
    enableTwoFactor as enableTwoFactorRequest,
    fetchProfile,
    issueSensitiveActionToken,
    login as loginRequest,
    refreshToken as refreshTokenRequest,
    register as registerRequest,
    requestSensitiveActionCode,
    type AuthResponse,
    type LoginPayload,
    type RegisterPayload,
    type TwoFactorSetupResponse,
    type UserProfile
} from '@/api/auth/auth';
import { defineStore } from 'pinia';

interface AuthState {
    tokenType: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
    user: UserProfile | null;
    twoFactorSetup: TwoFactorSetupResponse | null;
}

interface StoredAuthState {
    tokenType: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: number | null;
    refreshTokenExpiresAt: number | null;
    user: UserProfile | null;
}

const STORAGE_KEY = 'admin-console-auth';
const ACCESS_TOKEN_REFRESH_THRESHOLD = 15_000; // 15s 提前刷新

function now(): number {
    return Date.now();
}

function loadFromStorage(): Partial<StoredAuthState> {
    if (typeof window === 'undefined') {
        return {};
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }
        return JSON.parse(raw) as StoredAuthState;
    } catch (error) {
        console.warn('[auth] Failed to parse stored auth state:', error);
        return {};
    }
}

function persistState(state: StoredAuthState | null): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (!state) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function calculateExpiry(seconds: number | null | undefined): number | null {
    if (!seconds || seconds <= 0) {
        return null;
    }
    return now() + seconds * 1000;
}

function isExpired(expireAt: number | null): boolean {
    return Boolean(expireAt && expireAt <= now());
}

function expiresSoon(expireAt: number | null): boolean {
    if (!expireAt) {
        return false;
    }
    return expireAt - now() <= ACCESS_TOKEN_REFRESH_THRESHOLD;
}

export const useAuthStore = defineStore('auth', {
    state: (): AuthState => {
        const persisted = loadFromStorage();
        return {
            tokenType: persisted.tokenType ?? null,
            accessToken: persisted.accessToken ?? null,
            refreshToken: persisted.refreshToken ?? null,
            accessTokenExpiresAt: persisted.accessTokenExpiresAt ?? null,
            refreshTokenExpiresAt: persisted.refreshTokenExpiresAt ?? null,
            user: persisted.user ?? null,
            twoFactorSetup: null,
        };
    },
    getters: {
        isAuthenticated(state): boolean {
            if (!state.accessToken) {
                return false;
            }
            if (isExpired(state.accessTokenExpiresAt)) {
                return false;
            }
            return true;
        },
        authorizationHeader(state): string | null {
            if (!state.accessToken) {
                return null;
            }
            return `${state.tokenType ?? 'Bearer'} ${state.accessToken}`;
        },
        accessTokenExpiresSoon(state): boolean {
            return expiresSoon(state.accessTokenExpiresAt);
        },
        refreshTokenExpired(state): boolean {
            return isExpired(state.refreshTokenExpiresAt);
        }
    },
    actions: {
        applyAuthResponse(response: AuthResponse) {
            this.tokenType = response.tokenType;
            this.accessToken = response.accessToken;
            this.refreshToken = response.refreshToken;
            this.accessTokenExpiresAt = calculateExpiry(response.accessTokenExpiresIn);
            this.refreshTokenExpiresAt = calculateExpiry(response.refreshTokenExpiresIn);
            this.user = response.user;
            this.persist();
        },
        setUser(user: UserProfile) {
            this.user = user;
            this.persist();
        },
        clearAuthData() {
            this.tokenType = null;
            this.accessToken = null;
            this.refreshToken = null;
            this.accessTokenExpiresAt = null;
            this.refreshTokenExpiresAt = null;
            this.user = null;
            this.twoFactorSetup = null;
            persistState(null);
        },
        persist() {
            const state: StoredAuthState = {
                tokenType: this.tokenType,
                accessToken: this.accessToken,
                refreshToken: this.refreshToken,
                accessTokenExpiresAt: this.accessTokenExpiresAt,
                refreshTokenExpiresAt: this.refreshTokenExpiresAt,
                user: this.user
            };
            persistState(state);
        },
        async login(payload: LoginPayload) {
            const response = await loginRequest(payload);
            this.applyAuthResponse(response);
            return response.user;
        },
        async register(payload: RegisterPayload) {
            const response = await registerRequest(payload);
            this.applyAuthResponse(response);
            return response.user;
        },
        async refresh() {
            if (this.refreshTokenExpired) {
                this.clearAuthData();
                throw new Error('刷新令牌已过期，请重新登录');
            }
            const payload = this.refreshToken ? { refreshToken: this.refreshToken } : undefined;
            const response = await refreshTokenRequest(payload);
            this.applyAuthResponse(response);
            return response;
        },
        async ensureAccessToken() {
            if (!this.accessToken) {
                return;
            }
            if (!this.accessTokenExpiresSoon) {
                return;
            }
            await this.refresh();
        },
        async loadProfile() {
            const profile = await fetchProfile();
            this.setUser(profile);
            return profile;
        },
        async enableTwoFactor() {
            const setup = await enableTwoFactorRequest();
            this.twoFactorSetup = setup;
            return setup;
        },
        async disableTwoFactor() {
            await disableTwoFactorRequest();
            this.twoFactorSetup = null;
        },
        async requestSensitiveCode() {
            await requestSensitiveActionCode();
        },
        async obtainSensitiveToken(verificationCode: string) {
            const token = await issueSensitiveActionToken(verificationCode);
            return token;
        }
    }
});
