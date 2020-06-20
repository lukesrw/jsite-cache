import { StatInterface, StatCompactInterface } from "../interfaces/Stat";

export default class Stat implements StatInterface {
    values: number[];

    constructor(values: number[] = []) {
        this.values = values;
    }

    add(...items: number[]): this {
        this.values.push(...items);

        return this;
    }

    getLast(fallback: number = 0): number {
        if (this.values.length > 0) {
            return this.values[this.values.length - 1];
        }

        return fallback;
    }

    getAverage(): number {
        return this.getSum() / this.getCount();
    }

    getCount(): number {
        return this.values.length;
    }

    getMax(): number {
        return Math.max(...this.values);
    }

    getMin(): number {
        return Math.min(...this.values);
    }

    getSum(): number {
        return this.values.reduce((total, value) => total + value, 0);
    }

    static round(number: number): number {
        return Math.round((number + Number.EPSILON) * 100) / 100;
    }

    static fromCompact(values?: Stat | StatCompactInterface): Stat {
        if (values instanceof Stat) {
            return values;
        }

        if (
            values &&
            typeof values === "object" &&
            Object.prototype.hasOwnProperty.call(values, "min") &&
            Object.prototype.hasOwnProperty.call(values, "max") &&
            Object.prototype.hasOwnProperty.call(values, "sum") &&
            Object.prototype.hasOwnProperty.call(values, "count")
        ) {
            return new Stat(
                [values.min, values.max].concat(
                    new Array(values.count - 2).fill((values.sum - values.min - values.max) / (values.count - 2))
                )
            );
        }

        return new Stat();
    }

    toCompact(): StatCompactInterface {
        return {
            count: Stat.round(this.getCount()),
            max: Stat.round(this.getMax()),
            min: Stat.round(this.getMin()),
            sum: Stat.round(this.getSum())
        };
    }
}
