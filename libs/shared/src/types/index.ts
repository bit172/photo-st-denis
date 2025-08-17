export interface TokenMetadata {
  token: string
  hash: string
  createdAt: Date
  expiresAt: Date
  isExpired: boolean
}

export interface AssociateRequest {
  email: string
  directoryPaths: string[]
}

export interface DownloadResponse {
  token: string
  downloadUrl: string
  expiresAt: Date
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface CacheStats {
  totalSize: number
  itemCount: number
  hitRate: number
  maxSize: number
}
