import { PathLike } from "fs";

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
    setOptions(options?: CacheOptionsInterface): this;
    toJSON(): string;
    toJSONFile(location: PathLike): Promise<string>;
    toJSONFileSync(location: PathLike): string;
    toPack(): Promise<Buffer>;
    toPackSync(): Buffer;
    toPackFile(location: PathLike): Promise<Buffer>;
    toPackFileSync(location: PathLike): Buffer;
    set<DataType>(key: string | Function, data: DataType, args?: Array<any> | string): DataType;
    inspect(key: string | Function, args?: Array<any> | string): CacheDataRecordInterface | undefined;
    get(key: string | Function, args?: Array<any> | string): any;
    use(func: Function, args?: any[], use_cache?: Function | boolean): Promise<any>;
    useSync(func: Function, args?: any[], use_cache?: Function | boolean): any;
    unset(key: string | Function, args: Array<any> | string): this;
    clean(): this;
}
