import { requestData } from '@/utils/request';

export interface LanguageView {
    id: number;
    code: string;
    displayName: string;
    runtimeImage?: string | null;
    isActive: boolean;
}

export interface LanguageQuery {
    keyword?: string;
    isActive?: boolean;
}

export interface LanguageCreatePayload {
    code: string;
    displayName: string;
    runtimeImage?: string;
    isActive?: boolean;
}

export interface LanguageUpdatePayload {
    code?: string;
    displayName?: string;
    runtimeImage?: string | null;
    isActive?: boolean;
}

export function fetchLanguages(params?: LanguageQuery, signal?: AbortSignal) {
    return requestData<LanguageView[]>({
        url: '/api/admin/languages',
        method: 'get',
        params,
        signal
    });
}

export function fetchLanguage(languageId: number) {
    return requestData<LanguageView>({
        url: `/api/admin/languages/${languageId}`,
        method: 'get'
    });
}

export function createLanguage(payload: LanguageCreatePayload) {
    return requestData<LanguageView>({
        url: '/api/admin/languages',
        method: 'post',
        data: payload
    });
}

export function updateLanguage(languageId: number, payload: LanguageUpdatePayload) {
    return requestData<LanguageView>({
        url: `/api/admin/languages/${languageId}`,
        method: 'put',
        data: payload
    });
}

export function deleteLanguage(languageId: number) {
    return requestData<void>({
        url: `/api/admin/languages/${languageId}`,
        method: 'delete'
    });
}
