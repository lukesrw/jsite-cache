import Stat from "../lib/Stat";

export interface CacheDataInterface {
    [key: string]: {
        [args: string]: {
            data: any;
            set: number;
            changed: Stat;
            used: Stat;
            age_max?: number;
        };
    };
}

export interface CacheOptionsInterface {
    age_max: number;
}

export interface CacheInterface {
    data: CacheDataInterface;
    options: CacheOptionsInterface;
}
