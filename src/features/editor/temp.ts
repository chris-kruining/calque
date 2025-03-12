const bit = {
    get(subject: number, index: number) {
        return Boolean((subject >> index) & 1);
    },

    set(subject: number, index: number, value?: boolean) {
        if (value !== undefined) {
            return this.clear(subject, index) | ((value ? 1 : 0) << index);
        }

        return subject | (1 << index)
    },

    clear(subject: number, index: number) {
        return subject & ~(1 << index);
    },

    toggle(subject: number, index: number) {
        return subject ^ (1 << index);
    },
};

interface BitArray {
    [index: number]: boolean;
    length: number;
}

const ITEM_BIT_SIZE = 64;
const createBitArray = (data: boolean[] = []) => {
    const store: number[] = [];
    const populated: number[] = [];
    let length = 0;

    const parseIndex = (key: string) => {
        const value = Number.parseInt(key);

        if (Number.isNaN(value) || !Number.isFinite(value)) {
            return undefined;
        }

        return value;
    };

    const convert = (index: number) => [
        Math.floor(index / ITEM_BIT_SIZE),
        index % ITEM_BIT_SIZE,
    ] as const;

    const get = (index: number) => {
        if (index >= length) {
            return undefined;
        }

        const [arrayIndex, bitIndex] = convert(index);

        if (bit.get(populated[arrayIndex], bitIndex) === false) {
            return undefined;
        }

        return bit.get(store[arrayIndex], bitIndex);
    }

    const set = (index: number, value: boolean) => {
        const [arrayIndex, bitIndex] = convert(index);

        store[arrayIndex] = bit.set((store[arrayIndex] ?? 0), bitIndex, value);
        populated[arrayIndex] = bit.set((populated[arrayIndex] ?? 0), bitIndex);
        length = Math.max(length, index + 1);
    };

    const clear = (index: number) => {
        const [arrayIndex, bitIndex] = convert(index);

        // I think I can skip the store because it is covered by the populated list
        // store[arrayIndex] = bit.set((store[arrayIndex] ?? 0), bitIndex, false);
        populated[arrayIndex] = bit.set((populated[arrayIndex] ?? 0), bitIndex, false);
        length = Math.max(length, index);
    }

    // initial population of array
    for (const [i, v] of data.entries()) {
        set(i, v);
    }

    return new Proxy<BitArray>([], {
        get(target, property, receiver) {
            if (property === Symbol.species) {
                return 'BitArray'
            }

            if (typeof property === 'symbol') {
                return undefined;
            }

            const index = parseIndex(property);

            if (index) {
                console.log(store.map(i => i.toString(2)), populated.map(i => i.toString(2)));

                return get(index);
            }

            console.log(property, index);
        },

        set(target, property, value, receiver) {
            if (typeof property === 'symbol') {
                return false;
            }

            const index = parseIndex(property);

            if (index) {
                if (typeof value !== 'boolean') {
                    throw new Error(`Only able to set boolean values on indices, received '${typeof value}' instead`)
                }

                set(index, value);

                return true;
            }

            return false;
        },

        deleteProperty(target, property) {
            if (typeof property === 'symbol') {
                return false;
            }

            const index = parseIndex(property);

            if (index) {
                clear(index);

                return true;
            }

            return false;
        },
    });
};

const BLOCK_SIZE = 512;
const CHUNK_SIZE = 16;
const UINT32_BYTE_SIZE = 4;
const HASH_NUMBER_OF_UINT32 = 5;
const HASH_SIZE = HASH_NUMBER_OF_UINT32 * UINT32_BYTE_SIZE;
const initalizationVector /* 20 bytes */ = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0] as const;
const hashKey             /* 16 bytes */ = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6] as const;

type Word = number & {}; // union with empty object so typescript show this as 'Word' and not as 'number'
type Chunk = Iterable<Word> & { length: typeof HASH_NUMBER_OF_UINT32 };
type HashBytes = Uint32Array & { length: typeof HASH_NUMBER_OF_UINT32 };

const _hash = (data: string | Uint8Array | Uint32Array) => {
    // Normalize data to byte array
    if (typeof data === 'string') {
        data = new TextEncoder().encode(data);
    }

    // Normalize to Uint32Array
    if (data instanceof Uint8Array) {
        data = new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    }

    if (!Number.isSafeInteger(data.length)) {
        throw new Error('Cannot hash more than 2^53 - 1 bits');
    }

    // prepare blocks
    const output = new Uint32Array(initalizationVector) as HashBytes;
    const blocks = range(0, data.length, CHUNK_SIZE, true).map(i => {
        const view = data.subarray(i, i + 16);
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

        for (const index of range(0, 80)) {
            if (index >= 16) {
                words[index] = circularShiftLeft(1, words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16]);
            }

            const tmp = (
                circularShiftLeft(a, HASH_NUMBER_OF_UINT32) +
                logicalHashFunctions(index, b, c, d) +
                e +
                words[index] +
                hashKey[Math.floor(index / HASH_SIZE)]
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

const range = function* (start: number, end: number, step: number = 1, inclusive: boolean = false): Iterator<number> {
    for (let i = start; inclusive ? (i <= end) : (i < end); i += (step ?? 1)) {
        yield i;
    }
};

export const hash = (data: any): string => {
    if (typeof data === 'string' || (typeof data === 'object' && (data instanceof Uint8Array || data instanceof Uint32Array))) {
        return _hash(data);
    }

    return _hash(JSON.stringify(data));
};