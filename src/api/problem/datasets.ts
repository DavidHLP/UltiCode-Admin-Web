import { requestData } from '@/utils/request';

export interface Testcase {
    id: number;
    groupId: number;
    orderIndex: number;
    inputFileId?: number | null;
    outputFileId?: number | null;
    inputJson?: string | null;
    outputJson?: string | null;
    outputType?: string | null;
    score: number;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface TestcaseInput {
    orderIndex: number;
    inputFileId?: number | null;
    outputFileId?: number | null;
    inputJson?: string | null;
    outputJson?: string | null;
    outputType?: string | null;
    score: number;
}

export interface TestcaseGroup {
    id: number;
    datasetId: number;
    name: string;
    isSample: boolean;
    weight: number;
    createdAt?: string | null;
    updatedAt?: string | null;
    testcases: Testcase[];
}

export interface TestcaseGroupInput {
    name: string;
    isSample: boolean;
    weight: number;
}

export interface DatasetDetail {
    id: number;
    problemId: number;
    name: string;
    isActive: boolean;
    checkerType: string;
    checkerFileId?: number | null;
    floatAbsTol?: number | null;
    floatRelTol?: number | null;
    createdBy?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    groups: TestcaseGroup[];
}

export interface DatasetInput {
    name: string;
    isActive: boolean;
    checkerType: string;
    checkerFileId?: number | null;
    floatAbsTol?: number | null;
    floatRelTol?: number | null;
}

export function fetchDatasets(problemId: number) {
    return requestData<DatasetDetail[]>({
        url: `/api/admin/problems/${problemId}/datasets`,
        method: 'get'
    });
}

export function fetchDataset(problemId: number, datasetId: number) {
    return requestData<DatasetDetail>({
        url: `/api/admin/problems/${problemId}/datasets/${datasetId}`,
        method: 'get'
    });
}

export function createDataset(problemId: number, payload: DatasetInput) {
    return requestData<DatasetDetail>({
        url: `/api/admin/problems/${problemId}/datasets`,
        method: 'post',
        data: payload
    });
}

export function updateDataset(problemId: number, datasetId: number, payload: DatasetInput) {
    return requestData<DatasetDetail>({
        url: `/api/admin/problems/${problemId}/datasets/${datasetId}`,
        method: 'put',
        data: payload
    });
}

export function deleteDataset(problemId: number, datasetId: number) {
    return requestData<void>({
        url: `/api/admin/problems/${problemId}/datasets/${datasetId}`,
        method: 'delete'
    });
}
