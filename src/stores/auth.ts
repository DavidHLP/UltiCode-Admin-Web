import type { LoginPayload, LoginResponse, LogoutPayload, UserInfo } from '@/api/auth'
import * as authApi from '@/api/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

interface StoredState {
  token: string | null
  user: UserInfo | null
}

interface LoginResult {
  success: boolean
  message: string
}

const getInitialState = (): StoredState => {
  const token = localStorage.getItem('token')
  const userString = localStorage.getItem('user')
  let user: UserInfo | null = null

  if (userString) {
    try {
      user = JSON.parse(userString) as UserInfo
    } catch (error) {
      console.warn('Failed to parse stored user info:', error)
    }
  }

  return { token, user }
}

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()
  const { token: initialToken, user: initialUser } = getInitialState()

  const token = ref<string | null>(initialToken)
  const user = ref<UserInfo | null>(initialUser)
  const isLoading = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value))
  const userRoles = computed(() => {
    const roleName = user.value?.role?.roleName
    return roleName ? [roleName] : []
  })

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setAuthData(newToken: string, newUser: UserInfo) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
  }

  function clearAuthData() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  async function login(loginData: LoginPayload, redirectPath?: string): Promise<LoginResult> {
    try {
      setLoading(true)
      const response: LoginResponse = await authApi.login(loginData)
      if (!response.token) {
        throw new Error('登录响应缺少凭据')
      }

      token.value = response.token
      localStorage.setItem('token', response.token)

      const userInfo = await authApi.getUserInfo()
      setAuthData(response.token, userInfo)

      const redirectFromQuery = router.currentRoute.value.query?.redirect
      const targetPath = redirectPath || (typeof redirectFromQuery === 'string' ? redirectFromQuery : undefined) || '/'
      await router.push(targetPath)

      return { success: true, message: '登录成功' }
    } catch (error) {
      console.error('登录失败:', error)
      clearAuthData()
      const fallbackMessage = '登录失败，请检查凭据'
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        (error as Error).message ||
        fallbackMessage

      return {
        success: false,
        message,
      }
    } finally {
      setLoading(false)
    }
  }

  async function logout(): Promise<void> {
    try {
      setLoading(true)
      if (token.value) {
        const payload: LogoutPayload = { token: token.value }
        await authApi.logout(payload).catch((error) => {
          console.warn('登出API调用失败，但将继续清除本地状态:', error)
        })
      }
    } finally {
      clearAuthData()
      setLoading(false)
      if (router.currentRoute.value.path !== '/login') {
        await router.push('/login')
      }
    }
  }

  function hasRole(role: string): boolean {
    return userRoles.value.includes(role)
  }

  return {
    token,
    user,
    isLoading,
    isAuthenticated,
    userRoles,
    login,
    logout,
    setAuthData,
    clearAuthData,
    setLoading,
    hasRole,
  }
})
