import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

enum CommentStatus {
    Approved = 'approved',
    Pending = 'pending',
    Rejected = 'rejected',
    Hidden = 'hidden'
}

export interface ModerationTaskSummary {
    id: number;
    entityType: string;
    entityId: number;
    status: string;
    priority: number;
    source: string;
    riskLevel?: string | null;
    reviewerId?: number | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    reviewedAt?: string | null;
}

export interface CommentSummary {
    id: number;
    entityType: string;
    entityId: number;
    userId: number;
    parentId?: number | null;
    status: string;
    visibility: string;
    contentPreview: string;
    sensitiveFlag?: boolean | null;
    moderationLevel?: string | null;
    moderationNotes?: string | null;
    lastModeratedBy?: number | null;
    lastModeratedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    reactionStats: Record<string, number>;
    moderationTask?: ModerationTaskSummary | null;
}

export interface CommentDetail extends CommentSummary {
    contentMd: string;
    contentRendered?: string | null;
    sensitiveHits: string[];
}

export interface CommentQuery {
    page?: number;
    size?: number;
    status?: string;
    entityType?: string;
    entityId?: number;
    userId?: number;
    sensitiveOnly?: boolean;
    keyword?: string;
    moderationLevel?: string;
}

export interface CommentUpdatePayload {
    contentMd: string;
    contentRendered?: string | null;
    visibility?: string;
}

export interface CommentStatusPayload {
    status: CommentStatus | string;
    moderationNotes?: string;
    moderationLevel?: string;
}

export type CommentPage = PageResult<CommentSummary>;

export function fetchComments(params: CommentQuery) {
    return requestData<CommentPage>({
        url: '/api/admin/interaction/comments',
        method: 'get',
        params
    });
}

export function fetchComment(commentId: number) {
    return requestData<CommentDetail>({
        url: `/api/admin/interaction/comments/${commentId}`,
        method: 'get'
    });
}

export function updateComment(commentId: number, payload: CommentUpdatePayload) {
    return requestData<CommentDetail>({
        url: `/api/admin/interaction/comments/${commentId}`,
        method: 'put',
        data: payload
    });
}

export function updateCommentStatus(commentId: number, payload: CommentStatusPayload) {
    return requestData<CommentDetail>({
        url: `/api/admin/interaction/comments/${commentId}/status`,
        method: 'put',
        data: payload
    });
}

export { CommentStatus };
