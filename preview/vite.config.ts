import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	publicDir: fileURLToPath(new URL('../static', import.meta.url)),
	plugins: [tailwindcss(), svelte({ configFile: false, compilerOptions: { runes: true } })],
	resolve: {
		alias: {
			'$app/paths': fileURLToPath(new URL('./paths.ts', import.meta.url)),
			$lib: fileURLToPath(new URL('../src/lib', import.meta.url))
		}
	},
	build: { outDir: '../dist', emptyOutDir: true }
});
