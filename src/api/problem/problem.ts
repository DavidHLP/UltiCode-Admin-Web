import { requestData } from '@/utils/request';

export interface PageReq {
    current?: number;
    size?: number;
    [key: string]: any;
}

export interface PageResp<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
}

export interface Problem {
    id?: number;
    slug: string;
    problemType?: string;
    difficultyId?: number;
    categoryId?: number;
    solutionEntry?: string;
    timeLimitMs?: number;
    memoryLimitKb?: number;
    createdBy?: number;
    isVisible?: boolean;
    metaJson?: Record<string, any>;
}

export interface ProblemLocale {
    id?: number;
    problemId: number;
    langCode: string;
    title: string;
    descriptionMd?: string;
    constraintsMd?: string;
    examplesMd?: string;
}

export interface ProblemLanguageConfig {
    id?: number;
    problemId: number;
    language: string;
    functionName?: string;
    starterCode?: string;
}

export interface ProblemStat {
    problemId: number;
    solvedCount?: number;
    submissionCount?: number;
    likesCount?: number;
    dislikesCount?: number;
    acceptanceRate?: number;
    updatedAt?: string;
}

export interface Tag {
    id: number;
    slug: string;
    name: string;
}
export interface Category {
    id: number;
    code: string;
    name: string;
}
export interface Difficulty {
    id: number;
    code: string;
    sortKey: number;
}

export interface TestcaseGroup {
    id?: number;
    problemId: number;
    name: string;
    isSample?: boolean;
    weight?: number;
}
export interface Testcase {
    id?: number;
    groupId: number;
    orderIndex?: number;
    inputJson?: any;
    outputJson?: any;
    outputType?: string;
    score?: number;
}
export interface TestcaseStep {
    id?: number;
    testcaseId: number;
    stepIndex?: number;
    inputContent?: string;
    expectedOutput?: string;
}

export interface AdminProblemDetailDto {
    problem: Problem;
    locales: ProblemLocale[];
    languageConfigs: ProblemLanguageConfig[];
    stat?: ProblemStat;
    allTags: Tag[];
    selectedTagIds: number[];
    groups: { group: TestcaseGroup; testcases: { testcase: Testcase; steps: TestcaseStep[] }[] }[];
}

// Problem CRUD
export function listProblems(params: PageReq) {
    return requestData<PageResp<Problem>>({ url: '/api/problems', method: 'get', params });
}

export function getProblem(id: number) {
    return requestData<Problem>({ url: `/api/problems/${id}`, method: 'get' });
}

export function createProblem(data: Problem) {
    return requestData<boolean>({ url: '/api/problems', method: 'post', data });
}

export function updateProblem(id: number, data: Problem) {
    return requestData<boolean>({ url: `/api/problems/${id}`, method: 'put', data });
}

export function deleteProblem(id: number) {
    return requestData<boolean>({ url: `/api/problems/${id}`, method: 'delete' });
}

export function getAdminProblemDetail(id: number) {
    return requestData<AdminProblemDetailDto>({ url: `/api/problems/${id}/admin-detail`, method: 'get' });
}

// Tags
export function getProblemTags(id: number) {
    return requestData<number[]>({ url: `/api/problems/${id}/tags`, method: 'get' });
}

export function updateProblemTags(id: number, tagIds: number[]) {
    return requestData<boolean>({ url: `/api/problems/${id}/tags`, method: 'put', data: tagIds });
}

export function listAllTags() {
    return requestData<Tag[]>({ url: '/api/tags/list', method: 'get' });
}

// Locales
export function listLocalesByProblem(problemId: number) {
    return requestData<ProblemLocale[]>({ url: `/api/problems/${problemId}/locales`, method: 'get' });
}

export function createLocale(data: ProblemLocale) {
    return requestData<boolean>({ url: '/api/problem-locales', method: 'post', data });
}

export function updateLocale(id: number, data: ProblemLocale) {
    return requestData<boolean>({ url: `/api/problem-locales/${id}`, method: 'put', data });
}

export function deleteLocale(id: number) {
    return requestData<boolean>({ url: `/api/problem-locales/${id}`, method: 'delete' });
}

// Language configs
export function listLangConfigsByProblem(problemId: number) {
    return requestData<ProblemLanguageConfig[]>({ url: `/api/problems/${problemId}/language-configs`, method: 'get' });
}

export function createLangConfig(data: ProblemLanguageConfig) {
    return requestData<boolean>({ url: '/api/problem-language-configs', method: 'post', data });
}

export function updateLangConfig(id: number, data: ProblemLanguageConfig) {
    return requestData<boolean>({ url: `/api/problem-language-configs/${id}`, method: 'put', data });
}

export function deleteLangConfig(id: number) {
    return requestData<boolean>({ url: `/api/problem-language-configs/${id}`, method: 'delete' });
}

// Testcase groups
export function listGroupsByProblem(problemId: number) {
    return requestData<TestcaseGroup[]>({ url: `/api/problems/${problemId}/testcase-groups`, method: 'get' });
}

export function createGroup(data: TestcaseGroup) {
    return requestData<boolean>({ url: '/api/testcase-groups', method: 'post', data });
}

export function updateGroup(id: number, data: TestcaseGroup) {
    return requestData<boolean>({ url: `/api/testcase-groups/${id}`, method: 'put', data });
}

export function deleteGroup(id: number) {
    return requestData<boolean>({ url: `/api/testcase-groups/${id}`, method: 'delete' });
}

// Testcases
export function createTestcase(data: Testcase) {
    return requestData<boolean>({ url: '/api/testcases', method: 'post', data });
}

export function updateTestcase(id: number, data: Testcase) {
    return requestData<boolean>({ url: `/api/testcases/${id}`, method: 'put', data });
}

export function deleteTestcase(id: number) {
    return requestData<boolean>({ url: `/api/testcases/${id}`, method: 'delete' });
}

// Steps
export function createStep(data: TestcaseStep) {
    return requestData<boolean>({ url: '/api/testcase-steps', method: 'post', data });
}

export function updateStep(id: number, data: TestcaseStep) {
    return requestData<boolean>({ url: `/api/testcase-steps/${id}`, method: 'put', data });
}

export function deleteStep(id: number) {
    return requestData<boolean>({ url: `/api/testcase-steps/${id}`, method: 'delete' });
}

// Dictionaries
export function pageDifficulties(params: PageReq = { current: 1, size: 100 }) {
    return requestData<PageResp<Difficulty>>({ url: '/api/difficulties', method: 'get', params });
}

export function pageCategories(params: PageReq = { current: 1, size: 100 }) {
    return requestData<PageResp<Category>>({ url: '/api/categories', method: 'get', params });
}
