import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface AuthTokenView {
    id: number;
    userId: number;
    kind: string;
    revoked: boolean;
    createdAt?: string | null;
    expiresAt?: string | null;
}

export interface AuthTokenQuery {
    page?: number;
    size?: number;
    keyword?: string;
    userId?: number;
    kind?: string;
    revoked?: boolean;
    createdAtStart?: string;
    createdAtEnd?: string;
    expiresAtStart?: string;
    expiresAtEnd?: string;
}

export type AuthTokenPage = PageResult<AuthTokenView>;

export function fetchAuthTokens(params?: AuthTokenQuery, signal?: AbortSignal) {
    return requestData<AuthTokenPage>({
        url: '/api/admin/auth-tokens',
        method: 'get',
        params,
        signal
    });
}

export function revokeAuthToken(tokenId: number) {
    return requestData<void>({
        url: `/api/admin/auth-tokens/${tokenId}`,
        method: 'delete'
    });
}
