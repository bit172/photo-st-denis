# Simple ZIP Caching System

## How It Works (Dead Simple!):

### 🔄 **Background Cron Jobs**

```typescript
@Cron(CronExpression.EVERY_30_SECONDS)
async preGenerateZips() {
  // 1. Get last 20 orders from database
  // 2. For each order, check if ZIP exists in /tmp/photo-cache
  // 3. If not, generate it and save to cache
  // 4. Done!
}

@Cron(CronExpression.EVERY_DAY_AT_3AM)
async flushOldCache() {
  // Remove cache files older than 24 hours
}
```

### ⚡ **Smart Download Logic**

```typescript
async download(token) {
  // 1. Check if cached ZIP exists for this order's directories
  // 2. If YES: Stream cached file (instant!)
  // 3. If NO: Generate real-time (2-4 seconds)
}
```

### 🧹 **Cache Management**

```typescript
// Manual cache management
await flushAllCache()              // Delete all cache files
await flushCacheOlderThan(24h)     // Delete files older than 24 hours
await getCacheStats()              // Get file count, size, oldest file age
```

## API Endpoints:

### **Download:**

- `POST /v1/transfer/associate` - Create download order
- `GET /v1/transfer/download/:token` - Download photos as ZIP

### **Cache Management:**

- `GET /v1/transfer/cache/stats` - View cache statistics
- `POST /v1/transfer/cache/flush` - Flush all cache files
- `POST /v1/transfer/cache/flush/:hours` - Flush files older than X hours

## That's It! 🎉

### **Benefits:**

- ✅ **Super Simple**: Only ~150 lines of code total
- ✅ **Automatic**: Cron jobs handle pre-generation and cleanup
- ✅ **Fast**: Cached downloads are instant
- ✅ **Reliable**: Falls back to real-time if no cache
- ✅ **Self-Cleaning**: Automatic daily cleanup of old files
- ✅ **Manageable**: Manual cache control when needed

### **Files:**

- `simple-cache.service.ts` - Cron jobs, cache lookup, and management
- Cache directory: `/tmp/photo-cache/`
- Cache key: SHA256 hash of sorted directory paths

### **Behavior:**

1. **New Order Created** → Goes in database
2. **30 Seconds Later** → Cron job finds it and pre-generates ZIP
3. **Customer Downloads** → Gets instant cached file!
4. **Daily at 3 AM** → Auto-cleanup removes files older than 24 hours
5. **Manual Control** → Admins can flush cache via API

### **Zero Maintenance:**

- Automatic cleanup prevents disk space issues
- Simple cache statistics for monitoring
- Manual flush when needed
- No complex invalidation logic
- No background job failures to worry about

**Result: Customers get instant downloads for recent orders, 2-4 second downloads for older ones, with automatic cleanup! Simple!** 🚀
