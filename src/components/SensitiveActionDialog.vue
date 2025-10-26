<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import {
    registerSensitiveActionRequester,
    unregisterSensitiveActionRequester,
    type SensitiveActionContext
} from '@/utils/sensitive-action-guard';
import InputOtp from 'primevue/inputotp';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const RESEND_SECONDS = 60;
const CODE_PATTERN = /^\d{6}$/;

const props = withDefaults(
    defineProps<{
        global?: boolean;
    }>(),
    {
        global: false
    }
);

const authStore = useAuthStore();
const toast = useToast();

const visible = ref(false);
const code = ref('');
const loading = ref(false);
const sending = ref(false);
const countdown = ref(0);
const errorMessage = ref<string | null>(null);
const contextInfo = ref<SensitiveActionContext | null>(null);

const emailHint = computed(() => {
    const email = authStore.user?.email;
    if (!email) {
        return '邮箱';
    }
    const [local, domain] = email.split('@');
    if (!domain) {
        return email;
    }
    if (!local) {
        return `***@${domain}`;
    }
    const maskedLocal = local.length <= 2 ? `${local[0]}***` : `${local.slice(0, 2)}***`;
    return `${maskedLocal}@${domain}`;
});

let resolver: ((token: string | null) => void) | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

function clearCountdown() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    countdown.value = 0;
}

function startCountdown() {
    clearCountdown();
    countdown.value = RESEND_SECONDS;
    countdownTimer = setInterval(() => {
        countdown.value -= 1;
        if (countdown.value <= 0) {
            clearCountdown();
        }
    }, 1000);
}

const operationLabel = computed(() => {
    if (!contextInfo.value) {
        return null;
    }
    if (contextInfo.value.description) {
        return contextInfo.value.description;
    }
    const parts: string[] = [];
    if (contextInfo.value.method) {
        parts.push(contextInfo.value.method.toUpperCase());
    }
    if (contextInfo.value.url) {
        parts.push(contextInfo.value.url);
    }
    return parts.length ? parts.join(' ') : null;
});

async function sendCode(force = false) {
    if (sending.value) {
        return;
    }
    if (!force && countdown.value > 0) {
        return;
    }
    sending.value = true;
    try {
        await authStore.requestSensitiveCode();
        startCountdown();
        toast.add({
            severity: 'info',
            summary: '验证码已发送',
            detail: '请前往邮箱查收验证码',
            life: 4000
        });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '发送失败',
            detail: (error as Error)?.message ?? '发送验证码失败',
            life: 4000
        });
        throw error;
    } finally {
        sending.value = false;
    }
}

function resolveAndCleanup(result: string | null) {
    resolver?.(result);
    resolver = null;
    errorMessage.value = null;
    code.value = '';
    contextInfo.value = null;
    clearCountdown();
}

async function confirm() {
    const trimmed = code.value.trim();
    if (!CODE_PATTERN.test(trimmed)) {
        errorMessage.value = '请输入 6 位数字验证码';
        return;
    }
    errorMessage.value = null;
    loading.value = true;
    try {
        const token = await authStore.obtainSensitiveToken(trimmed);
        visible.value = false;
        resolveAndCleanup(token);
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: '验证失败',
            detail: (error as Error)?.message ?? '二次验证失败',
            life: 4000
        });
        errorMessage.value = '请检查验证码是否正确';
    } finally {
        loading.value = false;
    }
}

function cancel() {
    visible.value = false;
    resolveAndCleanup(null);
}

function handleDialogHide() {
    if (resolver) {
        resolveAndCleanup(null);
    }
}

export type SensitiveActionDialogExpose = {
    requestToken: (context?: SensitiveActionContext) => Promise<string | null>;
};

async function requestToken(context?: SensitiveActionContext): Promise<string | null> {
    visible.value = true;
    code.value = '';
    errorMessage.value = null;
    contextInfo.value = context ?? null;
    await sendCode(true).catch(() => {
        /* 错误已经在 sendCode 内部提示 */
    });
    return new Promise((resolve) => {
        resolver = resolve;
    });
}

defineExpose<SensitiveActionDialogExpose>({
    requestToken
});

onMounted(() => {
    if (props.global) {
        registerSensitiveActionRequester(requestToken);
    }
});

watch(code, (value) => {
    if (errorMessage.value && value.trim()) {
        errorMessage.value = null;
    }
});

onUnmounted(() => {
    clearCountdown();
    resolver = null;
    if (props.global) {
        unregisterSensitiveActionRequester(requestToken);
    }
});
</script>

<template>
    <Dialog v-model:visible="visible" header="二次验证" modal :style="{ width: '22rem' }" :draggable="false"
        @hide="handleDialogHide">
        <div class="space-y-3">
            <div class="text-sm text-surface-500 dark:text-surface-300 space-y-1">
                <p v-if="operationLabel" class="font-medium text-surface-700 dark:text-surface-100">
                    正在执行：{{ operationLabel }}
                </p>
                <p>已向 {{ emailHint }} 发送验证码，请在有效期内完成验证。</p>
            </div>
            <div class="flex items-center justify-between text-sm text-surface-500 dark:text-surface-300">
                <span>请输入 6 位验证码完成敏感操作确认。</span>
                <Button label="重新发送" text severity="secondary" :disabled="countdown > 0" :loading="sending"
                    @click="sendCode()" />
            </div>
            <div v-if="countdown > 0" class="text-xs text-surface-400">
                {{ countdown }} 秒后可再次发送
            </div>
            <div class="flex justify-center">
                <InputOtp v-model="code" :length="6" mask integerOnly class="otp-input" />
            </div>
            <p v-if="errorMessage" class="text-xs text-red-500 text-center">{{ errorMessage }}</p>
            <div class="flex justify-end gap-2 pt-2">
                <Button label="取消" severity="secondary" @click="cancel" />
                <Button label="确认" icon="pi pi-shield" :loading="loading" @click="confirm" />
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.otp-input :deep(.p-inputotp-input) {
    width: 3rem;
    height: 3rem;
    font-size: 1.25rem;
    text-align: center;
}
</style>
