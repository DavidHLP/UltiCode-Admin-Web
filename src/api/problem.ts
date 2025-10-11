import { requestData } from '@/utils/request';
import { type Page } from '@/utils/types';

export interface Problem {
    id?: number;
    problemType: ProblemType;
    solutionFunctionName: string;
    title: string;
    description: string;
    difficulty: ProblemDifficulty;
    category: CategoryType;
    tags?: string[];
    solvedCount?: number;
    submissionCount?: number;
    createdBy?: number;
    isVisible?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export enum ProblemType {
    ACM = 'ACM',
    OI = 'OI'
}

export enum ProblemDifficulty {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD'
}

export enum CategoryType {
    ALGORITHMS = 'ALGORITHMS',
    DATABASE = 'DATABASE',
    SHELL = 'SHELL',
    MULTI_THREADING = 'MULTI_THREADING',
    JAVASCRIPT = 'JAVASCRIPT',
    PANDAS = 'PANDAS'
}

export const CategoryTypeLabel: Record<CategoryType, string> = {
    [CategoryType.ALGORITHMS]: '算法',
    [CategoryType.DATABASE]: '数据库',
    [CategoryType.SHELL]: 'Shell',
    [CategoryType.MULTI_THREADING]: '多线程',
    [CategoryType.JAVASCRIPT]: 'JavaScript',
    [CategoryType.PANDAS]: 'Pandas'
};

export interface QueryProblemPayload {
    page?: number;
    pageSize?: number;
    size?: number;
    keyword?: string;
    difficulty?: ProblemDifficulty;
    category?: CategoryType;
    isVisible?: boolean;
    sort?: string;
}

export interface UpsertProblemPayload {
    problemType: ProblemType;
    solutionFunctionName: string;
    title: string;
    description: string;
    difficulty: ProblemDifficulty;
    category: CategoryType;
    tags?: string[] | null;
    isVisible?: boolean;
}

export const fetchProblem = async (payload: QueryProblemPayload = {}): Promise<Page<Problem>> => {
    return requestData<Page<Problem>>({
        url: '/problems/api/management/problem/page',
        method: 'get',
        params: payload
    });
};

export const createProblem = async (payload: UpsertProblemPayload): Promise<Problem> => {
    return requestData<Problem>({
        url: '/problems/api/management/problem',
        method: 'post',
        data: payload
    });
};

export const updateProblem = async (problemId: number | string, payload: UpsertProblemPayload): Promise<Problem> => {
    return requestData<Problem>({
        url: `/problems/api/management/problem/${problemId}`,
        method: 'put',
        data: payload
    });
};

export const deleteProblem = async (problemId: number): Promise<void> => {
    return requestData<void>({
        url: `/problems/api/management/problem/${problemId}`,
        method: 'delete'
    });
};
