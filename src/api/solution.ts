export interface SolutionManagementCardVo {
    id: number;
    problemId: number;
    userId: number;
    authorUsername: string;
    authorAvatar: string;
    title: string;
    language: string;
    status: SolutionStatus;
}

export enum SolutionStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED'
}

export interface SolutionQueryParams {
    page: number;
    size: number;
    problemId?: number;
    keyword?: string;
    userId?: number;
    status?: SolutionStatus;
}
