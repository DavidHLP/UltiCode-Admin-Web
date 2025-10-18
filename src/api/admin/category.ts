import { requestData } from '@/utils/request';

export interface CategoryView {
    id: number;
    code: string;
    name: string;
}

export interface CategoryQuery {
    keyword?: string;
}

export interface CategoryCreatePayload {
    code: string;
    name: string;
}

export interface CategoryUpdatePayload {
    code?: string;
    name?: string;
}

export function fetchCategories(params?: CategoryQuery, signal?: AbortSignal) {
    return requestData<CategoryView[]>({
        url: '/api/admin/categories',
        method: 'get',
        params,
        signal
    });
}

export function fetchCategory(categoryId: number) {
    return requestData<CategoryView>({
        url: `/api/admin/categories/${categoryId}`,
        method: 'get'
    });
}

export function createCategory(payload: CategoryCreatePayload) {
    return requestData<CategoryView>({
        url: '/api/admin/categories',
        method: 'post',
        data: payload
    });
}

export function updateCategory(categoryId: number, payload: CategoryUpdatePayload) {
    return requestData<CategoryView>({
        url: `/api/admin/categories/${categoryId}`,
        method: 'put',
        data: payload
    });
}

export function deleteCategory(categoryId: number) {
    return requestData<void>({
        url: `/api/admin/categories/${categoryId}`,
        method: 'delete'
    });
}
