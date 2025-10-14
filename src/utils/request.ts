import router from '@/router/index'
import {useAuthStore} from '@/stores/auth'
import axios, {
    AxiosHeaders,
    type AxiosError,
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from 'axios'

export interface ApiResponse<T = unknown> {
    code?: number
    message?: string
    data?: T
}

export type RequestConfig = AxiosRequestConfig

const API_BASE_URL =
    import.meta.env?.VITE_API_BASE_URL ?? (import.meta.env?.DEV ? 'http://localhost:9999' : '/')

const service: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 50000,
})

service.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const authStore = useAuthStore()
        const authorization = authStore.authorizationHeader
        if (authorization) {
            const headers =
                config.headers instanceof AxiosHeaders
                    ? config.headers
                    : new AxiosHeaders(config.headers ?? {})

            headers.set('Authorization', authorization)
            config.headers = headers
        }
        return config
    },
    (error) => Promise.reject(error),
)

service.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
        const res = response.data
        if (
            typeof res === 'object' &&
            res !== null &&
            'code' in res &&
            res.code !== undefined &&
            res.code !== 200
        ) {
            return Promise.reject(new Error(res.message || '请求失败'))
        }
        return response
    },
    (error: AxiosError<{ message?: string }>) => {
        const status = error.response?.status
        const message = error.response?.data?.message || error.message || '请求失败'

        if (status === 401) {
            const authStore = useAuthStore()
            authStore.clearAuthData()
            const currentRoute = router.currentRoute.value
            if (currentRoute.name !== 'login') {
                const redirect = currentRoute.fullPath
                router
                    .push({name: 'login', query: {redirect}})
                    .catch(() => {
                        /* noop */
                    })
            }
        }

        return Promise.reject(new Error(message))
    },
)

export function unwrapResponse<T>(payload: unknown): T {
    if (payload && typeof payload === 'object' && 'data' in (payload as ApiResponse<T>)) {
        const wrapped = payload as ApiResponse<T>
        return (wrapped.data ?? (wrapped as unknown as T)) as T
    }
    return payload as T
}

export function requestData<T = unknown>(config: RequestConfig): Promise<T> {
    return service.request<ApiResponse<T> | T>(config).then((response) => unwrapResponse<T>(response.data))
}

export default service
