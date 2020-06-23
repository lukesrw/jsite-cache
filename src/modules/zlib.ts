/**
 * Node.js modules
 */
import { promisify } from "util";
import { deflate as deflateRaw, inflate as inflateRaw, InputType } from "zlib";

export async function deflate(buf: InputType): Promise<Buffer> {
    let data = await promisify(deflateRaw)(buf);

    return data as Buffer;
}

export async function inflate(buf: InputType): Promise<Buffer> {
    let data = await promisify(inflateRaw)(buf);

    return data as Buffer;
}
