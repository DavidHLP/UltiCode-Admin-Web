import { requestData } from '@/utils/request';

export interface UserProfile {
    id: number;
    username: string;
    email: string;
    avatarUrl?: string | null;
    bio?: string | null;
    status?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    roles: string[];
}

export interface AuthResponse {
    tokenType: string;
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
    refreshTokenExpiresIn: number;
    user: UserProfile;
}

export interface LoginPayload {
    identifier: string;
    password: string;
    captchaToken?: string;
    twoFactorCode?: string;
}

export interface RegisterPayload {
    username: string;
    email: string;
    password: string;
    verificationCode: string;
    captchaToken?: string;
}

export interface RefreshPayload {
    refreshToken?: string;
}

export interface ForgotPasswordPayload {
    email: string;
}

export interface RegistrationCodePayload {
    email: string;
}

export interface TwoFactorSetupResponse {
    enabled: boolean;
    secret?: string;
    provisioningUri?: string;
    userId: number;
}

export interface SensitiveActionTokenResponse {
    token: string;
}

export interface SsoSessionResponse {
    userId: number;
    clientId: string;
    token: string;
    state?: string;
    expiresAt: string;
}

export const BASE_URL = '/api/auth';

function withCaptchaToken<T extends { captchaToken?: string }>(payload: T): T {
    if (!payload.captchaToken) {
        return { ...payload, captchaToken: 'admin-console-default-captcha' };
    }
    return payload;
}

export function login(payload: LoginPayload) {
    return requestData<AuthResponse>({
        url: `${BASE_URL}/login`,
        method: 'POST',
        data: withCaptchaToken(payload)
    });
}

export function register(payload: RegisterPayload) {
    return requestData<AuthResponse>({
        url: `${BASE_URL}/register`,
        method: 'POST',
        data: withCaptchaToken(payload)
    });
}

export function requestRegistrationCode(payload: RegistrationCodePayload) {
    return requestData<void>({
        url: `${BASE_URL}/register/code`,
        method: 'POST',
        data: payload
    });
}

export function refreshToken(payload?: RefreshPayload) {
    return requestData<AuthResponse>({
        url: `${BASE_URL}/refresh`,
        method: 'POST',
        data: payload ?? {}
    });
}

export function fetchProfile() {
    return requestData<UserProfile>({
        url: `${BASE_URL}/me`,
        method: 'GET'
    });
}

export function requestPasswordReset(payload: ForgotPasswordPayload) {
    return requestData<void>({
        url: `${BASE_URL}/forgot`,
        method: 'POST',
        data: payload
    });
}

export function enableTwoFactor() {
    return requestData<TwoFactorSetupResponse>({
        url: `${BASE_URL}/mfa/enable`,
        method: 'POST'
    });
}

export function disableTwoFactor() {
    return requestData<void>({
        url: `${BASE_URL}/mfa/disable`,
        method: 'POST'
    });
}

export function issueSensitiveActionToken(twoFactorCode: string) {
    return requestData<string>({
        url: `${BASE_URL}/sensitive-token`,
        method: 'POST',
        data: { twoFactorCode }
    });
}

export function verifySensitiveActionToken(token: string) {
    return requestData<boolean>({
        url: `${BASE_URL}/sensitive-token/verify`,
        method: 'POST',
        data: { token }
    });
}

export function initiateSso(clientId: string, state?: string, ttlSeconds?: number) {
    return requestData<SsoSessionResponse>({
        url: `${BASE_URL}/sso/initiate`,
        method: 'POST',
        data: { clientId, state, ttlSeconds }
    });
}
