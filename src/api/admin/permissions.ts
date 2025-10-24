import { requestData } from '@/utils/request';

export interface PermissionView {
    id: number;
    code: string;
    name: string;
}

export interface PermissionQuery {
    keyword?: string;
}

export interface PermissionCreatePayload {
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

export function createPermission(payload: PermissionCreatePayload, sensitiveToken: string) {
    return requestData<PermissionView>({
        url: '/api/admin/permissions',
        method: 'post',
        data: payload,
        sensitiveToken
    });
}

export function deletePermission(permissionId: number, sensitiveToken: string) {
    return requestData<void>({
        url: `/api/admin/permissions/${permissionId}`,
        method: 'delete',
        sensitiveToken
    });
}
