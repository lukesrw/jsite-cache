export interface StatInterface {
    values: number[];
    add(...items: number[]): this;
    getLast(fallback?: number): number;
    getAverage(): number;
    getCount(): number;
    getMax(): number;
    getMin(): number;
    getSum(): number;
    toCompact(): StatCompactInterface;
}

export interface StatCompactInterface {
    count: number;
    max: number;
    min: number;
    sum: number;
}
