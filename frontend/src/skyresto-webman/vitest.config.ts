/// <reference types="vitest" />

import { createRequire } from 'module'
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import tsconfigPaths from 'vite-tsconfig-paths'
const require = createRequire(import.meta.url)
const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'))
const cMapsDir = normalizePath(path.join(pdfjsDistPath, 'cmaps'))

export default defineConfig({
    plugins: [
        react(),
        tsconfigPaths(),
        viteStaticCopy({
            targets: [
                {
                    src: cMapsDir,
                    dest: '',
                },
            ],
        }),
    ],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
        },
        server: {
            deps: {
                /**
                 * ISSUE
                 * STYLED-COMPONENTS: https://github.com/vitest-dev/vitest/discussions/5286
                 */
                inline: ['@dcorp/web-ui'],
            },
        },
    },
})
