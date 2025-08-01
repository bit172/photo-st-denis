# Enhanced Cache System with Redis Integration

## 🚀 **How Redis Can Enhance Your Cache:**

### **1. Fast Cache Lookups**

```typescript
// Instead of filesystem checks, use Redis
const cacheExists = await redis.exists(`cache:${cacheKey}`)
if (cacheExists) {
  // Update access time and count
  await redis.hset(`cache:${cacheKey}:meta`, {
    lastAccess: Date.now(),
    accessCount: await redis.hincrby(`cache:${cacheKey}:meta`, 'accessCount', 1),
  })
  return zipPath
}
```

### **2. ZIP Generation Coordination**

```typescript
// Prevent duplicate generation across instances
const lockKey = `lock:generating:${cacheKey}`
const acquired = await redis.set(lockKey, 'locked', 'EX', 300, 'NX') // 5min lock

if (acquired) {
  // Generate ZIP
  await generateZipFile(...)

  // Store metadata
  await redis.hset(`cache:${cacheKey}:meta`, {
    size: zipSize,
    created: Date.now(),
    accessCount: 0,
    filePath: zipPath
  })

  // Set expiration for auto-cleanup
  await redis.expire(`cache:${cacheKey}:meta`, 24 * 60 * 60) // 24 hours

  await redis.del(lockKey)
}
```

### **3. Smart Pre-generation**

```typescript
// Track download patterns
await redis.zadd('popular:orders', Date.now(), orderKey)

// Get trending orders for pre-generation
const trending = await redis.zrevrange('popular:orders', 0, 19) // Top 20
```

### **4. Real-time Cache Statistics**

```typescript
// Fast stats without filesystem scanning
const cacheStats = {
  fileCount: await redis.scard('cache:files'),
  totalSize: await redis.get('cache:total:size'),
  hitRate: await redis.hget('cache:stats', 'hitRate'),
}
```

### **5. Intelligent Cache Eviction**

```typescript
// LRU eviction based on access patterns
const oldestFiles = await redis.zrange('cache:access:times', 0, 10)
// Remove oldest when size limit exceeded
```

## 🎯 **Benefits:**

- ✅ **10x Faster Lookups**: No filesystem I/O for cache checks
- ✅ **Distributed Safe**: Prevents duplicate work across instances
- ✅ **Smart Analytics**: Track usage patterns for better pre-generation
- ✅ **Real-time Stats**: Instant cache metrics without scanning
- ✅ **Auto-cleanup**: TTL-based expiration
- ✅ **Popular Content**: Pre-generate trending orders first

## 📦 **Implementation Plan:**

1. **Install NestJS Redis**: `npm install @liaoliaots/nestjs-redis ioredis` (most popular)
2. **Configure Redis Module**: Add to app.module.ts with proper DI
3. **Create Redis Service**: Use NestJS patterns with @Injectable()
4. **Gradual Migration**: Keep file-based cache, add Redis layer
5. **Monitor Performance**: Compare before/after metrics

## 🏗️ **Detailed Implementation Strategies:**

### **Strategy 1: Hybrid Layer (Recommended)**

```typescript
class HybridCacheService {
  // Keep existing file cache + add Redis metadata layer
  async getCachedZip(directoryPaths: string[]): Promise<string | null> {
    const cacheKey = this.generateCacheKey(directoryPaths)

    // 1. Check Redis first (fast memory lookup)
    const metadata = await this.redis.hgetall(`cache:${cacheKey}:meta`)
    if (!metadata.filePath) {
      return null // Definitely not cached
    }

    // 2. Verify file still exists (safety check)
    if (await this.fileExists(metadata.filePath)) {
      // 3. Update access tracking in Redis
      await this.updateAccessStats(cacheKey)
      return metadata.filePath
    } else {
      // 4. Clean up stale metadata
      await this.redis.del(`cache:${cacheKey}:meta`)
      return null
    }
  }
}
```

### **Strategy 2: Pure Redis Metadata**

```typescript
// Store everything in Redis, files still on disk
const cacheData = {
  filePath: '/tmp/photo-cache/abc123.zip',
  size: 524288000, // 500MB
  created: 1722377200000,
  lastAccess: 1722377200000,
  accessCount: 15,
  downloadCount: 8,
  customerEmails: ['user1@example.com', 'user2@example.com'],
}
```

### **Strategy 3: Smart Queue Management**

```typescript
// Priority queue for ZIP generation
await redis.zadd('zip:queue:priority', {
  high: orderKey1, // Recent orders
  medium: orderKey2, // Popular orders
  low: orderKey3, // Bulk pre-generation
})

// Worker picks highest priority
const nextOrder = await redis.zpopmax('zip:queue:priority')
```

## 🎯 **Advanced Use Cases:**

### **A. Customer Experience Enhancement**

```typescript
// Real-time progress tracking
await redis.hset(`progress:${orderId}`, {
  status: 'generating',
  progress: 45, // 45% complete
  eta: 120000, // 2 minutes remaining
  queuePosition: 3, // 3rd in queue
})

// WebSocket updates to customer
this.websocket.emit(`order:${orderId}:progress`, progress)
```

### **B. Analytics & Business Intelligence**

```typescript
// Track download patterns
const analytics = {
  // Most popular photo categories
  popularCategories: await redis.zrevrange('analytics:categories', 0, 9),

  // Peak download times
  peakHours: await redis.hgetall('analytics:download:hours'),

  // Customer retention (repeat downloads)
  repeatCustomers: await redis.scard('customers:repeat'),

  // Cache efficiency
  cacheHitRate: await redis.hget('metrics', 'hitRate'),

  // Storage trends
  storageTrend: await redis.lrange('metrics:storage:daily', 0, 29), // 30 days
}
```

### **C. Proactive Cache Management**

```typescript
// Predict which orders to pre-generate
async predictNextOrders(): Promise<string[]> {
  // 1. Recent similar orders by same customer
  const customerOrders = await redis.zrevrange(`customer:${email}:orders`, 0, 4)

  // 2. Trending photo locations/events
  const trendingEvents = await redis.zrevrange('trending:events', 0, 9)

  // 3. Seasonal patterns (holidays, weekends)
  const seasonalPredictions = await this.getSeasonalPredictions()

  return [...customerOrders, ...trendingEvents, ...seasonalPredictions]
}
```

### **D. Multi-Instance Coordination**

```typescript
// Distribute work across multiple servers
class DistributedCacheManager {
  async claimWork(): Promise<string[]> {
    const serverId = process.env.SERVER_ID
    const workBatch = await redis.lpop('work:queue', 5) // Claim 5 jobs

    if (workBatch.length > 0) {
      // Register claimed work
      await redis.sadd(`work:claimed:${serverId}`, ...workBatch)

      // Set timeout for work (auto-release if server dies)
      await redis.expire(`work:claimed:${serverId}`, 300) // 5 minutes
    }

    return workBatch
  }

  async completeWork(workId: string): Promise<void> {
    const serverId = process.env.SERVER_ID
    await redis.srem(`work:claimed:${serverId}`, workId)
    await redis.sadd('work:completed', workId)
  }
}
```

## 🚨 **Error Handling & Resilience:**

### **Redis Connection Issues**

```typescript
class ResilientCacheService {
  async getCachedZip(directoryPaths: string[]): Promise<string | null> {
    try {
      // Try Redis first
      return await this.getFromRedis(directoryPaths)
    } catch (redisError) {
      this.logger.warn('Redis unavailable, falling back to filesystem', redisError)

      // Fallback to current file-based system
      return await this.getFromFilesystem(directoryPaths)
    }
  }

  // Background sync when Redis comes back online
  async syncMetadataToRedis(): Promise<void> {
    const files = await this.getZipFiles()
    for (const file of files) {
      const stats = await fs.promises.stat(file)
      await redis.hset(`cache:${this.getCacheKeyFromPath(file)}:meta`, {
        filePath: file,
        size: stats.size,
        created: stats.birthtime.getTime(),
        lastAccess: stats.atime.getTime(),
      })
    }
  }
}
```

## 📊 **Performance Monitoring:**

### **Key Metrics to Track**

```typescript
interface CacheMetrics {
  // Performance
  avgLookupTime: number // ms
  avgGenerationTime: number // ms
  cacheHitRate: number // %

  // Usage
  dailyDownloads: number
  uniqueCustomers: number
  repeatCustomers: number

  // Storage
  totalCacheSize: number // MB
  fileCount: number
  avgFileSize: number // MB

  // System
  redisMemoryUsage: number // MB
  diskIOReduction: number // %
  serverLoadReduction: number // %
}

// Real-time dashboard data
await redis.hset('metrics:realtime', {
  activeDownloads: activeCount,
  queueSize: await redis.llen('zip:queue'),
  cacheUtilization: (usedCache / maxCache) * 100,
  errorRate: (errors / total) * 100,
})
```

## 🎮 **Migration Strategy:**

### **Phase 1: Add Redis Layer (Week 1)**

- Install and configure Redis
- Add metadata tracking alongside existing system
- No behavior changes, just data collection

### **Phase 2: Hybrid Lookups (Week 2)**

- Use Redis for fast cache existence checks
- Keep filesystem as source of truth
- Measure performance improvements

### **Phase 3: Smart Features (Week 3)**

- Add popularity tracking
- Implement smart pre-generation
- Add real-time progress tracking

### **Phase 4: Advanced Analytics (Week 4)**

- Business intelligence dashboard
- Predictive pre-generation
- Multi-instance coordination

## ⚡ **Quick Performance Wins for Single Machine:**

### **1. Fast Cache Lookups (BIGGEST WIN)**

```typescript
// Current: filesystem check takes 1-5ms
const exists = await fs.promises.access(zipPath)

// With Redis: memory lookup takes 0.1ms (10-50x faster!)
const exists = await redis.exists(`cache:${cacheKey}`)
```

### **2. Avoid Duplicate Generation**

```typescript
// Prevent generating same ZIP twice simultaneously
async generateWithLock(cacheKey: string): Promise<void> {
  const lockKey = `generating:${cacheKey}`
  const acquired = await redis.set(lockKey, '1', 'EX', 300, 'NX') // 5min lock

  if (!acquired) {
    // Already being generated, wait for completion
    await this.waitForGeneration(cacheKey)
    return
  }

  try {
    await this.generateZipFile(...)
    await redis.set(`cache:${cacheKey}`, zipPath, 'EX', 86400) // 24h TTL
  } finally {
    await redis.del(lockKey)
  }
}
```

### **3. Simple Statistics (No Filesystem Scanning)**

```typescript
// Instead of scanning /tmp/photo-cache directory
async getCacheStats(): Promise<CacheStats> {
  const [fileCount, totalSize, hitCount, missCount] = await redis.mget([
    'stats:fileCount',
    'stats:totalSize',
    'stats:hits',
    'stats:misses'
  ])

  const hitRate = hitCount / (hitCount + missCount) * 100

  return {
    fileCount: parseInt(fileCount) || 0,
    totalSizeMB: parseInt(totalSize) || 0,
    hitRate: Math.round(hitRate)
  }
}
```

### **4. Automatic TTL Cleanup**

```typescript
// Let Redis handle expiration instead of cron jobs
await redis.setex(`cache:${cacheKey}`, 86400, zipPath) // Auto-expire in 24h

// Clean up corresponding files when Redis keys expire
await redis.setex(`cleanup:${cacheKey}`, 86400, zipPath)
```

## 🚀 **NestJS Cache Manager + Keyv Implementation (15 minutes setup):**

### **Install & Configure**

```bash
# Install NestJS Cache Manager with Keyv store
npm install @nestjs/cache-manager cache-manager keyv @keyv/redis

# Redis already running in your docker-compose.yaml!
docker-compose up -d redis
```

### **Configure App Module**

```typescript
// app.module.ts
import { CacheModule } from '@nestjs/cache-manager'
import Keyv from 'keyv'

// Custom Keyv store for cache-manager
const keyvStore = {
  name: 'keyv',
  create: (args: any) => {
    const keyv = new Keyv('redis://localhost:6379', {
      ttl: args.ttl || 24 * 60 * 60 * 1000, // 24 hours default
      namespace: args.namespace || 'cache',
    })

    return {
      get: (key: string) => keyv.get(key),
      set: (key: string, value: any, ttl?: number) => keyv.set(key, value, ttl),
      del: (key: string) => keyv.delete(key),
      reset: () => keyv.clear(),
      keys: () => keyv.iterator().next(),
    }
  },
}

@Module({
  imports: [
    // ... existing modules
    CacheModule.register({
      isGlobal: true, // Available everywhere
      store: keyvStore,
      ttl: 24 * 60 * 60 * 1000, // 24 hours default TTL
      namespace: 'photo-cache',
    }),
  ],
})
export class AppModule {}
```

### **Simple Cache Integration**

```typescript
// In your existing SimpleCacheService
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'

@Injectable()
export class SimpleCacheService {
  constructor(
    // ... existing dependencies
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getCachedZip(directoryPaths: string[]): Promise<string | null> {
    const cacheKey = this.generateCacheKey(directoryPaths)

    // Check cache first (NestJS + Keyv power!)
    const cached = await this.cacheManager.get<string>(cacheKey)
    if (cached) {
      // Verify file still exists
      if (await this.fileExists(cached)) {
        await this.incrementStat('hits')
        return cached
      } else {
        // Clean up stale entry
        await this.cacheManager.del(cacheKey)
      }
    }

    await this.incrementStat('misses')
    return null
  }

  async generateZipFile(directoryPaths: string[], outputPath: string): Promise<void> {
    const cacheKey = this.generateCacheKey(directoryPaths)

    // Check if already generating (simple lock)
    const lockKey = `generating:${cacheKey}`
    const isGenerating = await this.cacheManager.get(lockKey)
    if (isGenerating) {
      await this.waitForGeneration(cacheKey)
      return
    }

    // Set generation lock
    await this.cacheManager.set(lockKey, 'true', 5 * 60 * 1000) // 5 min lock

    try {
      // ... existing generation logic ...

      // Cache the result (uses default 24h TTL)
      await this.cacheManager.set(cacheKey, outputPath)
      await this.incrementStat('fileCount')

      this.logger.log(`Generated and cached: ${outputPath}`)
    } finally {
      await this.cacheManager.del(lockKey)
    }
  }

  // Simple stats helpers
  private async incrementStat(key: string): Promise<void> {
    const statsKey = `stats:${key}`
    const current = (await this.cacheManager.get<number>(statsKey)) || 0
    await this.cacheManager.set(statsKey, current + 1, 0) // No expiry for stats
  }

  async getCacheStats(): Promise<CacheStats> {
    const [hits, misses, fileCount] = await Promise.all([
      this.cacheManager.get<number>('stats:hits') || 0,
      this.cacheManager.get<number>('stats:misses') || 0,
      this.cacheManager.get<number>('stats:fileCount') || 0,
    ])

    const hitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0

    return {
      fileCount,
      hitRate: Math.round(hitRate),
      // For size, fall back to filesystem if needed
      totalSizeMB: await this.getActualCacheSizeMB(),
      maxSizeMB: this.maxCacheSizeMB,
    }
  }
}
```

### **Advanced NestJS Cache Features**

```typescript
// Automatic caching with decorators
@Controller('transfer')
export class TransferController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  // Automatically cache download metadata
  @Get('download/:token')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600) // 1 hour cache
  async downloadZip(@Param('token') token: string) {
    // Your existing download logic - automatically cached!
    return this.transferService.getDownloadInfo(token)
  }

  // Cache statistics endpoint
  @Get('cache/stats')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60) // 1 minute cache
  async getCacheStats() {
    return this.simpleCacheService.getCacheStats()
  }

  // Manual cache operations
  @Delete('cache/:key')
  async clearCacheKey(@Param('key') key: string) {
    await this.cacheManager.del(key)
    return { message: `Cache key ${key} cleared` }
  }

  @Delete('cache')
  async clearAllCache() {
    await this.cacheManager.reset()
    return { message: 'All cache cleared' }
  }
}

// Use cache in services with decorators
@Injectable()
export class OrderService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @CacheKey('recent-orders')
  @CacheTTL(300) // 5 minutes
  async findRecentOrders(): Promise<Order[]> {
    // This will be automatically cached
    return this.orderRepository.findRecentOrders()
  }
}
```

```

```

## 📈 **Expected Performance Gains:**

- ✅ **Cache Lookups**: 10-50x faster (5ms → 0.1ms) with Redis backend
- ✅ **Zero Duplicate Work**: Simple Redis-based locks
- ✅ **Built-in TTL**: Automatic expiration handling
- ✅ **NestJS Integration**: Decorators, interceptors, and familiar patterns
- ✅ **Keyv Benefits**: Automatic serialization, TypeScript support, stability
- ✅ **Automatic API Caching**: Use `@UseInterceptors(CacheInterceptor)` on endpoints
- ✅ **Memory Usage**: Minimal - just stores file paths, not content

## 🎯 **Implementation Priority:**

1. **Install packages** (2 min) - `npm install @nestjs/cache-manager cache-manager keyv @keyv/redis`
2. **Configure CacheModule** (5 min) - Custom Keyv store setup
3. **Update SimpleCacheService** (10 min) - Inject CACHE_MANAGER and use
4. **Add cache decorators** (8 min) - Optional automatic endpoint caching

**Total Setup Time: ~25 minutes for full NestJS + Keyv power!**

Would you like me to implement this simple, high-impact version?
