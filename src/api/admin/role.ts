import { requestData } from '@/utils/request';
import { type Page } from '@/utils/types';

export interface Role {
    id: number; // 主键ID
    roleName: string; // 角色名称
    status: number; // 状态
    remark?: string; // 备注信息（可选）
    createTime: string; // 创建时间（通常后端返回 ISO 字符串）
    updateTime: string; // 更新时间
}

export interface QueryRolesPayload {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: number | null;
}

export interface UpsertRolePayload {
    roleName: string;
    status: number;
    remark?: string | null;
}

export const getRoleList = async (): Promise<Role[]> => {
    return requestData<Role[]>({
        url: '/api/user/role/list',
        method: 'get'
    });
};

export const fetchRoles = async (params: QueryRolesPayload = {}): Promise<Page<Role>> => {
    return requestData<Page<Role>>({
        url: '/api/user/role/page',
        method: 'get',
        params
    });
};

export const createRole = async (payload: UpsertRolePayload): Promise<Role> => {
    return requestData<Role>({
        url: '/api/user/role',
        method: 'post',
        data: payload
    });
};

export const updateRole = async (roleId: number | string, payload: UpsertRolePayload): Promise<Role> => {
    return requestData<Role>({
        url: `/api/user/role/${roleId}`,
        method: 'put',
        data: payload
    });
};

export const deleteRole = async (roleId: number | string): Promise<void> => {
    return requestData<void>({
        url: `/api/user/role/${roleId}`,
        method: 'delete'
    });
};
