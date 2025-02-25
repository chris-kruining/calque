import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'node:path'
import { CoverageReporter, CoverageV8Options } from 'vitest/node';
import type { Plugin } from 'vite';

export default defineConfig({
    plugins: [
        solidPlugin(),
        reportWith('lcov', 'text'),
    ],
    resolve: {
        conditions: ['development', 'browser'],
        alias: [
            { find: '~', replacement: resolve(__dirname, './src') }
        ]
    },
    test: {
        environment: 'jsdom',
        deps: {
            optimizer: {
                web: {
                    enabled: true,
                }
            }
        },
        coverage: {
            provider: 'istanbul',
            reportsDirectory: './.coverage',
            all: false,
        }
    },
});

function reportWith(...reporter: CoverageReporter[]): Plugin {
    return {
        name: 'add reporters',

        config(userConf, env) {
            if (userConf.test) {
                userConf.test.coverage = { ...userConf.test.coverage, reporter } as CoverageV8Options;
                userConf.test.browser = {
                    provider: 'playwright',
                    enabled: true,
                    headless: true,
                    screenshotFailures: false,
                    instances: [{ browser: 'chromium' }]
                };
            }
        },
    }
}
