import { defineConfig } from 'vite';
export default defineConfig({ build: { rolldownOptions: { input: { match: 'index.html', practice: 'practice.html' } } } });
