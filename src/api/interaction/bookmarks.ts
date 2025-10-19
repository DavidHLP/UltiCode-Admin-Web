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
}

export interface BookmarkQuery {
    page?: number;
    size?: number;
    userId?: number;
    entityType?: string;
    entityId?: number;
    visibility?: string;
    source?: string;
}

export interface BookmarkDeletePayload {
    userId: number;
    entityType: string;
    entityId: number;
}

export type BookmarkPage = PageResult<BookmarkView>;

export function fetchBookmarks(params: BookmarkQuery) {
    return requestData<BookmarkPage>({
        url: '/api/admin/interaction/bookmarks',
        method: 'get',
        params
    });
}

export function deleteBookmark(payload: BookmarkDeletePayload) {
    return requestData<void>({
        url: '/api/admin/interaction/bookmarks',
        method: 'delete',
        data: payload
    });
}
