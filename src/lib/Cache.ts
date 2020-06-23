/**
 * Node.js modules
 */
import { createReadStream, createWriteStream, readFileSync, writeFileSync, PathLike } from "fs";
import { promisify } from "util";
import { deflateSync, inflateSync } from "zlib";
import { deflate, inflate } from "../modules/zlib";
import { once } from "events";

/**
 * Custom libs
 */
import Stat from "./Stat";
import { CacheInterface, CacheOptionsInterface, CacheDataInterface } from "../interfaces/Cache";

/**
 * Constants
 */
const DEFAULT_OPTIONS: CacheOptionsInterface = {
    age_max: 600000 // 10 minutes
};

module.exports = class Cache implements CacheInterface {
    data: CacheDataInterface;
    options!: CacheOptionsInterface;

    /**
     * Cache utility
     *
     * @param {object} [options={}] for configuration
     * @param {object} [data={}] to start with
     */
    constructor(options?: CacheOptionsInterface, data?: CacheDataInterface) {
        this.setOptions(options);

        data = data || {};
        if (typeof data !== "object" || Array.isArray(data) || data === null) {
            throw new Error("Data must be an object");
        }
        this.data = data;
    }

    /**
     * Set or update caching options
     *
     * @param {object} options to set
     * @returns {Cache} Self instance
     */
    setOptions(options?: CacheOptionsInterface): this {
        this.options = Object.assign({}, DEFAULT_OPTIONS, this.options || {}, options || {});

        return this;
    }

    /**
     * Format key for storage
     *
     * @param {string|function} key to format
     * @returns {string} Formatted key
     */
    static formatKey(key: string | Function | Array<any>): string {
        if (!key) return key;

        // just take the first line of functions, e.g. "function myFunction(arg1, arg2) {"
        if (typeof key === "function") {
            key = String(key).split("\n")[0].trim();
        }

        return JSON.stringify(key);
    }

    /**
     * Create a Cache utility from array of caches
     *
     * @param {array} caches to merge
     * @param {object} [options=[]] for configuration
     * @returns {Cache} Cache from merge
     */
    static fromMerge(caches: (Cache | CacheDataInterface)[], options: CacheOptionsInterface): Cache {
        let data: CacheDataInterface = {};

        if (Array.isArray(caches)) {
            caches.forEach((cache: Cache | CacheDataInterface) => {
                let cache_data: CacheDataInterface = cache instanceof Cache ? cache.data : cache;

                Object.keys(cache_data).forEach((key: string) => {
                    if (!Object.prototype.hasOwnProperty.call(data, key)) {
                        data[key] = {};
                    }

                    Object.keys(cache_data[key]).forEach(args => {
                        if (!Object.prototype.hasOwnProperty.call(cache_data[key], args)) {
                            cache_data[key][args] = {
                                changed: new Stat(),
                                data: undefined,
                                set: 0,
                                used: new Stat()
                            };
                        }

                        if (cache_data[key][args].set > data[key][args].set) {
                            data[key][args] = cache_data[key][args];
                        }
                    });
                });
            });
        }

        return new Cache(options, data);
    }

    /**
     * JSON
     */
    toJSON(): string {
        return JSON.stringify(this.data, null, 4);
    }

    async toJSONFile(location: PathLike): Promise<string> {
        let json = this.toJSON();

        let stream = createWriteStream(location);
        stream.write(json);

        await once(stream, "end");

        return json;
    }
    toJSONFileSync(location: PathLike): string {
        let json = this.toJSON();

        writeFileSync(location, json);

        return json;
    }

    /**
     * Un-JSON
     */
    static fromJSON(data: string, options?: CacheOptionsInterface): Cache {
        return new Cache(options, JSON.parse(data));
    }

    static async fromJSONFile(location: PathLike): Promise<Cache> {
        let data = "";
        let stream = createReadStream(location);

        stream
            .on("data", chunk => (data += chunk))
            .on("error", error => {
                throw error;
            });

        await once(stream, "end");

        return this.fromJSON(data);
    }
    static fromJSONFileSync(location: PathLike): Cache {
        return this.fromJSON(readFileSync(location, "utf8"));
    }

    /**
     * Pack
     */
    toPack(): Promise<Buffer> {
        return deflate(this.toJSON());
    }
    toPackSync(): Buffer {
        return deflateSync(this.toJSON());
    }

    async toPackFile(location: PathLike): Promise<Buffer> {
        let pack = await this.toPack();

        let stream = createWriteStream(location);
        stream.write(pack);

        await once(stream, "end");

        return pack;
    }
    toPackFileSync(location: PathLike): Buffer {
        let pack = this.toPackSync();

        writeFileSync(location, pack);

        return pack;
    }

    /**
     * Un-pack
     */
    static async fromPack(data: Buffer, options?: CacheOptionsInterface): Promise<Cache> {
        let buffer = await inflate(data);

        return this.fromJSON(buffer.toString(), options);
    }
    static fromPackSync(data: Buffer, options?: CacheOptionsInterface): Cache {
        return this.fromJSON(inflateSync(data).toString(), options);
    }

    static async fromPackFile(location: PathLike) {
        let data: Array<Buffer> = [];
        let stream = createReadStream(location);

        stream
            .on("data", chunk => data.push(Buffer.from(chunk)))
            .on("error", error => {
                throw error;
            });

        await once(stream, "end");

        return this.fromPack(Buffer.concat(data));
    }
    static fromPackFileSync(location: PathLike) {
        return this.fromPackSync(readFileSync(location));
    }

    /**
     * Create a Cache utility from file
     *
     * @param {string} location of file
     * @param {object} [options={}] for configuration
     * @returns {Promise} Pending promise with cache from file
     */
    static async fromFile(location: string, options?: CacheOptionsInterface): Promise<Cache> {
        if (!location || typeof location !== "string") {
            throw new Error("Unable to create from file");
        }

        let data: Array<Buffer> = [];
        let stream = createReadStream(location);

        stream
            .on("data", chunk => data.push(Buffer.from(chunk)))
            .on("error", error => {
                throw error;
            });

        await once(stream, "end");

        let new_data = Buffer.concat(data);

        if (location.endsWith(".json")) {
            return this.fromJSON(new_data.toString(), options);
        }

        return this.fromPack(new_data, options);
    }

    /**
     * Set data in the cache
     *
     * @param {string|function} key to store data with
     * @param {*} data to store
     * @param {array} [args=[]] to store data with
     * @param {object} [options={}] to override configuration
     * @returns {*} Data being stored
     */
    set(key: string | Function, data: any, args: Array<any> | string = []) {
        if (data !== undefined) {
            key = Cache.formatKey(key);
            if (!Object.prototype.hasOwnProperty.call(this.data, key)) {
                this.data[key] = {};
            }

            let time_now = new Date().getTime();

            args = Cache.formatKey(args);
            if (!Object.prototype.hasOwnProperty.call(this.data[key], args)) {
                this.data[key][args] = {
                    data,
                    set: time_now,
                    changed: new Stat(),
                    used: new Stat()
                };
            }

            if (JSON.stringify(data) !== JSON.stringify(this.data[key][args].data)) {
                // ensure the "changed" statistic is setup before using it
                this.data[key][args].changed = Stat.fromCompact(this.data[key][args].changed);
                this.data[key][args].changed.add(time_now - this.data[key][args].changed.getLast(time_now));
            }

            this.data[key][args] = Object.assign(this.data[key][args], {
                data,
                set: time_now
            });
        }

        return data;
    }

    /**
     * Inspect data stored in the cache
     *
     * @param {string|function} key to inspect
     * @param {array} [args=[]] to inspect
     * @returns {object|undefined} Data with metadata
     */
    inspect(key: string | Function, args: Array<any> | string = []) {
        if (typeof key !== "string") key = Cache.formatKey(key);

        if (Object.prototype.hasOwnProperty.call(this.data, key)) {
            if (typeof args !== "string") args = Cache.formatKey(args);

            if (Object.prototype.hasOwnProperty.call(this.data[key], args)) return this.data[key][args];
        }

        return undefined;
    }

    /**
     * Retrieve data stored in the cache
     *
     * @param {string|function} key to get
     * @param {array} [args=[]] to get
     * @param {boolean} [format=true] whether to format key & args
     * @returns {*|undefined} Data stored (or undefined, if none stored)
     */
    get(key: string | Function, args: Array<any> | string = []) {
        let cache = this.inspect(key, args);
        let time_now = new Date().getTime();

        if (cache && time_now - cache.set <= (cache.age_max || this.options.age_max)) {
            // ensure the "used" statistic is setup before using it
            cache.used = Stat.fromCompact(cache.used);
            cache.used.add(time_now - cache.used.getLast(cache.set));

            return cache.data;
        }

        return undefined;
    }

    /**
     * Execute function or get from cache
     *
     * @param {string|function} func to use for retrieval
     * @param {array} [args=[]] to use
     * @param {boolean} [use_cache=true] for retrieving
     * @returns {Promise} Pending promise with cache data/result
     */
    async use(func: Function, args = [], use_cache: Function | boolean = true): Promise<any> {
        let cache;

        if (use_cache) {
            cache = this.get(func, args);

            if (cache && (typeof use_cache !== "function" || (typeof use_cache === "function" && !use_cache(cache)))) {
                return cache;
            }
        }

        if (typeof func === "function") {
            return this.set(func, await promisify(func)(...args), args);
        }

        cache = this.inspect(func, args);

        return cache ? cache.data : undefined;
    }

    /**
     * Execute function or get from cache (but synchronously)
     *
     * @param {string|function} func to use for retrieval
     * @param {array} [args=[]] to use
     * @param {boolean} [use_cache=true] for retrieving
     * @returns {*} Cache data/result
     */
    useSync(func: Function, args = [], use_cache: Function | boolean = true) {
        let cache;

        if (use_cache) {
            cache = this.get(func, args);

            if (cache && (typeof use_cache !== "function" || (typeof use_cache === "function" && !use_cache(cache)))) {
                return cache;
            }
        }

        if (typeof func === "function") {
            return this.set(func, func(...args), args);
        }

        cache = this.inspect(func, args);

        return cache ? cache.data : undefined;
    }

    /**
     * Remove data from, or clear, the cache
     *
     * @param {string|function} [key] to delete data from
     * @param {array} [args] to delete data from
     * @returns {Cache} Self instance
     */
    unset(key: string | Function, args: Array<any> | string) {
        key = Cache.formatKey(key);
        args = Cache.formatKey(args);

        if (key === undefined) {
            if (args === undefined) {
                this.data = {};
            } else {
                Object.keys(this.data).forEach(key => this.unset(key, args));
            }
        } else if (args === undefined) {
            delete this.data[key];
        } else {
            delete this.data[key][args];
        }

        return this;
    }

    /**
     * Remove any expired data
     *
     * @returns {Cache} Self instance
     */
    clean() {
        Object.keys(this.data).forEach(key => {
            Object.keys(this.data[key]).forEach(args => {
                if (this.get(key, args) === undefined) {
                    delete this.data[key][args];
                }
            });

            if (Object.keys(this.data[key]).length === 0) delete this.data[key];
        });

        return this;
    }
};
