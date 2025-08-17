# Docker Compose Configuration

This directory contains Docker Compose configurations for different environments:

## Files

- `docker-compose.yaml` - Development environment
- `docker-compose.prod.yaml` - Production environment (optimized for Raspberry Pi 5)

## Usage

### Development Environment
```bash
# Start development services
docker-compose up -d

# Stop development services
docker-compose down
```

### Production Environment (Raspberry Pi 5)
```bash
# Start production services
docker-compose -f docker-compose.prod.yaml up -d

# Stop production services
docker-compose -f docker-compose.prod.yaml down
```

## Key Differences

### Development (`docker-compose.yaml`)
- **NODE_ENV**: `development`
- **No resource limits**: Uses all available system resources
- **Latest images**: Uses `mongo:latest` and `redis:alpine`
- **Higher Redis memory**: 512MB max memory
- **No platform specification**: Auto-detects architecture

### Production (`docker-compose.prod.yaml`)
- **NODE_ENV**: `production`
- **Resource limits**: Optimized for Raspberry Pi 5's 4-8GB RAM
  - Backend: 1GB RAM limit, 2 CPU cores
  - MongoDB: 1.5GB RAM limit, 1 CPU core, 500MB WiredTiger cache
  - Redis: 512MB RAM limit, 0.5 CPU cores, 256MB max memory
- **ARM64 platform**: Explicitly targets `linux/arm64`
- **Specific versions**: Uses `mongo:7.0` and `redis:7-alpine`
- **MongoDB optimizations**: Custom command with cache size and quiet logging
- **Redis optimizations**: Reduced memory usage and periodic saving

## Monitoring

To monitor resource usage in production:
```bash
# View real-time resource usage
docker stats

# View logs
docker-compose -f docker-compose.prod.yaml logs -f [service_name]
```

## Tips for Raspberry Pi 5

1. **Enable swap** if you haven't already for better memory management
2. **Use SSD storage** for better I/O performance with MongoDB
3. **Ensure proper cooling** to prevent thermal throttling
4. **Monitor temperatures** during heavy workloads
