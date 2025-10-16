<script setup lang="ts">
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { requestRegistrationCode } from '@/api/auth/auth';
import { useAuthStore } from '@/stores/auth';
import { useToast } from 'primevue/usetoast';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const toast = useToast();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    verificationCode: '',
    agree: false
});

const errors = reactive({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    verificationCode: '',
    agree: ''
});

const isSubmitting = ref(false);
const isSendingCode = ref(false);
const codeCountdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const passwordStrengthHint = computed(() => '密码至少需要 6 个字符，并包含大小写字母与数字的组合。');

const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const verificationCodePattern = /^\d{6}$/;

const isCodeButtonDisabled = computed(() => {
    if (isSubmitting.value || isSendingCode.value) {
        return true;
    }
    if (codeCountdown.value > 0) {
        return true;
    }
    return !emailPattern.test(form.email.trim());
});

const codeButtonLabel = computed(() => {
    if (codeCountdown.value > 0) {
        return `重新发送 (${codeCountdown.value}s)`;
    }
    return '获取验证码';
});

watch(
    () => form.username,
    (value) => {
        if (errors.username && value.trim()) {
            errors.username = '';
        }
    }
);

watch(
    () => form.email,
    (value, oldValue) => {
        if (errors.email && value.trim()) {
            errors.email = '';
        }
        if (errors.verificationCode && form.verificationCode.trim()) {
            errors.verificationCode = '';
        }
        if (value !== oldValue) {
            form.verificationCode = '';
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            codeCountdown.value = 0;
        }
    }
);

watch(
    () => form.password,
    (value) => {
        if (errors.password && value) {
            errors.password = '';
        }
        if (errors.confirmPassword && form.confirmPassword && form.confirmPassword === value) {
            errors.confirmPassword = '';
        }
    }
);

watch(
    () => form.verificationCode,
    (value) => {
        if (errors.verificationCode && value.trim()) {
            errors.verificationCode = '';
        }
    }
);

watch(
    () => form.confirmPassword,
    (value) => {
        if (errors.confirmPassword && value) {
            errors.confirmPassword = '';
        }
    }
);

watch(
    () => form.agree,
    (value) => {
        if (errors.agree && value) {
            errors.agree = '';
        }
    }
);

function validate(): boolean {
    let valid = true;
    Object.keys(errors).forEach((key) => {
        errors[key as keyof typeof errors] = '';
    });

    const username = form.username.trim();
    const email = form.email.trim();

    if (!username) {
        errors.username = '用户名不能为空';
        valid = false;
    } else if (username.length < 3 || username.length > 32) {
        errors.username = '用户名长度需在 3~32 个字符之间';
        valid = false;
    }

    if (!email) {
        errors.email = '邮箱不能为空';
        valid = false;
    } else if (!emailPattern.test(email)) {
        errors.email = '请输入有效的邮箱地址';
        valid = false;
    }

    if (!form.password) {
        errors.password = '密码不能为空';
        valid = false;
    } else if (form.password.length < 6) {
        errors.password = '密码长度不能少于 6 个字符';
        valid = false;
    }

    if (!form.confirmPassword) {
        errors.confirmPassword = '请确认密码';
        valid = false;
    } else if (form.confirmPassword !== form.password) {
        errors.confirmPassword = '两次输入的密码不一致';
        valid = false;
    }

    const code = form.verificationCode.trim();
    if (!code) {
        errors.verificationCode = '请输入邮箱验证码';
        valid = false;
    } else if (!verificationCodePattern.test(code)) {
        errors.verificationCode = '验证码必须为 6 位数字';
        valid = false;
    }

    if (!form.agree) {
        errors.agree = '请先阅读并同意服务条款';
        valid = false;
    }

    return valid;
}

function extractErrorMessage(error: unknown, fallback = '注册失败，请稍后重试'): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
            return message;
        }
    }
    return fallback;
}

function startCountdown(seconds: number) {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    codeCountdown.value = seconds;
    countdownTimer = setInterval(() => {
        codeCountdown.value -= 1;
        if (codeCountdown.value <= 0) {
            codeCountdown.value = 0;
            if (countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
        }
    }, 1000);
}

async function sendVerificationCode(): Promise<void> {
    if (codeCountdown.value > 0 || isSendingCode.value) {
        return;
    }
    const email = form.email.trim();
    if (!email) {
        errors.email = '邮箱不能为空';
        return;
    }
    if (!emailPattern.test(email)) {
        errors.email = '请输入有效的邮箱地址';
        return;
    }
    isSendingCode.value = true;
    try {
        await requestRegistrationCode({ email });
        toast.add({
            severity: 'success',
            summary: '验证码已发送',
            detail: '请前往邮箱查收验证码',
            life: 2500
        });
        startCountdown(60);
    } catch (error) {
        const message = extractErrorMessage(error, '发送验证码失败，请稍后重试');
        toast.add({ severity: 'error', summary: '发送失败', detail: message, life: 3000 });
    } finally {
        isSendingCode.value = false;
    }
}

onBeforeUnmount(() => {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
});

async function onSubmit(): Promise<void> {
    if (!validate()) {
        return;
    }

    isSubmitting.value = true;
    try {
        await authStore.register({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            verificationCode: form.verificationCode.trim()
        });
        toast.add({
            severity: 'success',
            summary: '注册成功',
            detail: '欢迎加入 CodeForge！',
            life: 2500
        });
        const redirect = (route.query.redirect as string) || '/';
        await router.replace(redirect);
    } catch (error) {
        const message = extractErrorMessage(error);
        toast.add({ severity: 'error', summary: '注册失败', detail: message, life: 3000 });
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <Toast />
    <FloatingConfigurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <i class="pi pi-users text-4xl text-primary mb-5"></i>
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-2">创建新账号</div>
                        <span class="text-muted-color font-medium text-base"> 填写信息以加入评测平台 </span>
                    </div>

                    <form @submit.prevent="onSubmit" class="flex flex-col gap-4">
                        <div>
                            <label for="username" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">用户名</label>
                            <InputText id="username" v-model="form.username" type="text" placeholder="请输入用户名" class="w-full md:w-[30rem]" :invalid="!!errors.username" autocomplete="username" :disabled="isSubmitting" />
                            <InlineMessage v-if="errors.username" severity="error">{{ errors.username }}</InlineMessage>
                        </div>

                        <div>
                            <label for="email" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">邮箱</label>
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <InputText id="email" v-model="form.email" type="email" placeholder="请输入邮箱" class="w-full md:w-[22rem] flex-1" :invalid="!!errors.email" autocomplete="email" :disabled="isSubmitting" />
                                <Button type="button" :label="codeButtonLabel" class="w-full sm:w-auto whitespace-nowrap" :disabled="isCodeButtonDisabled" :loading="isSendingCode" @click="sendVerificationCode" />
                            </div>
                            <InlineMessage v-if="errors.email" severity="error">{{ errors.email }}</InlineMessage>
                        </div>

                        <div>
                            <label for="verificationCode" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2"> 邮箱验证码 </label>
                            <InputText
                                id="verificationCode"
                                v-model="form.verificationCode"
                                type="text"
                                placeholder="请输入 6 位验证码"
                                class="w-full md:w-[30rem]"
                                :invalid="!!errors.verificationCode"
                                autocomplete="one-time-code"
                                maxlength="6"
                                :disabled="isSubmitting"
                            />
                            <InlineMessage v-if="errors.verificationCode" severity="error">{{ errors.verificationCode }} </InlineMessage>
                        </div>

                        <div>
                            <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">密码</label>
                            <Password id="password" v-model="form.password" placeholder="请输入密码" :toggleMask="true" fluid :feedback="false" :invalid="!!errors.password" autocomplete="new-password" :disabled="isSubmitting" />
                            <small class="text-sm text-muted-color">{{ passwordStrengthHint }}</small>
                            <InlineMessage v-if="errors.password" severity="error">{{ errors.password }}</InlineMessage>
                        </div>

                        <div>
                            <label for="confirmPassword" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2"> 确认密码 </label>
                            <Password
                                id="confirmPassword"
                                v-model="form.confirmPassword"
                                placeholder="再次输入密码"
                                :toggleMask="true"
                                fluid
                                :feedback="false"
                                :invalid="!!errors.confirmPassword"
                                autocomplete="new-password"
                                :disabled="isSubmitting"
                            />
                            <InlineMessage v-if="errors.confirmPassword" severity="error">{{ errors.confirmPassword }} </InlineMessage>
                        </div>

                        <div class="flex items-start gap-2 mt-2">
                            <Checkbox v-model="form.agree" binary input-id="agree" :disabled="isSubmitting" />
                            <label for="agree" class="text-sm text-muted-color">
                                我已阅读并同意
                                <RouterLink to="/pages/terms" class="text-primary hover:underline">服务条款</RouterLink>
                                与
                                <RouterLink to="/pages/privacy" class="text-primary hover:underline">隐私政策 </RouterLink>
                            </label>
                        </div>
                        <InlineMessage v-if="errors.agree" severity="error">{{ errors.agree }}</InlineMessage>

                        <Button type="submit" label="立即注册" class="w-full mt-6" :loading="isSubmitting" :disabled="isSubmitting" />
                    </form>

                    <div class="flex items-center justify-between mt-8">
                        <span class="text-muted-color text-sm">已有账号？</span>
                        <Button as="router-link" to="/auth/login" label="前往登录" link class="px-0" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
