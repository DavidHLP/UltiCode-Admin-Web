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

export interface ApiError {
    status: number
    code: string
    message: string
    details?: Record<string, unknown>
}

export interface ApiResponse<T = unknown> {
    isSuccess: boolean
    data?: T
    error?: ApiError | null
    timestamp?: string
    metadata?: Record<string, unknown>
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

function isApiResponse<T = unknown>(payload: unknown): payload is ApiResponse<T> {
    if (typeof payload !== 'object' || payload === null) {
        return false
    }
    const record = payload as Record<string, unknown>
    return 'isSuccess' in record && typeof record.isSuccess === 'boolean'
}

service.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
        const res = response.data
        if (isApiResponse(res) && !res.isSuccess) {
            const message = res.error?.message ?? '请求失败'
            const rejection = new Error(message)
            Object.assign(rejection, {apiError: res.error, metadata: res.metadata})
            return Promise.reject(rejection)
        }
        return response
    },
    (error: AxiosError<ApiResponse | { message?: string }>) => {
        const status = error.response?.status
        const responseData = error.response?.data
        let messageFromResponse: string | undefined
        if (isApiResponse(responseData)) {
            messageFromResponse = responseData.error?.message
        } else if (responseData && typeof responseData === 'object' && 'message' in responseData) {
            messageFromResponse = (responseData as { message?: string }).message
        }
        const fallbackMessage = messageFromResponse ?? error.message ?? '请求失败'

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

        return Promise.reject(new Error(fallbackMessage))
    },
)

export function unwrapResponse<T>(payload: unknown): T {
    if (isApiResponse<T>(payload)) {
        const wrapped = payload
        return (wrapped.data ?? (wrapped as unknown as T)) as T
    }
    return payload as T
}

export function requestData<T = unknown>(config: RequestConfig): Promise<T> {
    return service
        .request<ApiResponse<T> | T>(config)
        .then((response) => unwrapResponse<T>(response.data))
}

export default service
