import { requestData } from '@/utils/request';

export interface PermissionView {
    id: number;
    code: string;
    name: string;
    createdAt?: string | null;
}

export interface PermissionQuery {
    keyword?: string;
}

export interface PermissionCreatePayload {
    code: string;
    name: string;
}

export interface PermissionUpdatePayload {
    code: string;
    name: string;
}

export function fetchPermissions(params?: PermissionQuery, signal?: AbortSignal) {
    return requestData<PermissionView[]>({
        url: '/api/admin/permissions',
        method: 'get',
        params,
        signal
    });
}

export function createPermission(payload: PermissionCreatePayload) {
    return requestData<PermissionView>({
        url: '/api/admin/permissions',
        method: 'post',
        data: payload
    });
}

export function updatePermission(permissionId: number, payload: PermissionUpdatePayload) {
    return requestData<PermissionView>({
        url: `/api/admin/permissions/${permissionId}`,
        method: 'put',
        data: payload
    });
}

export function deletePermission(permissionId: number) {
    return requestData<void>({
        url: `/api/admin/permissions/${permissionId}`,
        method: 'delete'
    });
}
