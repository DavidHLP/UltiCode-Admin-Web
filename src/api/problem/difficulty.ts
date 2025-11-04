import type { PageResult } from '@/api/types.ts';
import { requestData } from '@/utils/request.ts';

export interface DifficultyView {
    id: number;
    code: string;
    sortKey: number;
}

export interface DifficultyQuery {
    keyword?: string;
    difficultyId?: number;
    code?: string;
    sortKey?: number;
    page?: number;
    size?: number;
}

export interface DifficultyCreatePayload {
    id: number;
    code: string;
    sortKey: number;
}

export interface DifficultyUpdatePayload {
    code?: string;
    sortKey?: number;
}

export type DifficultyListResponse = PageResult<DifficultyView>;

export function fetchDifficulties(params?: DifficultyQuery, signal?: AbortSignal) {
    return requestData<DifficultyListResponse>({
        url: '/api/admin/difficulties',
        method: 'get',
        params,
        signal
    });
}

export function fetchDifficulty(difficultyId: number) {
    return requestData<DifficultyView>({
        url: `/api/admin/difficulties/${difficultyId}`,
        method: 'get'
    });
}

export function createDifficulty(payload: DifficultyCreatePayload) {
    return requestData<DifficultyView>({
        url: '/api/admin/difficulties',
        method: 'post',
        data: payload
    });
}

export function updateDifficulty(
    difficultyId: number,
    payload: DifficultyUpdatePayload
) {
    return requestData<DifficultyView>({
        url: `/api/admin/difficulties/${difficultyId}`,
        method: 'put',
        data: payload
    });
}

export function deleteDifficulty(difficultyId: number) {
    return requestData<void>({
        url: `/api/admin/difficulties/${difficultyId}`,
        method: 'delete'
    });
}
