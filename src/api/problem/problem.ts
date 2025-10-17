import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface ProblemTag {
    id: number;
    slug: string;
    name: string;
}

export interface ProblemSummary {
    id: number;
    slug: string;
    title?: string | null;
    problemType: string;
    difficultyId?: number | null;
    difficultyCode?: string | null;
    categoryId?: number | null;
    categoryName?: string | null;
    isPublic: boolean;
    timeLimitMs?: number | null;
    memoryLimitKb?: number | null;
    updatedAt?: string | null;
    tags: ProblemTag[];
    meta?: Record<string, unknown> | null;
}

export interface ProblemStatement {
    id?: number;
    langCode: string;
    title: string;
    descriptionMd: string;
    constraintsMd?: string | null;
    examplesMd?: string | null;
}

export interface ProblemLanguageConfig {
    id?: number;
    languageId: number;
    languageCode?: string | null;
    languageName?: string | null;
    functionName?: string | null;
    starterCode?: string | null;
}

export interface ProblemDetail {
    id: number;
    slug: string;
    problemType: string;
    difficultyId: number;
    difficultyCode?: string | null;
    categoryId?: number | null;
    categoryName?: string | null;
    creatorId?: number | null;
    solutionEntry?: string | null;
    timeLimitMs?: number | null;
    memoryLimitKb?: number | null;
    isPublic: boolean;
    meta?: Record<string, unknown> | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    statements: ProblemStatement[];
    languageConfigs: ProblemLanguageConfig[];
    tags: ProblemTag[];
}

export type ProblemListResponse = PageResult<ProblemSummary>;

export interface ProblemQuery {
    page?: number;
    size?: number;
    keyword?: string;
    problemType?: string;
    difficultyId?: number | null;
    categoryId?: number | null;
    isPublic?: boolean | null;
    langCode?: string;
}

export interface ProblemStatementInput {
    langCode: string;
    title: string;
    descriptionMd: string;
    constraintsMd?: string;
    examplesMd?: string;
}

export interface ProblemLanguageConfigInput {
    languageId: number;
    functionName?: string;
    starterCode?: string;
}

export interface ProblemUpsertPayload {
    slug: string;
    problemType: string;
    difficultyId: number;
    categoryId?: number | null;
    creatorId?: number | null;
    solutionEntry?: string | null;
    timeLimitMs?: number | null;
    memoryLimitKb?: number | null;
    isPublic?: boolean;
    meta?: Record<string, unknown>;
    statements: ProblemStatementInput[];
    tagIds?: number[];
    languageConfigs?: ProblemLanguageConfigInput[];
}

export interface DictionaryOption {
    id: number;
    code: string;
    name: string;
}

export interface TagOption {
    id: number;
    slug: string;
    name: string;
}

export interface LanguageOption {
    id: number;
    code: string;
    displayName: string;
    isActive?: boolean | null;
}

export interface ProblemOptions {
    difficulties: DictionaryOption[];
    categories: DictionaryOption[];
    tags: TagOption[];
    languages: LanguageOption[];
    problemTypes: string[];
}

export function fetchProblems(params: ProblemQuery, signal?: AbortSignal) {
    return requestData<ProblemListResponse>({
        url: '/api/admin/problems',
        method: 'get',
        params,
        signal
    });
}

export function fetchProblem(problemId: number, params?: { langCode?: string }) {
    return requestData<ProblemDetail>({
        url: `/api/admin/problems/${problemId}`,
        method: 'get',
        params
    });
}

export function createProblem(payload: ProblemUpsertPayload) {
    return requestData<ProblemDetail>({
        url: '/api/admin/problems',
        method: 'post',
        data: payload
    });
}

export function updateProblem(problemId: number, payload: ProblemUpsertPayload) {
    return requestData<ProblemDetail>({
        url: `/api/admin/problems/${problemId}`,
        method: 'put',
        data: payload
    });
}

export function fetchProblemOptions(signal?: AbortSignal) {
    return requestData<ProblemOptions>({
        url: '/api/admin/problems/options',
        method: 'get',
        signal
    });
}
