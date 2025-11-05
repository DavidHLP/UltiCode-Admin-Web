import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface SensitiveWordView {
    id: number;
    word: string;
    category?: string | null;
    level: 'block' | 'review' | 'replace' | string;
    replacement?: string | null;
    description?: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SensitiveWordQuery {
    page?: number;
    size?: number;
    keyword?: string;
    category?: string;
    level?: string;
    active?: boolean;
}

export interface SensitiveWordUpsertPayload {
    word: string;
    category?: string | null;
    level: 'block' | 'review' | 'replace' | string;
    replacement?: string | null;
    description?: string | null;
    active?: boolean;
}

export type SensitiveWordPage = PageResult<SensitiveWordView>;

export function fetchSensitiveWords(params: SensitiveWordQuery, signal?: AbortSignal) {
    return requestData<SensitiveWordPage>({
        url: '/api/admin/interaction/sensitive-words',
        method: 'get',
        params,
        signal
    });
}

export function createSensitiveWord(payload: SensitiveWordUpsertPayload, signal?: AbortSignal) {
    return requestData<SensitiveWordView>({
        url: '/api/admin/interaction/sensitive-words',
        method: 'post',
        data: payload,
        signal
    });
}

export function updateSensitiveWord(id: number, payload: SensitiveWordUpsertPayload, signal?: AbortSignal) {
    return requestData<SensitiveWordView>({
        url: `/api/admin/interaction/sensitive-words/${id}`,
        method: 'put',
        data: payload,
        signal
    });
}

export function deleteSensitiveWord(id: number, signal?: AbortSignal) {
    return requestData<void>({
        url: `/api/admin/interaction/sensitive-words/${id}`,
        method: 'delete',
        signal
    });
}
