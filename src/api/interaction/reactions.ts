import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface ReactionView {
    userId: number;
    entityType: string;
    entityId: number;
    kind: string;
    weight: number;
    source: string;
    metadata?: string | null;
    createdAt: string;
    updatedAt: string;
    sensitiveFlag?: boolean | null;
    sensitiveHits: string[];
    riskLevel?: string | null;
}

export interface ReactionQuery {
    page?: number;
    size?: number;
    userId?: number;
    entityType?: string;
    entityId?: number;
    kind?: string;
    source?: string;
    keyword?: string;
}

export interface ReactionDeletePayload {
    userId: number;
    entityType: string;
    entityId: number;
    kind: string;
}

export type ReactionPage = PageResult<ReactionView>;

export function fetchReactions(params: ReactionQuery, signal?: AbortSignal) {
    return requestData<ReactionPage>({
        url: '/api/admin/interaction/reactions',
        method: 'get',
        params,
        signal
    });
}

export function deleteReaction(payload: ReactionDeletePayload, signal?: AbortSignal) {
    return requestData<void>({
        url: '/api/admin/interaction/reactions',
        method: 'delete',
        data: payload,
        signal
    });
}
