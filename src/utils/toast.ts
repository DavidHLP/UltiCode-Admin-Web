export interface ToastPayload {
  severity?: string
  summary?: string
  detail?: string
  life?: number
  [key: string]: unknown
}

type ToastListener = (payload: ToastPayload | ToastPayload[]) => void

const listeners = new Set<ToastListener>()

export function subscribeToast(listener: ToastListener) {
  if (typeof listener === 'function') {
    listeners.add(listener)
  }
}

export function unsubscribeToast(listener: ToastListener) {
  listeners.delete(listener)
}

export function emitToast(payload: ToastPayload | ToastPayload[] | null | undefined) {
  if (!payload) return
  listeners.forEach((listener) => {
    try {
      listener(payload)
    } catch (error) {
      console.error('Toast listener error:', error)
    }
  })
}

interface EmitToastOptions extends ToastPayload {
  summary?: string
  detail?: string
  life?: number
}

export function emitErrorToast(detail: string, options: EmitToastOptions = {}) {
  emitToast({
    severity: 'error',
    summary: options.summary || '错误',
    detail,
    life: options.life ?? 4000,
    ...options,
  })
}

export function emitSuccessToast(detail: string, options: EmitToastOptions = {}) {
  emitToast({
    severity: 'success',
    summary: options.summary || '成功',
    detail,
    life: options.life ?? 3000,
    ...options,
  })
}
