import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface PermissionDto {
    id: number;
    code: string;
    name: string;
}

export interface RoleDto {
    id: number;
    code: string;
    name: string;
}

export interface RoleView extends RoleDto {
    remark?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    permissions: PermissionDto[];
}

export interface RoleQuery {
    page?: number;
    size?: number;
    keyword?: string;
    code?: string;
    name?: string;
    remark?: string;
    permissionIds?: number[];
}

export interface RoleCreatePayload {
    code: string;
    name: string;
    remark?: string | null;
    permissionIds?: number[];
}

export interface RoleUpdatePayload {
    code?: string;
    name?: string;
    remark?: string | null;
    permissionIds?: number[];
}

export type RolePage = PageResult<RoleView>;

export function fetchRoleList(params?: RoleQuery, signal?: AbortSignal) {
    return requestData<RolePage>({
        url: '/api/admin/roles',
        method: 'get',
        params,
        signal
    });
}

export function fetchRole(roleId: number) {
    return requestData<RoleView>({
        url: `/api/admin/roles/${roleId}`,
        method: 'get'
    });
}

export function createRole(payload: RoleCreatePayload) {
    return requestData<RoleView>({
        url: '/api/admin/roles',
        method: 'post',
        data: payload
    });
}

export function updateRole(roleId: number, payload: RoleUpdatePayload) {
    return requestData<RoleView>({
        url: `/api/admin/roles/${roleId}`,
        method: 'put',
        data: payload
    });
}

export function deleteRole(roleId: number) {
    return requestData<void>({
        url: `/api/admin/roles/${roleId}`,
        method: 'delete'
    });
}

export function fetchRoleOptions(signal?: AbortSignal) {
    return requestData<RoleDto[]>({
        url: '/api/admin/roles/options',
        method: 'get',
        signal
    });
}

export function fetchRolePermissionOptions(params?: RoleQuery, signal?: AbortSignal) {
    return requestData<PermissionDto[]>({
        url: '/api/admin/roles/permissions',
        method: 'get',
        params,
        signal
    });
}
