import { requestData } from '@/utils/request';
import type { Page } from '@/utils/types';

// #region 类型定义 (与您提供的一致)
export interface TestCase {
    /**
     * 测试用例ID，主键，自动增长
     */
    id: number | null;

    /**
     * 关联的题目ID，外键
     */
    problemId: number | null;

    /**
     * 该测试用例的输出
     */
    testCaseOutput: TestCaseOutput | null;

    /**
     * 该测试用例的输入集合
     */
    testCaseInput: TestCaseInput[] | null;
}

export interface TestCaseOutput {
    /**
     * 测试用例ID，主键，自动增长
     */
    id: number | null;

    /**
     * 关联的题目ID，外键，关联到problems表
     */
    problemId: number | null;

    /**
     * 期望的输出 (对应数据库中的output字段，类型为text)
     */
    output: string | null;

    /**
     * 输出类型 (varchar(50)，可为空)
     */
    outputType: string | null;

    /**
     * 该测试点的分值，默认为10
     */
    score: number | null;

    /**
     * 是否为样例测试用例，默认为FALSE (tinyint(1))
     */
    isSample: boolean | null;
}

export interface TestCaseInput {
    /**
     * 输入记录的ID，主键
     */
    id: number | null;

    /**
     * 关联的测试用例ID，外键
     */
    testCaseOutputId: number | null;

    /**
     * 输入内容名称
     */
    testCaseName: string | null;

    /**
     * 输入类型
     */
    inputType: string | null;

    /**
     * 单个输入的内容
     */
    inputContent: string | null;

    /**
     * 输入的顺序，从0开始，用于保证多次输入的先后次序
     */
    orderIndex: number | null;
}

export interface QueryTestCasePayload {
    problemId: number;
    pageNum: number;
    pageSize: number;
}
// #endregion

const API_BASE_URL = '/problems/api/management/testcase';

/**
 * [分页] 根据题目ID获取测试用例
 * @param params 包含 problemId, pageNum, pageSize
 * @returns 分页的测试用例数据
 * @see GET /page/{problemId}
 */
export const fetchSolutionsTestCasesByPage = async (params: QueryTestCasePayload): Promise<Page<TestCase>> => {
    const { problemId, ...queryParams } = params;
    return requestData<Page<TestCase>>({
        url: `${API_BASE_URL}/page/${problemId}`,
        method: 'GET',
        params: queryParams
    });
};

/**
 * [不分页] 根据题目ID获取所有测试用例
 * @param problemId 题目ID
 * @returns 测试用例数组
 * @see GET /{problemId}
 */
export const fetchAllSolutionsTestCases = async (problemId: number): Promise<TestCase[]> => {
    return requestData<TestCase[]>({
        url: `${API_BASE_URL}/${problemId}`,
        method: 'GET'
    });
};

/**
 * 创建单个测试用例
 * @param data TestCase 对象
 * @returns 创建成功后的 TestCase 对象
 * @see POST /
 */
export const createSolutionsTestCase = async (data: TestCase): Promise<TestCase> => {
    return requestData<TestCase>({
        url: API_BASE_URL,
        method: 'POST',
        data
    });
};

/**
 * 更新单个测试用例
 * @param data TestCase 对象 (必须包含 id)
 * @returns 更新成功后的 TestCase 对象
 * @see PUT /
 */
export const updateSolutionsTestCase = async (data: TestCase): Promise<TestCase> => {
    return requestData<TestCase>({
        url: API_BASE_URL,
        method: 'PUT',
        data
    });
};

/**
 * 删除单个测试用例
 * @param id 要删除的测试用例的 ID
 * @returns Promise<void>
 * @see DELETE /{id}
 */
export const deleteSolutionsTestCase = async (id: number): Promise<void> => {
    return requestData<void>({
        // 将 ID 作为路径参数拼接到 URL 中
        url: `${API_BASE_URL}/${id}`,
        method: 'DELETE'
    });
};

/**
 * @deprecated 注意：您提供的 Java 代码中没有处理批量创建/更新的接口。
 * 此函数会向 POST / 发送一个 TestCase 数组，当前后端无法处理。
 */
export const upsertSolutionsTestCases = async (data: TestCase[]): Promise<void> => {
    return requestData<void>({
        url: API_BASE_URL,
        method: 'POST',
        data
    });
};
