import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(async () => {
    const { PrimeVueResolver } = await import('@primevue/auto-import-resolver')

    return {
        optimizeDeps: {
            exclude: ['@primevue/auto-import-resolver'],
        },
        plugins: [
            vue(),
            Components({
                resolvers: [PrimeVueResolver()],
            }),
        ],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
        server: {
            proxy: {
                '/user/api': {
                    target: 'http://localhost:9999',
                    changeOrigin: true,
                },
                '/api/auth': {
                    target: 'http://localhost:9999',
                    changeOrigin: true,
                },
                '/problems/api': {
                    target: 'http://localhost:9999',
                    changeOrigin: true,
                },
                '/solutions/api/management': {
                    target: 'http://localhost:9999',
                    changeOrigin: true,
                },
            },
        },
    }
})
