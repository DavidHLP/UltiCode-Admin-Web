import {fileURLToPath, URL} from 'node:url';

import vue from '@vitejs/plugin-vue';
// 导入 Vue Devtools 插件
import Components from 'unplugin-vue-components/vite';
import {defineConfig} from 'vite';
import VueDevTools from 'vite-plugin-vue-devtools';

// https://vitejs.dev/config/
export default defineConfig(async () => {
    const {PrimeVueResolver} = await import('@primevue/auto-import-resolver');

    return {
        optimizeDeps: {
            exclude: ['@primevue/auto-import-resolver']
        },
        plugins: [
            vue(),
            // 在这里添加 Vue Devtools 插件
            VueDevTools(),
            Components({
                resolvers: [PrimeVueResolver()]
            })
        ],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url))
            }
        },
        server: {
            proxy: {
                '/api/': {
                    target: 'http://localhost:9999',
                    changeOrigin: true
                }
            }
        }
    };
});
