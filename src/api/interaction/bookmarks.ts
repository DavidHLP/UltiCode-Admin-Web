import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface BookmarkView {
    userId: number;
    entityType: string;
    entityId: number;
    visibility: string;
    note?: string | null;
    tags: string[];
    source: string;
    createdAt: string;
    updatedAt: string;
    sensitiveFlag?: boolean | null;
    sensitiveHits: string[];
    riskLevel?: string | null;
}

export interface BookmarkQuery {
    page?: number;
    size?: number;
    userId?: number;
    entityType?: string;
    entityId?: number;
    visibility?: string;
    source?: string;
    keyword?: string;
}

export interface BookmarkDeletePayload {
    userId: number;
    entityType: string;
    entityId: number;
}

export type BookmarkPage = PageResult<BookmarkView>;

export function fetchBookmarks(params: BookmarkQuery, signal?: AbortSignal) {
    return requestData<BookmarkPage>({
        url: '/api/admin/interaction/bookmarks',
        method: 'get',
        params,
        signal
    });
}

export function deleteBookmark(payload: BookmarkDeletePayload, signal?: AbortSignal) {
    return requestData<void>({
        url: '/api/admin/interaction/bookmarks',
        method: 'delete',
        data: payload,
        signal
    });
}
