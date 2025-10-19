import { requestData } from '@/utils/request';
import type { Testcase, TestcaseGroup, TestcaseGroupInput } from './datasets';

export function fetchTestcaseGroups(datasetId: number, withTestcases = true) {
    return requestData<TestcaseGroup[]>({
        url: `/api/admin/datasets/${datasetId}/groups`,
        method: 'get',
        params: { withTestcases }
    });
}

export function fetchTestcaseGroup(datasetId: number, groupId: number, withTestcases = true) {
    return requestData<TestcaseGroup>({
        url: `/api/admin/datasets/${datasetId}/groups/${groupId}`,
        method: 'get',
        params: { withTestcases }
    });
}

export function createTestcaseGroup(datasetId: number, payload: TestcaseGroupInput) {
    return requestData<TestcaseGroup>({
        url: `/api/admin/datasets/${datasetId}/groups`,
        method: 'post',
        data: payload
    });
}

export function updateTestcaseGroup(
    datasetId: number,
    groupId: number,
    payload: TestcaseGroupInput
) {
    return requestData<TestcaseGroup>({
        url: `/api/admin/datasets/${datasetId}/groups/${groupId}`,
        method: 'put',
        data: payload
    });
}

export function deleteTestcaseGroup(datasetId: number, groupId: number) {
    return requestData<void>({
        url: `/api/admin/datasets/${datasetId}/groups/${groupId}`,
        method: 'delete'
    });
}

export function fetchGroupTestcases(groupId: number) {
    return requestData<Testcase[]>({
        url: `/api/admin/groups/${groupId}/testcases`,
        method: 'get'
    });
}
