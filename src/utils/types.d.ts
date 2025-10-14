export interface Page<T> {
    records: T[];
    total: number;
    size: number;
    current: number;
    orders: OrderItem[];
    optimizeCountSql: boolean;
    searchCount: boolean;
    optimizeJoinOfCountSql: boolean;
    maxLimit?: number;
    countId?: string;
}

interface OrderItem {
    column: string;
    asc: boolean;
}
