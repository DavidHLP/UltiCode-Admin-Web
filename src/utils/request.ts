import router from '@/router/index'
import axios, {
    type AxiosError,
    AxiosHeaders,
    type AxiosInstance,
    type AxiosRequestConfig,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from 'axios'

interface ApiResponse<T = unknown> {
    code: number
    message?: string
    data: T
}

type RequestConfig = AxiosRequestConfig

const service: AxiosInstance = axios.create({
    baseURL: import.meta.env?.VITE_API_BASE_URL || '/',
    timeout: 50000,
})

service.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const authStore = useAuthStore()
        if (authStore.token) {
            const headers =
                config.headers instanceof AxiosHeaders
                    ? config.headers
                    : new AxiosHeaders(config.headers ?? {})

            headers.set('Authorization', `Bearer ${authStore.token}`)
            config.headers = headers
        }
        return config
    },
    (error) => {
        console.log(error)
        return Promise.reject(error)
    },
)

service.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
        const res = response.data
        if (res.code !== 200) {
            return Promise.reject(new Error(res.message || 'Error'))
        }
        return response
    },
    (error: AxiosError<{ message?: string }>) => {
        console.log('错误: ' + error)
        const status = error.response?.status
        const message = error.response?.data?.message || error.message || '请求失败'

        if (status === 401) {
            const authStore = useAuthStore()
            authStore.clearAuthData()
            const currentRoute = router.currentRoute.value
            if (currentRoute.name !== 'login') {
                const redirect = currentRoute.fullPath
                router.push({name: 'login', query: {redirect}}).catch(() => {
                })
            }
        }

        return Promise.reject(new Error(message))
    },
)

export function requestData<T = unknown>(config: RequestConfig): Promise<T> {
    return service.request<ApiResponse<T>>(config).then((response) => response.data.data as T)
}

export default service
