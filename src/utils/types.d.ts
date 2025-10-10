export interface Page<T> {
    /**
     * 查询数据列表
     */
    records: T[];

    /**
     * 总数
     */
    total: number;

    /**
     * 每页显示条数
     */
    size: number;

    /**
     * 当前页
     */
    current: number;

    /**
     * 排序字段信息
     */
    orders: OrderItem[];

    /**
     * 自动优化 COUNT SQL
     */
    optimizeCountSql: boolean;

    /**
     * 是否进行 count 查询
     */
    searchCount: boolean;

    /**
     * 优化 join 的 COUNT SQL
     */
    optimizeJoinOfCountSql: boolean;

    /**
     * 单次查询最大数量
     */
    maxLimit?: number;

    /**
     * countId
     */
    countId?: string; // String 在 Java 中可为 null，所以这里也设为可选
}

interface OrderItem {
    /**
     * 需要进行排序的字段
     */
    column: string;

    /**
     * 是否正序排列，true 为正序，false 为倒序
     */
    asc: boolean;
}
