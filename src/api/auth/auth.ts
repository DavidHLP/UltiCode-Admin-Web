import { requestData } from '@/utils/request';

export interface LoginPayload {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface LoginResponse {
    token: string;
    [key: string]: unknown;
}

export interface LogoutPayload {
    token: string;
}

export interface UserRole {
    roleName: string;
    [key: string]: unknown;
}

export interface UserInfo {
    id?: number | string;
    name?: string;
    email?: string;
    role?: UserRole;
    [key: string]: unknown;
}

export interface ForgotPasswordPayload {
    email: string;
}

export interface ForgotPasswordResponse {
    message?: string;
}

export function login(data: LoginPayload) {
    return requestData<LoginResponse>({
        url: '/api/auth/login',
        method: 'post',
        data
    });
}

export function logout(data: LogoutPayload) {
    return requestData<void>({
        url: '/api/auth/logout',
        method: 'post',
        data
    });
}

export function getUserInfo() {
    return requestData<UserInfo>({
        url: '/api/auth/me',
        method: 'get'
    });
}

export function requestPasswordReset(data: ForgotPasswordPayload) {
    return requestData<ForgotPasswordResponse>({
        url: '/api/auth/forgot-password',
        method: 'post',
        data
    });
}
