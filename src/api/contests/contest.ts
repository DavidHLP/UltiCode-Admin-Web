import type { PageResult } from '@/api/types';
import { requestData } from '@/utils/request';

export type ContestStatus = 'UPCOMING' | 'RUNNING' | 'ENDED';

export interface ContestSummary {
    id: number;
    title: string;
    kind: string;
    visible: boolean;
    status: ContestStatus;
    startTime?: string | null;
    endTime?: string | null;
    problemCount?: number | null;
    participantCount?: number | null;
    lastSubmissionAt?: string | null;
    updatedAt?: string | null;
}

export interface ContestProblem {
    contestId: number;
    problemId: number;
    problemSlug?: string | null;
    problemTitle?: string | null;
    alias?: string | null;
    points?: number | null;
    orderNo?: number | null;
    lastSubmissionAt?: string | null;
    submissionCount?: number | null;
    solvedCount?: number | null;
    acceptanceRate?: string | number | null;
}

export interface ContestParticipant {
    contestId: number;
    userId: number;
    username?: string | null;
    displayName?: string | null;
    registeredAt?: string | null;
}

export interface ContestDetail extends ContestSummary {
    descriptionMd?: string | null;
    createdBy?: number | null;
    createdAt?: string | null;
    problems: ContestProblem[];
    participants: ContestParticipant[];
}

export interface ContestQuery {
    page?: number;
    size?: number;
    keyword?: string;
    kind?: string;
    status?: ContestStatus;
    visible?: boolean | null;
    startFrom?: string;
    endTo?: string;
}

export interface ContestUpsertPayload {
    title: string;
    descriptionMd?: string | null;
    kind: string;
    startTime: string;
    endTime: string;
    visible?: boolean;
}

export interface ContestProblemInput {
    problemId: number;
    alias?: string | null;
    points?: number | null;
    orderNo?: number | null;
}

export interface ContestProblemsPayload {
    problems: ContestProblemInput[];
}

export interface ContestParticipantsPayload {
    userIds: number[];
}

export interface ContestKindOption {
    code: string;
    displayName: string;
}

export interface ContestOptions {
    kinds: ContestKindOption[];
    statuses: ContestStatus[];
}

export interface ContestScoreboardProblem {
    problemId: number;
    alias?: string | null;
    title?: string | null;
    orderNo?: number | null;
    points?: number | null;
    submissionCount?: number | null;
    solvedCount?: number | null;
    acceptanceRate?: string | number | null;
    lastSubmissionAt?: string | null;
}

export interface ContestScoreboardRecord {
    problemId: number;
    alias?: string | null;
    attempts?: number | null;
    wrongAttempts?: number | null;
    bestScore?: number | null;
    contestPoints?: number | null;
    lastVerdict?: string | null;
    firstAcceptedAt?: string | null;
    lastSubmissionAt?: string | null;
    globalBestScore?: number | null;
}

export interface ContestScoreboardParticipant {
    userId: number;
    username?: string | null;
    displayName?: string | null;
    rank: number;
    solvedCount?: number | null;
    totalScore?: number | null;
    penalty?: number | null;
    lastAcceptedAt?: string | null;
    lastSubmissionAt?: string | null;
    records: ContestScoreboardRecord[];
}

export interface ContestScoreboard {
    contestId: number;
    kind: string;
    generatedAt: string;
    problems: ContestScoreboardProblem[];
    participants: ContestScoreboardParticipant[];
}

export interface ContestSubmission {
    id: number;
    userId: number;
    username?: string | null;
    problemId: number;
    alias?: string | null;
    verdict: string;
    score?: number | null;
    timeMs?: number | null;
    memoryKb?: number | null;
    submittedAt: string;
}

export type ContestListResponse = PageResult<ContestSummary>;
export type ContestSubmissionListResponse = PageResult<ContestSubmission>;

export function fetchContests(params: ContestQuery) {
    return requestData<ContestListResponse>({
        url: '/api/admin/contests',
        method: 'get',
        params
    });
}

export function fetchContest(contestId: number) {
    return requestData<ContestDetail>({
        url: `/api/admin/contests/${contestId}`,
        method: 'get'
    });
}

export function createContest(payload: ContestUpsertPayload) {
    return requestData<ContestDetail>({
        url: '/api/admin/contests',
        method: 'post',
        data: payload
    });
}

export function updateContest(contestId: number, payload: ContestUpsertPayload) {
    return requestData<ContestDetail>({
        url: `/api/admin/contests/${contestId}`,
        method: 'put',
        data: payload
    });
}

export function deleteContest(contestId: number) {
    return requestData<void>({
        url: `/api/admin/contests/${contestId}`,
        method: 'delete'
    });
}

export function saveContestProblems(contestId: number, payload: ContestProblemsPayload) {
    return requestData<ContestProblem[]>({
        url: `/api/admin/contests/${contestId}/problems`,
        method: 'put',
        data: payload
    });
}

export function removeContestProblem(contestId: number, problemId: number) {
    return requestData<void>({
        url: `/api/admin/contests/${contestId}/problems/${problemId}`,
        method: 'delete'
    });
}

export function addContestParticipants(contestId: number, payload: ContestParticipantsPayload) {
    return requestData<ContestParticipant[]>({
        url: `/api/admin/contests/${contestId}/participants`,
        method: 'post',
        data: payload
    });
}

export function removeContestParticipant(contestId: number, userId: number) {
    return requestData<void>({
        url: `/api/admin/contests/${contestId}/participants/${userId}`,
        method: 'delete'
    });
}

export function fetchContestOptions() {
    return requestData<ContestOptions>({
        url: '/api/admin/contests/options',
        method: 'get'
    });
}

export function fetchContestScoreboard(contestId: number) {
    return requestData<ContestScoreboard>({
        url: `/api/admin/contests/${contestId}/scoreboard`,
        method: 'get'
    });
}

export interface ContestSubmissionQuery {
    page?: number;
    size?: number;
    verdict?: string;
    userId?: number;
    problemId?: number;
}

export function fetchContestSubmissions(contestId: number, params: ContestSubmissionQuery) {
    return requestData<ContestSubmissionListResponse>({
        url: `/api/admin/contests/${contestId}/submissions`,
        method: 'get',
        params
    });
}
