import { decode } from "~/utilities";

export async function load(text: Promise<string>): Promise<Map<string, string>> {
    const source = JSON.parse(await text);
    const result = new Map();
    const candidates = Object.entries(source);

    while (candidates.length !== 0) {
        const [ key, value ] = candidates.shift()!;

        if (typeof value !== 'object' || value === null || value === undefined) {
            result.set(key, decode(value as string));
        }
        else {
            candidates.unshift(...Object.entries(value).map<[string, any]>(([ k, v ]) => [`${key}.${k}`, v]));
        }
    }

    return result;
}