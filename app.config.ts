import { defineConfig } from '@solidjs/start/config';
import solidSvg from 'vite-plugin-solid-svg';
import devtools from 'solid-devtools/vite';

export default defineConfig({
    vite: {
        resolve: {
            alias: [
                { find: '@', replacement: 'F:\\Github\\calque\\node_modules\\' },
            ],
        },
        html: {
            cspNonce: 'KAAS_IS_AWESOME',
        },
        // css: {
        //     postcss: {
        //     },
        // },
        plugins: [
            devtools({
                autoname: true,
            }),
            solidSvg(),
            {
                name: 'temp',
                configResolved(config) {
                    console.log(config.resolve.alias);
                },
            }
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
