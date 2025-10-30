import {requestPublicData} from '@/utils/request';

export interface DifficultyInfo {
    id?: number | null;
    code?: string | null;
    label?: string | null;
}

export interface TagInfo {
    id?: number | null;
    name: string;
    slug?: string | null;
}

export interface ProblemStats {
    timeLimitMs?: number | null;
    memoryLimitKb?: number | null;
}

export interface ProblemMetadata {
    companies: string[];
    frequency?: number | null;
    paidOnly?: boolean | null;
    frontendId?: number | null;
    leetcodeStyle?: boolean | null;
}

export interface ProblemCard {
    id: number;
    slug: string;
    title: string;
    difficulty?: DifficultyInfo | null;
    tags: TagInfo[];
    stats?: ProblemStats | null;
    metadata: ProblemMetadata;
    updatedAt?: string | null;
}

export interface ProblemListResponse {
    total: number;
    page: number;
    size: number;
    hasMore: boolean;
    items: ProblemCard[];
}

export interface FetchProblemParams {
    page?: number;
    size?: number;
    lang?: string;
}

export function fetchPublicProblems(params?: FetchProblemParams) {
    return requestPublicData<ProblemListResponse>({
        url: '/api/public/problems',
        method: 'GET',
        params
    });
}
