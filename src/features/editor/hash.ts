import { installIntoGlobal } from "iterator-helpers-polyfill";

installIntoGlobal();

const CHUNK_SIZE = 16;
const UINT32_BYTE_SIZE = 4;
const HASH_NUMBER_OF_UINT32 = 5;
const HASH_SIZE = HASH_NUMBER_OF_UINT32 * UINT32_BYTE_SIZE;
const initalizationVector /* 20 bytes */ = Object.freeze([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0] as const);
const hashKey             /* 16 bytes */ = Object.freeze([0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6] as const);

type Word = number & {}; // union with empty object so typescript show this as 'Word' and not as 'number'
type HashBytes = Uint32Array & { length: typeof HASH_NUMBER_OF_UINT32 };

export const hash = (data: any) => {
    const buffer = typeof data === 'object' && data instanceof Uint32Array ? data : new Uint32Array(toBinary(data));

    if (!Number.isSafeInteger(buffer.length)) {
        throw new Error('Cannot hash more than 2^53 - 1 bits');
    }

    // prepare blocks
    const output = new Uint32Array(initalizationVector) as HashBytes;
    const blocks = range(0, buffer.length, CHUNK_SIZE).map(i => {
        const view = buffer.subarray(i, i + 16);
        const words = Array<Word>(80);

        words[0] = view[0];
        words[1] = view[1];
        words[2] = view[2];
        words[3] = view[3];
        words[4] = view[4];

        return words;
    });

    // apply blocks
    for (const words of blocks) {
        let [a, b, c, d, e] = output;

        for (let i = 0; i < 80; i++) {
            if (i >= 16) {
                words[i] = circularShiftLeft(1, words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16]);
            }

            const tmp = (
                circularShiftLeft(a, HASH_NUMBER_OF_UINT32) +
                logicalHashFunctions(i, b, c, d) +
                e +
                words[i] +
                hashKey[Math.floor(i / HASH_SIZE)]
            );

            e = d;
            d = c;
            c = circularShiftLeft(b, 30);
            b = a;
            a = tmp;
        }

        output[0] = (output[0] + a) | 0;
        output[1] = (output[1] + b) | 0;
        output[2] = (output[2] + c) | 0;
        output[3] = (output[3] + d) | 0;
        output[4] = (output[4] + e) | 0;
    }

    return output.values().map(word => (word >>> 0).toString(16)).join('');
};

const circularShiftLeft = (subject: number, offset: number): number => {
    return ((subject << offset) | (subject >>> 32 - offset)) & (0xFFFFFFFF);
};

const logicalHashFunctions = (index: number, b: Word, c: Word, d: Word): Word => {
    if (index < HASH_SIZE) {
        return (b & c) | (~b & d);
    }
    else if (index < (2 * HASH_SIZE)) {
        return b ^ c ^ d;
    }
    else if (index < (3 * HASH_SIZE)) {
        return (b & c) | (b & d) | (c & d);
    }
    else if (index < (4 * HASH_SIZE)) {
        return b ^ c ^ d;
    }

    throw new Error('Unreachable code');
};

const range = function* (start: number, end: number, step: number): Iterator<number> {
    for (let i = start; i <= end; i += step) {
        yield i;
    }
};

const toBinary = function*<T>(data: T): Generator<number, void, unknown> {
    switch (typeof data) {
        case 'function':
        case 'symbol':
        case 'undefined':
            break;

        case 'string':
            yield* compact(new TextEncoder().encode(data));
            break;

        case 'number':
            yield data;
            break;

        case 'boolean':
            yield Number(data);
            break;

        case 'bigint':
            let value: bigint = data;
            // limit the iteration to 10 cycles.
            // This covers 10*32 bits, which in al honesty should be enough no?
            const ITERATION_LIMIT = 10;

            for (let i = 0; i < ITERATION_LIMIT && value > 0; i++) {
                yield Number((value & 0xffffffffn));
                value >>= 32n;

                if (i === 10) {
                    throw new Error('Iteration limit in bigint serialization reached');
                }
            }
            break;

        case 'object':
            if (data === null) {
                break;
            }

            if (data instanceof Uint8Array) {
                yield* compact(data);
            }

            if (data instanceof Uint32Array) {
                yield* data;
            }

            for (const item of Object.values(data)) {
                yield* toBinary(item);
            }
            break;
    }
};

const compact = function* (source: Iterable<number>): Generator<number, void, unknown> {
    let i = 0;
    let buffer = 0;

    for (const value of source) {
        buffer |= (value & 0xff) << (8 * i);

        if (i === 3) {
            yield buffer;
            buffer = 0;
        }

        i = (i + 1) % 4;
    }
};

