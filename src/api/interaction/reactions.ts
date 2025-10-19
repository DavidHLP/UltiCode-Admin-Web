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
}

export interface ReactionQuery {
    page?: number;
    size?: number;
    userId?: number;
    entityType?: string;
    entityId?: number;
    kind?: string;
    source?: string;
}

export interface ReactionDeletePayload {
    userId: number;
    entityType: string;
    entityId: number;
    kind: string;
}

export type ReactionPage = PageResult<ReactionView>;

export function fetchReactions(params: ReactionQuery) {
    return requestData<ReactionPage>({
        url: '/api/admin/interaction/reactions',
        method: 'get',
        params
    });
}

export function deleteReaction(payload: ReactionDeletePayload) {
    return requestData<void>({
        url: '/api/admin/interaction/reactions',
        method: 'delete',
        data: payload
    });
}
