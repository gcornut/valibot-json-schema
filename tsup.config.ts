import { defineConfig } from 'tsup';

export default [
    defineConfig({
        entry: ['./src/index.ts'],
        clean: true,
        format: ['esm', 'cjs'],
        dts: {
            resolve: true,
            compilerOptions: { moduleResolution: 'node' },
        },
        external: ['valibot', 'json-schema'],
        outDir: './dist',
    }),
    defineConfig({
        entry: ['./src/cli/index.ts'],
        clean: true,
        format: ['cjs'],
        outDir: './bin',
        external: ['esbuild-runner'],
        platform: 'node',
        target: 'node16',
        banner: { js: '#!/usr/bin/env node' },
    }),
];
