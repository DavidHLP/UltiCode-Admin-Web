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
}

export interface RegisterPayload {
    username: string;
    email: string;
    password: string;
    verificationCode: string;
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

export const BASE_URL = '/api/auth';

export function login(payload: LoginPayload) {
    return requestData<AuthResponse>({
        url: `${BASE_URL}/login`,
        method: 'POST',
        data: payload
    });
}

export function register(payload: RegisterPayload) {
    return requestData<AuthResponse>({
        url: `${BASE_URL}/register`,
        method: 'POST',
        data: payload
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
