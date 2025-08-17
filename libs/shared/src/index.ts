// Shared types for photo management system
export * from "./types"

export interface OrderInfo {
  id: string
  customerEmail: string
  directoryPaths: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CacheStats {
  fileCount: number
  totalSizeMB: number
  maxSizeMB: number
  usagePercentage: number
  oldestFileAge: string
  hits: number
  misses: number
  hitRate: number
  timestamp: string
}

export interface TransferToken {
  token: string
  expiresAt: Date
  orderId: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  timestamp: string
}

export interface ErrorResponse {
  success: false
  error: string
  message: string
  statusCode: number
  timestamp: string
}

// Utility types
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// Constants
export const API_VERSIONS = {
  V1: "v1",
} as const

export const CACHE_CONSTANTS = {
  MAX_SIZE_MB: 5000,
  DEFAULT_TTL_HOURS: 24,
  CLEANUP_INTERVAL_SECONDS: 30,
} as const
