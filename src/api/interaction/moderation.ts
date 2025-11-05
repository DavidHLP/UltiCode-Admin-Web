import type { CommentDetail, ModerationTaskSummary } from '@/api/interaction/comments';
import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface ModerationActionView {
    id: number;
    taskId: number;
    action: string;
    operatorId?: number | null;
    remarks?: string | null;
    context: Record<string, unknown>;
    createdAt: string;
}

export interface ModerationTaskDetail {
    task: ModerationTaskSummary;
    comment: CommentDetail;
    actions: ModerationActionView[];
}

export interface ModerationTaskQuery {
    page?: number;
    size?: number;
    status?: string;
    entityType?: string;
    reviewerId?: number;
    riskLevel?: string;
    source?: string;
    keyword?: string;
}

export interface ModerationAssignPayload {
    reviewerId?: number | null;
    notes?: string;
}

export interface ModerationDecisionPayload {
    decision: 'approve' | 'reject' | 'escalate';
    notes?: string;
    moderationLevel?: string;
}

export type ModerationTaskPage = PageResult<ModerationTaskSummary>;

export function fetchModerationTasks(params: ModerationTaskQuery, signal?: AbortSignal) {
    return requestData<ModerationTaskPage>({
        url: '/api/admin/interaction/moderation/tasks',
        method: 'get',
        params,
        signal
    });
}

export function fetchModerationTask(taskId: number, signal?: AbortSignal) {
    return requestData<ModerationTaskDetail>({
        url: `/api/admin/interaction/moderation/tasks/${taskId}`,
        method: 'get',
        signal
    });
}

export function assignModerationTask(taskId: number, payload: ModerationAssignPayload, signal?: AbortSignal) {
    return requestData<ModerationTaskDetail>({
        url: `/api/admin/interaction/moderation/tasks/${taskId}/assign`,
        method: 'post',
        data: payload,
        signal
    });
}

export function takeModerationTask(taskId: number, signal?: AbortSignal) {
    return requestData<ModerationTaskDetail>({
        url: `/api/admin/interaction/moderation/tasks/${taskId}/take`,
        method: 'post',
        signal
    });
}

export function decideModerationTask(taskId: number, payload: ModerationDecisionPayload, signal?: AbortSignal) {
    return requestData<ModerationTaskDetail>({
        url: `/api/admin/interaction/moderation/tasks/${taskId}/decision`,
        method: 'post',
        data: payload,
        signal
    });
}
