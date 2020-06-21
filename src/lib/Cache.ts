/**
 * Node.js modules
 */
import { createReadStream, createWriteStream, readFileSync, writeFileSync } from "fs";
import { promisify } from "util";
import { deflate, deflateSync, inflate, inflateSync } from "zlib";
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
        this.data = data || {};

        this.setOptions(options);
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
     * Create a Cache utility from data
     *
     * @param {Buffer|object|string} data to create cache from
     * @param {object} [options={}] for configuration
     * @returns {Promise} Pending promise with cache from data
     */
    static async fromData(data: Buffer | string | object, options: CacheOptionsInterface): Promise<Cache> {
        if (Buffer.isBuffer(data)) {
            try {
                let buffer = (await promisify(inflate)(data)) as Buffer;

                return this.fromData(buffer.toString(), options);
            } catch (error) {
                return error;
            }
        }

        if (typeof data === "object" && !Array.isArray(data) && data !== null) {
            return new Cache(options, data as CacheDataInterface);
        }

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (ignore) {
                data = {};
            }

            return new Cache(options, data as CacheDataInterface);
        }

        throw new Error("Unable to create from data");
    }

    /**
     * Create a Cache utility from data (but synchronously)
     *
     * @param {Buffer|object|string} data to create cache from
     * @param {object} [options={}] for configuration
     * @returns {Cache} Cache from data
     */
    static fromDataSync(data: Buffer | string | object, options: CacheOptionsInterface): Cache {
        if (Buffer.isBuffer(data)) {
            return this.fromDataSync(inflateSync(data).toString(), options); // eslint-disable-line
        }

        if (typeof data === "object" && !Array.isArray(data) && data !== null) {
            return new Cache(options, data as CacheDataInterface);
        }

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (ignore) {
                data = {};
            }

            return new Cache(options, data as CacheDataInterface);
        }

        throw new Error("Unable to create from data");
    }

    /**
     * @returns {string} JSON data
     */
    toJSON() {
        return JSON.stringify(this.data, null, 4);
    }

    /**
     * Retrieve cache data (as JSON or compressed)
     *
     * @param {boolean} [as_json=false] or compressed data
     * @returns {Promise} Pending promise with cache data
     */
    toData(as_json = false) {
        return new Promise((resolve, reject) => {
            let data = this.toJSON();

            if (as_json) return resolve(data);

            return promisify(deflate)(Buffer.from(data)).then(resolve).catch(reject);
        });
    }

    /**
     * Retrieve cache data (as JSON or compressed) (but synchronously)
     *
     * @param {boolean} [as_json=false] or compressed data
     * @returns {Buffer|string} Cached data
     */
    toDataSync(as_json = false) {
        let data = this.toJSON();

        return as_json ? data : deflateSync(Buffer.from(data));
    }

    /**
     * Create a Cache utility from file
     *
     * @param {string} location of file
     * @param {object} [options={}] for configuration
     * @returns {Promise} Pending promise with cache from file
     */
    static async fromFile(location: string, options: CacheOptionsInterface): Promise<Cache> {
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
        // let new_data = Buffer.from(data);

        return this.fromData(location.endsWith(".json") ? new_data.toString() : new_data, options);
    }

    /**
     * Create a Cache utility from file (but synchronously)
     *
     * @param {string} location of file
     * @param {object} [options={}] for configuration
     * @returns {Cache} Cache from file
     */
    static fromFileSync(location: string, options: CacheOptionsInterface) {
        let data = readFileSync(location);

        return this.fromDataSync(location.endsWith(".json") ? data.toString() : data, options); // eslint-disable-line
    }

    /**
     * Save cache data to file
     *
     * @param {string} location of file
     * @returns {Promise} Pending promise with file write
     */
    toFile(location: string) {
        return new Promise((resolve, reject) => {
            return this.toData(location.endsWith(".json"))
                .then(data => createWriteStream(location).write(data))
                .then(resolve)
                .catch(reject);
        });
    }

    /**
     * Save cache data to file (but synchronously)
     *
     * @param {string} location of file
     * @returns {*} File write
     */
    toFileSync(location: string) {
        return writeFileSync(location, this.toDataSync(location.endsWith(".json"))); // eslint-disable-line
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
    use(func: Function, args = [], use_cache: Function | boolean = true) {
        return new Promise((resolve, reject) => {
            let cache;

            if (use_cache) {
                cache = this.get(func, args);

                if (
                    cache &&
                    (typeof use_cache !== "function" || (typeof use_cache === "function" && !use_cache(cache)))
                ) {
                    return resolve(cache);
                }
            }

            if (typeof func === "function") {
                return promisify(func)(...args)
                    .then((data: any) => this.set(func, data, args))
                    .then(resolve)
                    .catch(reject);
            }

            cache = this.inspect(func, args);

            return resolve(cache ? cache.data : undefined);
        });
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
