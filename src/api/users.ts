import { requestData } from '@/utils/request';
import { Page } from '@/utils/types';

export interface Role {
    roleId?: number | string;
    roleName: string;
    [key: string]: unknown;
}

export interface UserRecord {
    userId: number;
    username: string;
    avatar?: string | null;
    introduction?: string | null;
    email?: string | null;
    status?: number | null;
    address?: string | null;
    lastLoginIp?: string | null;
    lastLogin?: string | null;
    createTime?: string | null;
    roles?: Role[] | null;
    role?: Role | null;
    [key: string]: unknown;
}

export interface QueryUsersPayload {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: number | null;
}

export interface UpsertUserPayload {
    username: string;
    email?: string | null;
    password?: string;
    introduction?: string | null;
    address?: string | null;
    status?: number | null;
    roleIds?: Array<number | string> | null;
}

export function fetchUsers(params: QueryUsersPayload = {}) {
    return requestData<Page<UserRecord>>({
        url: '/user/api/user/page',
        method: 'get',
        params
    });
}

export function createUser(payload: UpsertUserPayload) {
    return requestData<UserRecord>({
        url: '/user/api/user',
        method: 'post',
        data: payload
    });
}

export function updateUser(userId: number | string, payload: UpsertUserPayload) {
    return requestData<UserRecord>({
        url: `/user/api/user/${userId}`,
        method: 'put',
        data: payload
    });
}

export function deleteUser(userId: number | string) {
    return requestData<void>({
        url: `/user/api/user/${userId}`,
        method: 'delete'
    });
}
