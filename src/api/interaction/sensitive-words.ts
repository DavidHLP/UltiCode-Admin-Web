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

export function fetchSensitiveWords(params: SensitiveWordQuery) {
    return requestData<SensitiveWordPage>({
        url: '/api/admin/interaction/sensitive-words',
        method: 'get',
        params
    });
}

export function createSensitiveWord(payload: SensitiveWordUpsertPayload) {
    return requestData<SensitiveWordView>({
        url: '/api/admin/interaction/sensitive-words',
        method: 'post',
        data: payload
    });
}

export function updateSensitiveWord(id: number, payload: SensitiveWordUpsertPayload) {
    return requestData<SensitiveWordView>({
        url: `/api/admin/interaction/sensitive-words/${id}`,
        method: 'put',
        data: payload
    });
}

export function deleteSensitiveWord(id: number) {
    return requestData<void>({
        url: `/api/admin/interaction/sensitive-words/${id}`,
        method: 'delete'
    });
}
