import { Injectable, Logger, Inject } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { OrderService } from '../../order/order.service'
import { FileProcessingService } from './file-processing.service'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ==========================================
// INTERFACES
// ==========================================

interface CacheFileInfo {
  name: string
  path: string
  size: number
  mtime: number
}

interface CacheStats {
  fileCount: number
  totalSizeMB: number
  maxSizeMB: number
  usagePercentage: number
  oldestFileAge: string
  hits: number
  misses: number
  hitRate: number
}

interface CacheFlushResult {
  deletedFiles: number
  totalSizeMB: number
}

// ==========================================
// SIMPLE CACHE SERVICE
// ==========================================

/**
 * SimpleCacheService provides intelligent ZIP file caching for photo orders.
 *
 * Features:
 * - Automatic pre-generation of ZIP files for recent orders
 * - 5GB cache size limit with oldest-first eviction
 * - Daily maintenance and cleanup
 * - Manual cache management via API
 * - Comprehensive statistics and monitoring
 */

@Injectable()
export class SimpleCacheService {
  private readonly logger = new Logger(SimpleCacheService.name)

  // ==========================================
  // CONFIGURATION
  // ==========================================

  private readonly cacheDirectory = '/tmp/photo-cache'
  private readonly maxCacheSizeMB = 5000 // 5GB cache limit
  private readonly maxRecentOrders = 20
  private readonly maxCacheAgeHours = 24

  constructor(
    private readonly orderService: OrderService,
    private readonly fileProcessingService: FileProcessingService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    // Initialize cache directory asynchronously
    this.ensureCacheDirectory().catch((error) => {
      this.logger.error('Failed to initialize cache directory:', error)
    })
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.cacheDirectory, { recursive: true })
      this.logger.log(`Cache directory ensured: ${this.cacheDirectory}`)
    } catch (error) {
      this.logger.error('Failed to create cache directory:', error.message)
    }
  }

  // ==========================================
  // SCHEDULED TASKS
  // ==========================================

  /**
   * Pre-generates ZIP files for recent orders every 30 seconds.
   * Automatically enforces cache size limits after each generation.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async preGenerateZips(): Promise<void> {
    this.logger.log('Starting pre-generation of ZIP files for recent orders')

    try {
      const recentOrders = await this.orderService.findRecentOrders(this.maxRecentOrders)
      let processedCount = 0
      let skippedCount = 0

      for (const order of recentOrders) {
        try {
          const zipPath = this.getZipPath(order.directoryPaths)

          if (await this.fileExists(zipPath)) {
            skippedCount++
            continue
          }

          this.logger.log(`Pre-generating ZIP for order: ${order.customerEmail}`)
          await this.generateZipFile(order.directoryPaths, zipPath)
          await this.enforceMaxCacheSize()
          processedCount++
        } catch (error) {
          this.logger.error(
            `Failed to pre-generate ZIP for order ${order.customerEmail}:`,
            error.message,
          )
        }
      }

      this.logger.log(
        `Pre-generation completed: ${processedCount} generated, ${skippedCount} skipped`,
      )
    } catch (error) {
      this.logger.error('Pre-generation failed:', error.message)
    }
  }

  /**
   * Daily maintenance: cleanup old files and enforce size limits.
   * Runs every day at 3 AM to remove files older than 24 hours.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async performDailyMaintenance(): Promise<void> {
    this.logger.log('Starting scheduled daily cache maintenance')

    try {
      const maxAgeMs = this.maxCacheAgeHours * 60 * 60 * 1000
      const ageResult = await this.flushCacheOlderThan(maxAgeMs)
      await this.enforceMaxCacheSize()

      this.logger.log(
        `Daily maintenance completed: ${ageResult.deletedFiles} old files removed (${ageResult.totalSizeMB}MB)`,
      )
    } catch (error) {
      this.logger.error('Daily maintenance failed:', error.message)
    }
  }

  // ==========================================
  // PUBLIC API METHODS
  // ==========================================

  /**
   * Get cached ZIP file path if it exists.
   * Fast memory cache lookup with filesystem fallback.
   * @param directoryPaths - Array of directory paths to check for cached ZIP
   * @returns Path to cached ZIP file or null if not found
   */
  async getCachedZip(directoryPaths: string[]): Promise<string | null> {
    const cacheKey = this.generateCacheKey(directoryPaths)
    const zipPath = this.getZipPath(directoryPaths)

    try {
      // Fast memory cache lookup first (10-50x faster than filesystem)
      const cached = await this.cacheManager.get<string>(cacheKey)
      if (cached) {
        // Verify file still exists (safety check)
        if (await this.fileExists(cached)) {
          await this.incrementStat('hits')
          this.logger.log(`Cache hit (memory) for directories: ${directoryPaths.join(', ')}`)
          return cached
        } else {
          // File was deleted, clean up stale cache entry
          await this.cacheManager.del(cacheKey)
          this.logger.warn(`Stale cache entry removed for: ${directoryPaths.join(', ')}`)
        }
      }

      // Fallback to filesystem check
      if (await this.fileExists(zipPath)) {
        // File exists but not in cache, update cache
        await this.cacheManager.set(cacheKey, zipPath)
        await this.incrementStat('hits')
        this.logger.log(`Cache hit (filesystem) for directories: ${directoryPaths.join(', ')}`)
        return zipPath
      }

      await this.incrementStat('misses')
      this.logger.debug(`Cache miss for directories: ${directoryPaths.join(', ')}`)
      return null
    } catch (error) {
      // Cache error, fallback to filesystem only
      this.logger.warn('Cache error, falling back to filesystem', error.message)

      if (await this.fileExists(zipPath)) {
        this.logger.log(
          `Cache hit (filesystem fallback) for directories: ${directoryPaths.join(', ')}`,
        )
        return zipPath
      }

      this.logger.debug(
        `Cache miss (filesystem fallback) for directories: ${directoryPaths.join(', ')}`,
      )
      return null
    }
  }

  /**
   * Increment cache statistics using memory cache.
   * @param statType - Type of stat to increment ('hits' or 'misses')
   */
  private async incrementStat(statType: 'hits' | 'misses'): Promise<void> {
    try {
      const key = `cache:stats:${statType}`
      const current = (await this.cacheManager.get<number>(key)) || 0
      await this.cacheManager.set(key, current + 1, 0) // 0 = no TTL for stats
      this.logger.debug(`✅ Cache operation successful: ${key} = ${current + 1}`)
    } catch (error) {
      // Stats are non-critical, log but don't throw
      this.logger.warn(`❌ Failed to increment ${statType} stat:`, error.message)
    }
  }

  /**
   * Get cache hit/miss statistics from memory cache.
   * @returns Object with hits, misses, and hit rate
   */
  private async getCacheMetrics(): Promise<{ hits: number; misses: number; hitRate: number }> {
    try {
      const hits = (await this.cacheManager.get<number>('cache:stats:hits')) || 0
      const misses = (await this.cacheManager.get<number>('cache:stats:misses')) || 0
      const total = hits + misses
      const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0

      return { hits, misses, hitRate }
    } catch (error) {
      this.logger.debug('Failed to get cache metrics:', error.message)
      return { hits: 0, misses: 0, hitRate: 0 }
    }
  }

  /**
   * Clear all cache entries and statistics.
   * Used during cache flush operations.
   */
  private async clearAllRedisCache(): Promise<void> {
    try {
      // Clear cache statistics
      await this.cacheManager.del('cache:stats:hits')
      await this.cacheManager.del('cache:stats:misses')

      // Note: Since cache-manager doesn't expose a pattern delete,
      // we rely on TTL for ZIP path cache entries to expire naturally.
      // For complete cleanup, individual entries are removed when files are deleted.

      this.logger.debug('Cache statistics cleared')
    } catch (error) {
      this.logger.warn('Failed to clear cache:', error.message)
    }
  }

  /**
   * Get comprehensive cache statistics including usage percentage and file ages.
   * @returns Detailed cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const zipFiles = await this.getZipFiles()
      let totalSize = 0
      let oldestTime = Date.now()

      for (const file of zipFiles) {
        try {
          const filePath = path.join(this.cacheDirectory, file)
          const stats = await fs.promises.stat(filePath)
          totalSize += stats.size

          if (stats.mtime.getTime() < oldestTime) {
            oldestTime = stats.mtime.getTime()
          }
        } catch (error) {
          this.logger.warn(`Failed to stat cache file ${file}:`, error.message)
        }
      }

      const totalSizeMB = this.bytesToMB(totalSize)
      const ageHours =
        zipFiles.length > 0 ? Math.round((Date.now() - oldestTime) / (60 * 60 * 1000)) : 0
      const oldestFileAge = zipFiles.length > 0 ? `${ageHours}h ago` : 'No files'
      const usagePercentage = Math.round((totalSizeMB / this.maxCacheSizeMB) * 100)

      // Get memory cache metrics
      const metrics = await this.getCacheMetrics()

      return {
        fileCount: zipFiles.length,
        totalSizeMB,
        maxSizeMB: this.maxCacheSizeMB,
        usagePercentage,
        oldestFileAge,
        hits: metrics.hits,
        misses: metrics.misses,
        hitRate: metrics.hitRate,
      }
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error.message)
      return this.getErrorCacheStats()
    }
  }

  // ==========================================
  // CACHE MANAGEMENT METHODS
  // ==========================================

  /**
   * Manually flush all cache files.
   * @returns Summary of deletion operation
   */
  async flushAllCache(): Promise<CacheFlushResult> {
    this.logger.log('Starting manual cache flush (all files)')

    try {
      const zipFiles = await this.getZipFiles()
      let totalSize = 0
      let deletedCount = 0

      for (const file of zipFiles) {
        try {
          const filePath = path.join(this.cacheDirectory, file)
          const stats = await fs.promises.stat(filePath)
          totalSize += stats.size

          await fs.promises.unlink(filePath)
          deletedCount++
        } catch (error) {
          this.logger.warn(`Failed to delete cache file ${file}:`, error.message)
        }
      }

      // Clear all cache entries and stats
      await this.clearAllRedisCache()

      const totalSizeMB = this.bytesToMB(totalSize)
      this.logger.log(
        `Manual cache flush completed: ${deletedCount} files deleted, ${totalSizeMB}MB freed, cache cleared`,
      )

      return { deletedFiles: deletedCount, totalSizeMB }
    } catch (error) {
      this.logger.error('Manual cache flush failed:', error.message)
      throw error
    }
  }

  /**
   * Flush cache files older than specified age.
   * @param ageInMs - Maximum age in milliseconds
   * @returns Summary of deletion operation
   */
  async flushCacheOlderThan(ageInMs: number): Promise<CacheFlushResult> {
    const cutoffTime = Date.now() - ageInMs
    const ageHours = Math.round(ageInMs / (60 * 60 * 1000))

    try {
      const zipFiles = await this.getZipFiles()
      let totalSize = 0
      let deletedCount = 0

      for (const file of zipFiles) {
        try {
          const filePath = path.join(this.cacheDirectory, file)
          const stats = await fs.promises.stat(filePath)

          if (stats.mtime.getTime() < cutoffTime) {
            totalSize += stats.size
            await fs.promises.unlink(filePath)
            deletedCount++
          }
        } catch (error) {
          this.logger.warn(`Failed to process cache file ${file}:`, error.message)
        }
      }

      const totalSizeMB = this.bytesToMB(totalSize)
      this.logger.log(
        `Cache cleanup completed: ${deletedCount} files older than ${ageHours}h deleted, ${totalSizeMB}MB freed`,
      )

      return { deletedFiles: deletedCount, totalSizeMB }
    } catch (error) {
      this.logger.error('Cache cleanup failed:', error.message)
      throw error
    }
  }

  // ==========================================
  // SIZE ENFORCEMENT
  // ==========================================

  /**
   * Enforce maximum cache size by removing oldest files when limit is exceeded
   */
  private async enforceMaxCacheSize(): Promise<void> {
    try {
      const fileInfos = await this.getCacheFileInfos()
      const totalSize = fileInfos.reduce((sum, file) => sum + file.size, 0)
      const totalSizeMB = this.bytesToMB(totalSize)

      if (totalSizeMB <= this.maxCacheSizeMB) {
        return
      }

      this.logger.log(
        `Cache size ${Math.round(totalSizeMB)}MB exceeds limit ${this.maxCacheSizeMB}MB, cleaning up oldest files`,
      )

      // Sort by modification time (oldest first)
      fileInfos.sort((a, b) => a.mtime - b.mtime)

      let deletedCount = 0
      let freedSizeMB = 0
      let remainingSize = totalSize

      for (const fileInfo of fileInfos) {
        try {
          await fs.promises.unlink(fileInfo.path)
          remainingSize -= fileInfo.size
          freedSizeMB += this.bytesToMB(fileInfo.size)
          deletedCount++

          if (this.bytesToMB(remainingSize) <= this.maxCacheSizeMB) {
            break
          }
        } catch (error) {
          this.logger.warn(`Failed to delete cache file ${fileInfo.name}:`, error.message)
        }
      }

      this.logger.log(
        `Cache size enforcement completed: ${deletedCount} files deleted, ${Math.round(freedSizeMB)}MB freed`,
      )
    } catch (error) {
      this.logger.error('Cache size enforcement failed:', error.message)
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Get ZIP file path for given directory paths.
   * @param directoryPaths - Array of directory paths
   * @returns Full path to the ZIP file
   */
  private getZipPath(directoryPaths: string[]): string {
    const cacheKey = this.generateCacheKey(directoryPaths)
    return path.join(this.cacheDirectory, `${cacheKey}.zip`)
  }

  /**
   * Get all ZIP files in cache directory.
   * @returns Array of ZIP file names
   */
  private async getZipFiles(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.cacheDirectory)
      return files.filter((file) => file.endsWith('.zip'))
    } catch (error) {
      this.logger.warn('Failed to read cache directory:', error.message)
      return []
    }
  }

  /**
   * Get detailed information about all cache files.
   * @returns Array of cache file information
   */
  private async getCacheFileInfos(): Promise<CacheFileInfo[]> {
    const zipFiles = await this.getZipFiles()
    const fileInfos: CacheFileInfo[] = []

    for (const file of zipFiles) {
      try {
        const filePath = path.join(this.cacheDirectory, file)
        const stats = await fs.promises.stat(filePath)
        fileInfos.push({
          name: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime.getTime(),
        })
      } catch (error) {
        this.logger.warn(`Failed to stat cache file ${file}:`, error.message)
      }
    }

    return fileInfos
  }

  /**
   * Convert bytes to megabytes with precision.
   * @param bytes - Size in bytes
   * @returns Size in megabytes rounded to 2 decimal places
   */
  private bytesToMB(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100
  }

  /**
   * Generate cache key from directory paths.
   * Creates a SHA256 hash from sorted directory paths for consistent caching.
   * @param directoryPaths - Array of directory paths
   * @returns 16-character hexadecimal cache key
   */
  private generateCacheKey(directoryPaths: string[]): string {
    const sorted = [...directoryPaths].sort()
    const combined = sorted.join('|')
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16)
  }

  /**
   * Get error fallback for cache stats.
   * @returns Default cache stats object for error cases
   */
  private getErrorCacheStats(): CacheStats {
    return {
      fileCount: 0,
      totalSizeMB: 0,
      maxSizeMB: this.maxCacheSizeMB,
      usagePercentage: 0,
      oldestFileAge: 'Error',
      hits: 0,
      misses: 0,
      hitRate: 0,
    }
  }

  /**
   * Check if file exists.
   * @param filePath - Path to file to check
   * @returns True if file exists, false otherwise
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath)
      return true
    } catch {
      return false
    }
  }

  // ==========================================
  // ZIP GENERATION
  // ==========================================

  /**
   * Generate ZIP file for given directories.
   * Uses streaming to handle large files efficiently.
   * @param directoryPaths - Array of directory paths to include
   * @param outputPath - Path where ZIP file should be created
   */
  private async generateZipFile(directoryPaths: string[], outputPath: string): Promise<void> {
    const tempPath = `${outputPath}.tmp`
    const stream = fs.createWriteStream(tempPath)

    return new Promise((resolve, reject) => {
      const passThrough = require('stream').PassThrough()
      const zipArchiver = this.fileProcessingService.createZipArchiver(passThrough)

      passThrough.pipe(stream)

      stream.on('finish', async () => {
        try {
          await fs.promises.rename(tempPath, outputPath)

          // Add to cache for fast lookups
          const cacheKey = this.generateCacheKey(directoryPaths)
          await this.cacheManager.set(cacheKey, outputPath)

          this.logger.log(`ZIP file generated and cached: ${outputPath}`)
          resolve()
        } catch (error) {
          reject(error)
        }
      })

      stream.on('error', (error) => {
        this.logger.error(`ZIP stream error: ${error.message}`)
        reject(error)
      })

      this.fileProcessingService
        .processDirectoriesAsync(directoryPaths, zipArchiver, passThrough)
        .catch(reject)
    })
  }
}
