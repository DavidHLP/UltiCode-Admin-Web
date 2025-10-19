import { requestData } from '@/utils/request';
import type { Testcase, TestcaseInput } from './datasets';

export function fetchTestcase(groupId: number, testcaseId: number) {
    return requestData<Testcase>({
        url: `/api/admin/groups/${groupId}/testcases/${testcaseId}`,
        method: 'get'
    });
}

export function createTestcase(groupId: number, payload: TestcaseInput) {
    return requestData<Testcase>({
        url: `/api/admin/groups/${groupId}/testcases`,
        method: 'post',
        data: payload
    });
}

export function updateTestcase(groupId: number, testcaseId: number, payload: TestcaseInput) {
    return requestData<Testcase>({
        url: `/api/admin/groups/${groupId}/testcases/${testcaseId}`,
        method: 'put',
        data: payload
    });
}

export function deleteTestcase(groupId: number, testcaseId: number) {
    return requestData<void>({
        url: `/api/admin/groups/${groupId}/testcases/${testcaseId}`,
        method: 'delete'
    });
}
