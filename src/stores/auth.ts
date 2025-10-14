import {
  fetchProfile,
  login as loginRequest,
  refreshToken as refreshTokenRequest,
  register as registerRequest,
  type AuthResponse,
  type LoginPayload,
  type RegisterPayload,
  type UserProfile,
} from '@/api/auth/auth'
import { defineStore } from 'pinia'

interface AuthState {
  tokenType: string | null
  accessToken: string | null
  refreshToken: string | null
  accessTokenExpiresAt: number | null
  refreshTokenExpiresAt: number | null
  user: UserProfile | null
}

interface StoredAuthState extends AuthState {}

const STORAGE_KEY = 'admin-console-auth'

function now(): number {
  return Date.now()
}

function loadFromStorage(): Partial<StoredAuthState> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    return JSON.parse(raw) as StoredAuthState
  } catch (error) {
    console.warn('[auth] Failed to parse stored auth state:', error)
    return {}
  }
}

function persistState(state: StoredAuthState | null): void {
  if (typeof window === 'undefined') {
    return
  }
  if (!state) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function calculateExpiry(seconds: number | null | undefined): number | null {
  if (!seconds || seconds <= 0) {
    return null
  }
  return now() + seconds * 1000
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => {
    const persisted = loadFromStorage()
    return {
      tokenType: persisted.tokenType ?? null,
      accessToken: persisted.accessToken ?? null,
      refreshToken: persisted.refreshToken ?? null,
      accessTokenExpiresAt: persisted.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: persisted.refreshTokenExpiresAt ?? null,
      user: persisted.user ?? null,
    }
  },
  getters: {
    isAuthenticated(state): boolean {
      if (!state.accessToken) {
        return false
      }
      if (state.accessTokenExpiresAt && state.accessTokenExpiresAt <= now()) {
        return false
      }
      return true
    },
    authorizationHeader(state): string | null {
      if (!state.accessToken) {
        return null
      }
      return `${state.tokenType ?? 'Bearer'} ${state.accessToken}`
    },
  },
  actions: {
    applyAuthResponse(response: AuthResponse) {
      this.tokenType = response.tokenType
      this.accessToken = response.accessToken
      this.refreshToken = response.refreshToken
      this.accessTokenExpiresAt = calculateExpiry(response.accessTokenExpiresIn)
      this.refreshTokenExpiresAt = calculateExpiry(response.refreshTokenExpiresIn)
      this.user = response.user
      this.persist()
    },
    setUser(user: UserProfile) {
      this.user = user
      this.persist()
    },
    clearAuthData() {
      this.tokenType = null
      this.accessToken = null
      this.refreshToken = null
      this.accessTokenExpiresAt = null
      this.refreshTokenExpiresAt = null
      this.user = null
      persistState(null)
    },
    persist() {
      const state: StoredAuthState = {
        tokenType: this.tokenType,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        accessTokenExpiresAt: this.accessTokenExpiresAt,
        refreshTokenExpiresAt: this.refreshTokenExpiresAt,
        user: this.user,
      }
      persistState(state)
    },
    async login(payload: LoginPayload) {
      const response = await loginRequest(payload)
      this.applyAuthResponse(response)
      return response.user
    },
    async register(payload: RegisterPayload) {
      const response = await registerRequest(payload)
      this.applyAuthResponse(response)
      return response.user
    },
    async refresh() {
      if (!this.refreshToken) {
        throw new Error('没有可用的刷新令牌')
      }
      const response = await refreshTokenRequest({ refreshToken: this.refreshToken })
      this.applyAuthResponse(response)
      return response.user
    },
    async loadProfile() {
      const profile = await fetchProfile()
      this.setUser(profile)
      return profile
    },
  },
})
