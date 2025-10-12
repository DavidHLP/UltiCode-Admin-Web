<script setup lang="ts">
import { requestPasswordReset, type ForgotPasswordPayload } from '@/api/auth/auth'
import FloatingConfigurator from '@/components/FloatingConfigurator.vue'
import { useToast } from 'primevue/usetoast'
import { reactive, ref, watch } from 'vue'

const toast = useToast()

const form = reactive<{ email: string }>({
  email: '',
})

const errors = reactive<{ email: string }>({
  email: '',
})

const isSubmitting = ref(false)
const isSubmitted = ref(false)

watch(
  () => form.email,
  (value: string) => {
    if (errors.email && value.trim()) {
      errors.email = ''
    }
    if (isSubmitted.value) {
      isSubmitted.value = false
    }
  },
)

function validate(): boolean {
  errors.email = ''
  const value = form.email.trim()

  if (!value) {
    errors.email = '邮箱不能为空'
    return false
  }

  const emailPattern = /^(?:[a-zA-Z0-9._%+-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/
  if (!emailPattern.test(value)) {
    errors.email = '请输入有效的邮箱地址'
    return false
  }

  return true
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }
  return '重置密码请求失败，请稍后重试'
}

async function onSubmit(): Promise<void> {
  if (!validate()) {
    return
  }

  isSubmitting.value = true
  const payload: ForgotPasswordPayload = { email: form.email.trim() }
  try {
    await requestPasswordReset(payload)
    isSubmitted.value = true
    toast.add({
      severity: 'success',
      summary: '请求已发送',
      detail: '请检查您的邮箱以获取密码重置链接。',
      life: 4000,
    })
  } catch (error: unknown) {
    const message = extractErrorMessage(error)
    toast.add({ severity: 'error', summary: '请求失败', detail: message, life: 4000 })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Toast />
  <FloatingConfigurator />
  <div
    class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden"
  >
    <div class="flex flex-col items-center justify-center">
      <div
        style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)"
      >
        <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
          <div class="text-center mb-8 flex flex-col items-center gap-4">
            <i class="pi pi-envelope text-4xl text-primary"></i>
            <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium">忘记密码</div>
            <span class="text-muted-color font-medium text-base max-w-[22rem]">
              输入您绑定的邮箱地址，我们将发送一封带有重置链接的邮件。
            </span>
          </div>

          <form @submit.prevent="onSubmit" class="flex flex-col">
            <label for="email" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">邮箱</label>
            <div class="mb-6 flex flex-col gap-2">
              <InputText
                id="email"
                v-model="form.email"
                type="email"
                placeholder="邮箱地址"
                class="w-full md:w-[30rem]"
                :invalid="!!errors.email"
                autocomplete="username"
                :disabled="isSubmitting"
              />
              <InlineMessage v-if="errors.email" severity="error">{{ errors.email }}</InlineMessage>
            </div>

            <Message v-if="isSubmitted" severity="success" class="mb-6">
              如果您提供的邮箱已注册，我们会在几分钟内发送重置密码邮件。
            </Message>

            <Button type="submit" label="发送重置链接" class="w-full" :loading="isSubmitting" :disabled="isSubmitting"></Button>
          </form>

          <div class="flex items-center justify-between mt-8">
            <Button as="router-link" to="/auth/login" label="返回登录" link class="px-0" />
            <span class="text-muted-color text-sm">遇到问题？请联系管理员</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
