import { requestPublicData } from '@/utils/request';

export interface DashboardSummaryCard {
    key: string;
    title: string;
    value: number;
    highlightText: string;
    helperText: string;
    icon: string;
    accent: string;
}

export interface DashboardSummaryResponse {
    cards: DashboardSummaryCard[];
}

export interface RecentSubmission {
    id: number;
    problemSlug: string;
    problemTitle: string;
    difficulty: string | null;
    language: string;
    verdict: string;
    score: number | null;
    username: string;
    submittedAt: string;
}

export interface TrendingProblem {
    id: number;
    slug: string;
    title: string;
    difficulty: string | null;
    submissionCount: number;
    solvedCount: number;
    acceptanceRate: number | null;
    accent: string;
}

export interface DashboardTrendPoint {
    label: string;
    acceptedCount: number;
    wrongCount: number;
    pendingCount: number;
}

export interface DashboardActivity {
    message: string;
    icon: string;
    accent: string;
    occurredAt: string;
}

export interface DashboardActivityGroup {
    label: string;
    items: DashboardActivity[];
}

export const DashboardService = {
    getSummary(): Promise<DashboardSummaryResponse> {
        return requestPublicData<DashboardSummaryResponse>({
            url: '/api/admin/dashboard/summary',
            method: 'get'
        });
    },
    getRecentSubmissions(limit = 6): Promise<RecentSubmission[]> {
        return requestPublicData<RecentSubmission[]>({
            url: '/api/admin/dashboard/recent-submissions',
            method: 'get',
            params: { limit }
        });
    },
    getTrendingProblems(limit = 6): Promise<TrendingProblem[]> {
        return requestPublicData<TrendingProblem[]>({
            url: '/api/admin/dashboard/trending-problems',
            method: 'get',
            params: { limit }
        });
    },
    getSubmissionTrends(): Promise<DashboardTrendPoint[]> {
        return requestPublicData<DashboardTrendPoint[]>({
            url: '/api/admin/dashboard/submission-trends',
            method: 'get'
        });
    },
    getActivities(size = 9): Promise<DashboardActivityGroup[]> {
        return requestPublicData<DashboardActivityGroup[]>({
            url: '/api/admin/dashboard/activities',
            method: 'get',
            params: { size }
        });
    }
};
