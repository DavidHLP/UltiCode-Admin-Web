<script setup lang="ts">
import { type ForgotPasswordPayload, requestPasswordReset } from '@/api/auth/auth.ts';
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { useToast } from 'primevue/usetoast';
import { reactive, ref, watch } from 'vue';

const toast = useToast();

const form = reactive<{ email: string }>({
    email: ''
});

const errors = reactive<{ email: string }>({
    email: ''
});

const isSubmitting = ref(false);
const successMessageVisible = ref(false);

const emailPattern = /^(?:[a-zA-Z0-9._%+-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

watch(
    () => form.email,
    (value: string) => {
        if (errors.email && value.trim()) {
            errors.email = '';
        }
        if (successMessageVisible.value) {
            successMessageVisible.value = false;
        }
    }
);

function validate(): boolean {
    const value = form.email.trim();
    errors.email = '';

    if (!value) {
        errors.email = '邮箱不能为空';
        return false;
    }
    if (!emailPattern.test(value)) {
        errors.email = '请输入有效的邮箱地址';
        return false;
    }
    return true;
}

function extractErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
            return message;
        }
    }
    return '发送重置邮件失败，请稍后重试';
}

async function onSubmit(): Promise<void> {
    if (!validate()) {
        return;
    }
    isSubmitting.value = true;
    const payload: ForgotPasswordPayload = { email: form.email.trim() };
    try {
        await requestPasswordReset(payload);
        successMessageVisible.value = true;
        toast.add({
            severity: 'success',
            summary: '邮件已发送',
            detail: '如果邮箱存在，我们会尽快发送重置密码邮件。',
            life: 4000
        });
    } catch (error) {
        const message = extractErrorMessage(error);
        toast.add({ severity: 'error', summary: '请求失败', detail: message, life: 4000 });
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
                    <div class="text-center mb-8 flex flex-col items-center gap-4">
                        <i class="pi pi-envelope text-4xl text-primary"></i>
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium">忘记密码</div>
                        <span class="text-muted-color font-medium text-base max-w-[22rem]"> 输入您的注册邮箱，我们将通过邮件帮助您找回密码。 </span>
                    </div>

                    <form @submit.prevent="onSubmit" class="flex flex-col">
                        <label for="reset-email" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2"> 邮箱 </label>
                        <div class="mb-6 flex flex-col gap-2">
                            <InputText id="reset-email" v-model="form.email" type="email" placeholder="请输入邮箱地址" class="w-full md:w-[30rem]" :invalid="!!errors.email" autocomplete="username" :disabled="isSubmitting" />
                            <InlineMessage v-if="errors.email" severity="error">{{ errors.email }}</InlineMessage>
                        </div>

                        <Message v-if="successMessageVisible" severity="success" class="mb-6"> 如果邮箱存在，我们将在几分钟内发送邮件，请注意查收。 </Message>

                        <Button type="submit" label="发送重置邮件" class="w-full" :loading="isSubmitting" :disabled="isSubmitting" />
                    </form>

                    <div class="flex items-center justify-between mt-8">
                        <Button as="router-link" to="/auth/login" label="返回登录" link class="px-0" />
                        <span class="text-muted-color text-sm">仍需帮助？请联系系统管理员</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
