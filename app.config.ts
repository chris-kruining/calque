import { defineConfig } from '@solidjs/start/config';
import solidSvg from 'vite-plugin-solid-svg';
import devtools from 'solid-devtools/vite';

export default defineConfig({
    vite: {
        html: {
            cspNonce: 'KAAS_IS_AWESOME',
        },
        plugins: [
            devtools({
                autoname: true,
            }),
            solidSvg(),
        ],
    },
    solid: {
        babel: {
            compact: true,
        },
    },
    server: {
        preset: 'bun',
        prerender: {
            crawlLinks: false,
            routes: ['/sitemap.xml']
        },
    },
});
