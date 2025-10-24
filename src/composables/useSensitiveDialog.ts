import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import type { ToastOptions } from 'primevue/usetoast';

interface ToastTarget {
    add(options: ToastOptions): void;
}

export function useSensitiveDialog(toast: ToastTarget) {
    const authStore = useAuthStore();
    const visible = ref(false);
    const code = ref('');
    const loading = ref(false);
    const errorMessage = ref<string | null>(null);
    let resolver: ((token: string | null) => void) | null = null;

    function open(): Promise<string | null> {
        visible.value = true;
        code.value = '';
        errorMessage.value = null;
        return new Promise((resolve) => {
            resolver = resolve;
        });
    }

    async function confirm() {
        const trimmed = code.value.trim();
        if (!trimmed) {
            errorMessage.value = '请输入验证码';
            return;
        }
        if (trimmed.length !== 6) {
            errorMessage.value = '验证码必须为6位数字';
            return;
        }
        errorMessage.value = null;
        loading.value = true;
        try {
            const token = await authStore.obtainSensitiveToken(trimmed);
            visible.value = false;
            resolver?.(token);
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '验证失败',
                detail: (error as Error)?.message ?? '二次验证失败',
                life: 4000
            } satisfies ToastOptions);
            errorMessage.value = '请检查验证码后重试';
        } finally {
            loading.value = false;
        }
    }

    function cancel() {
        visible.value = false;
        resolver?.(null);
        authStore.clearSensitiveToken();
    }

    return {
        visible,
        code,
        loading,
        errorMessage,
        open,
        confirm,
        cancel
    };
}
