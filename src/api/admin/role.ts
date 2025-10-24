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
    keyword?: string;
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

export function fetchRoleList(params?: RoleQuery, signal?: AbortSignal) {
    return requestData<RoleView[]>({
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

export function createRole(payload: RoleCreatePayload, sensitiveToken: string) {
    return requestData<RoleView>({
        url: '/api/admin/roles',
        method: 'post',
        data: payload,
        sensitiveToken
    });
}

export function updateRole(roleId: number, payload: RoleUpdatePayload, sensitiveToken: string) {
    return requestData<RoleView>({
        url: `/api/admin/roles/${roleId}`,
        method: 'put',
        data: payload,
        sensitiveToken
    });
}

export function deleteRole(roleId: number, sensitiveToken: string) {
    return requestData<void>({
        url: `/api/admin/roles/${roleId}`,
        method: 'delete',
        sensitiveToken
    });
}

export function fetchRoleOptions(signal?: AbortSignal) {
    return requestData<RoleDto[]>({
        url: '/api/admin/roles/options',
        method: 'get',
        signal
    });
}
