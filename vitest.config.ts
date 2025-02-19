import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path'
import type { Plugin } from 'vite';
import { CoverageReporter, CoverageV8Options } from 'vitest/node';

export default defineConfig({
    plugins: [
        solidPlugin(),
        reportWith('lcov', 'text')
    ],
    resolve: {
        conditions: ['development', 'browser'],
        alias: [
            { find: '~', replacement: resolve(__dirname, './src') }
        ]
    },
    test: {
        environment: 'jsdom',
        coverage: {
            reporter: ['lcov', 'text-summary', 'text'],
            reportsDirectory: './.coverage',
            all: false
        },
    },
});

function reportWith(...reporter: CoverageReporter[]): Plugin {
    return {
        name: 'add reporters',

        config(userConf, env) {
            if (userConf.test) {
                userConf.test.coverage = { ...userConf.test.coverage, reporter } as CoverageV8Options;
            }
        },
    }
}
