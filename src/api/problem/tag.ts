import type { PageResult } from '@/api/types.ts';
import { requestData } from '@/utils/request.ts';

export interface TagView {
    id: number;
    slug: string;
    name: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface TagQuery {
    keyword?: string;
    page?: number;
    size?: number;
}

export interface TagCreatePayload {
    slug: string;
    name: string;
}

export interface TagUpdatePayload {
    slug?: string;
    name?: string;
}

export type TagListResponse = PageResult<TagView>;

export function fetchTags(params?: TagQuery, signal?: AbortSignal) {
    return requestData<TagListResponse>({
        url: '/api/admin/tags',
        method: 'get',
        params,
        signal
    });
}

export function fetchTag(tagId: number) {
    return requestData<TagView>({
        url: `/api/admin/tags/${tagId}`,
        method: 'get'
    });
}

export function createTag(payload: TagCreatePayload) {
    return requestData<TagView>({
        url: '/api/admin/tags',
        method: 'post',
        data: payload
    });
}

export function updateTag(tagId: number, payload: TagUpdatePayload) {
    return requestData<TagView>({
        url: `/api/admin/tags/${tagId}`,
        method: 'put',
        data: payload
    });
}

export function deleteTag(tagId: number) {
    return requestData<void>({
        url: `/api/admin/tags/${tagId}`,
        method: 'delete'
    });
}
