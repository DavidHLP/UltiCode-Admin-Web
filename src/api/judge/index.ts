import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export interface NodeMetrics {
    queuedJobs: number;
    runningJobs: number;
    failedJobs: number;
    finishedLastHour: number;
}

export interface JudgeNodeView {
    id: number;
    name: string;
    status: string;
    runtimeInfo: Record<string, unknown>;
    lastHeartbeat?: string | null;
    createdAt?: string | null;
    metrics: NodeMetrics;
}

export interface NodeSummary {
    id: number;
    name: string;
    status: string;
}

export interface UserSummary {
    id: number;
    username: string;
    email?: string | null;
}

export interface ProblemSummary {
    id: number;
    slug: string;
}

export interface LanguageSummary {
    id: number;
    code: string;
    displayName: string;
}

export interface SubmissionSummary {
    id: number;
    verdict: string;
    score?: number | null;
    timeMs?: number | null;
    memoryKb?: number | null;
    codeBytes?: number | null;
    createdAt?: string | null;
    user?: UserSummary | null;
    problem?: ProblemSummary | null;
    language?: LanguageSummary | null;
}

export interface TestSummary {
    total: number;
    passed: number;
    failed: number;
}

export interface JudgeJobView {
    id: number;
    submissionId: number;
    status: string;
    priority: number;
    createdAt?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    node?: NodeSummary | null;
    submission?: SubmissionSummary | null;
    hasArtifacts: boolean;
    testSummary: TestSummary;
}

export interface SubmissionTestView {
    id: number;
    testcaseId: number;
    groupId: number;
    groupName?: string | null;
    sampleGroup: boolean;
    orderIndex?: number | null;
    verdict: string;
    timeMs?: number | null;
    memoryKb?: number | null;
    score?: number | null;
    message?: string | null;
}

export interface SubmissionArtifactView {
    id: number;
    submissionId: number;
    kind: string;
    fileId: number;
    storageKey?: string | null;
    sha256?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt?: string | null;
}

export interface JudgeJobDetailView {
    job: JudgeJobView;
    tests: SubmissionTestView[];
    artifacts: SubmissionArtifactView[];
}

export interface JudgeJobQuery {
    page?: number;
    size?: number;
    status?: string;
    nodeId?: number | null;
    onlyUnassigned?: boolean;
    submissionId?: number;
    keyword?: string;
}

export function fetchJudgeNodes(params?: { status?: string; keyword?: string }, signal?: AbortSignal) {
    return requestData<JudgeNodeView[]>({
        url: '/api/judge/nodes',
        method: 'get',
        params,
        signal
    });
}

export function fetchJudgeJobs(params: JudgeJobQuery, signal?: AbortSignal) {
    return requestData<PageResult<JudgeJobView>>({
        url: '/api/judge/jobs',
        method: 'get',
        params,
        signal
    });
}

export function fetchJudgeJobDetail(jobId: number) {
    return requestData<JudgeJobDetailView>({
        url: `/api/judge/jobs/${jobId}`,
        method: 'get'
    });
}

export function retryJudgeJob(jobId: number, sensitiveToken: string) {
    return requestData<void>({
        url: `/api/judge/jobs/${jobId}/retry`,
        method: 'post',
        sensitiveToken
    });
}
