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
    userId?: number;
    kind?: string;
    revoked?: boolean;
}

export function fetchAuthTokens(params?: AuthTokenQuery, signal?: AbortSignal) {
    return requestData<AuthTokenView[]>({
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
