import { createRoot } from 'solid-js';
import { it as vit } from 'vitest';

export const it = (name: string, fn: () => any) => {
    return vit(name, () => {
        return createRoot(async (cleanup) => {
            const res = await fn();

            cleanup();

            return res;
        });
    })
}
