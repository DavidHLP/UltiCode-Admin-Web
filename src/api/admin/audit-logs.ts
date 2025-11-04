import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface AuditLogView {
    id: number;
    actorId?: number | null;
    actorUsername?: string | null;
    action: string;
    objectType: string;
    objectId?: string | null;
    description?: string | null;
    ipAddress?: string | null;
    createdAt: string;
}

export interface AuditLogQuery {
    page?: number;
    size?: number;
    action?: string;
    keyword?: string;
    actorId?: number;
    actorUsername?: string;
    objectType?: string;
    objectId?: string;
    createdAtStart?: string;
    createdAtEnd?: string;
}

export type AuditLogPage = PageResult<AuditLogView>;

export function fetchAuditLogs(params: AuditLogQuery, signal?: AbortSignal) {
    return requestData<AuditLogPage>({
        url: '/api/admin/audit-logs',
        method: 'get',
        params,
        signal
    });
}
