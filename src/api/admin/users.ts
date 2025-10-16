import type {PageResult} from '@/api/types';
import {requestData} from '@/utils/request';

export interface RoleDto {
    id: number;
    code: string;
    name: string;
}

export interface UserView {
    id: number;
    username: string;
    email: string;
    status: number;
    avatarUrl?: string | null;
    bio?: string | null;
    lastLoginAt?: string | null;
    lastLoginIp?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    roles: RoleDto[];
}

export interface UserQuery {
    page?: number;
    size?: number;
    keyword?: string;
    status?: number | null;
    roleId?: number | null;
}

export interface UserCreatePayload {
    username: string;
    email: string;
    password: string;
    avatarUrl?: string;
    bio?: string;
    status?: number;
    roleIds?: number[];
}

export interface UserUpdatePayload {
    username?: string;
    email?: string;
    password?: string;
    avatarUrl?: string;
    bio?: string;
    status?: number;
    roleIds?: number[];
}

export type UserPage = PageResult<UserView>;

export function fetchUsers(params: UserQuery) {
    return requestData<UserPage>({
        url: '/api/admin/users',
        method: 'get',
        params
    });
}

export function fetchUser(userId: number) {
    return requestData<UserView>({
        url: `/api/admin/users/${userId}`,
        method: 'get'
    });
}

export function createUser(payload: UserCreatePayload) {
    return requestData<UserView>({
        url: '/api/admin/users',
        method: 'post',
        data: payload
    });
}

export function updateUser(userId: number, payload: UserUpdatePayload) {
    return requestData<UserView>({
        url: `/api/admin/users/${userId}`,
        method: 'put',
        data: payload
    });
}

export function fetchRoles() {
    return requestData<RoleDto[]>({
        url: '/api/admin/roles',
        method: 'get'
    });
}

