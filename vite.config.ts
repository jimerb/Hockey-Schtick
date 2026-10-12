import { defineConfig } from 'vite';
// Relative assets work at both the local root and the GitHub Pages project path.
export default defineConfig({ base: './', build: { rolldownOptions: { input: { match: 'index.html', practice: 'practice.html' } } } });
