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
    registrationMode?: string | null;
    registrationStartTime?: string | null;
    registrationEndTime?: string | null;
    maxParticipants?: number | null;
    penaltyPerWrong?: number | null;
    scoreboardFreezeMinutes?: number | null;
    hideScoreDuringFreeze?: boolean | null;
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
    pendingRegistrationCount?: number | null;
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
    registrationMode?: string;
    registrationStartTime?: string | null;
    registrationEndTime?: string | null;
    maxParticipants?: number | null;
    penaltyPerWrong?: number | null;
    scoreboardFreezeMinutes?: number | null;
    hideScoreDuringFreeze?: boolean;
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

export type ContestRegistrationStatusCode = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ContestRegistration {
    id: number;
    contestId: number;
    userId: number;
    username?: string | null;
    displayName?: string | null;
    status: ContestRegistrationStatusCode;
    source?: string | null;
    note?: string | null;
    reviewedBy?: number | null;
    reviewerName?: string | null;
    reviewedAt?: string | null;
    createdAt?: string | null;
}

export interface ContestRegistrationQuery {
    page?: number;
    size?: number;
    status?: ContestRegistrationStatusCode;
}

export interface ContestRegistrationCreatePayload {
    userId: number;
    source?: 'self' | 'invite' | 'admin';
    note?: string | null;
}

export interface ContestRegistrationDecisionPayload {
    registrationIds: number[];
    targetStatus?: ContestRegistrationStatusCode;
    note?: string | null;
}

export interface ProblemSummaryOption {
    id: number;
    slug?: string | null;
    title?: string | null;
    difficulty?: string | null;
}

export interface UserSummaryOption {
    id: number;
    username: string;
    displayName?: string | null;
    email?: string | null;
}

export interface ContestKindOption {
    code: string;
    displayName: string;
}

export interface ContestOptions {
    kinds: ContestKindOption[];
    statuses: ContestStatus[];
    registrationModes: string[];
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
    pendingAttempts?: number | null;
    pendingBestScore?: number | null;
    pendingLastVerdict?: string | null;
    pendingLastSubmissionAt?: string | null;
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
    pendingCount?: number | null;
    records: ContestScoreboardRecord[];
}

export interface ContestScoreboard {
    contestId: number;
    kind: string;
    generatedAt: string;
    penaltyPerWrong: number;
    freezeActive: boolean;
    freezeHideScore: boolean;
    freezeStartTime?: string | null;
    freezeMinutes?: number | null;
    pendingSubmissionCount?: number | null;
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
export type ContestRegistrationListResponse = PageResult<ContestRegistration>;

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

export function fetchContestRegistrations(contestId: number, params: ContestRegistrationQuery) {
    return requestData<ContestRegistrationListResponse>({
        url: `/api/admin/contests/${contestId}/registrations`,
        method: 'get',
        params
    });
}

export function createContestRegistration(
    contestId: number,
    payload: ContestRegistrationCreatePayload
) {
    return requestData<ContestRegistration>({
        url: `/api/admin/contests/${contestId}/registrations`,
        method: 'post',
        data: payload
    });
}

export function decideContestRegistrations(
    contestId: number,
    payload: ContestRegistrationDecisionPayload
) {
    return requestData<ContestRegistration[]>({
        url: `/api/admin/contests/${contestId}/registrations/decision`,
        method: 'post',
        data: payload
    });
}

export function searchContestProblems(keyword: string, limit = 10) {
    return requestData<ProblemSummaryOption[]>({
        url: '/api/admin/contests/problem-search',
        method: 'get',
        params: { keyword, limit }
    });
}

export function searchContestUsers(keyword: string, limit = 10) {
    return requestData<UserSummaryOption[]>({
        url: '/api/admin/contests/user-search',
        method: 'get',
        params: { keyword, limit }
    });
}
