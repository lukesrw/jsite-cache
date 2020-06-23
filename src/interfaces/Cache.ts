import Stat from "../lib/Stat";

export interface CacheDataRecordInterface {
    data: any;
    set: number;
    changed: Stat;
    used: Stat;
    age_max?: number;
}

export interface CacheDataInterface {
    [key: string]: {
        [args: string]: CacheDataRecordInterface;
    };
}

export interface CacheOptionsInterface {
    age_max: number;
}

export interface CacheInterface {
    data: CacheDataInterface;
    options: CacheOptionsInterface;
}
