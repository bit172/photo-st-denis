# Photo St-Denis 📸

High-performance photo management and transfer system built with NestJS and Nx.

## 🚀 Quick Start

```bash
git clone https://github.com/bit172/photo-st-denis.git
cd photo-st-denis
npm install
npm run backend:dev
```

## 🎯 Overview

Modern photo management system with intelligent caching, streaming ZIP downloads, and enterprise-grade security.

**Key Features:**

- **Lightning-fast transfers** with 5GB multi-tier caching
- **Streaming ZIP downloads** for large file handling
- **Token-based authentication** with 72-hour expiration
- **Nx monorepo** with 100x faster builds
- **RESTful API** with Swagger documentation

## 🏗️ Tech Stack

- **Backend**: NestJS + TypeScript + MongoDB
- **Build**: Nx monorepo with intelligent caching
- **Testing**: Jest with >85% coverage
- **Docs**: Swagger/OpenAPI auto-generation

## 🛠️ Development

### Setup

```bash
# Start services
npm run docker:up

# Start development
npm run backend:dev

# Run tests
npx nx test @photo-st-denis/backend
```

### Key Commands

```bash
# Nx (recommended)
npx nx build @photo-st-denis/backend
npx nx test @photo-st-denis/backend
npx nx lint @photo-st-denis/backend

# NPM shortcuts
npm run backend:dev
npm run docker:up
npm test
```

## 📚 API

**Swagger UI**: `http://localhost:3000/api/docs`

### Core Endpoints

```http
# Associate photos with email
POST /api/v1/transfer/associate
{
  "email": "user@example.com",
  "directoryPaths": ["/path/to/photos"]
}

# Download photos
GET /api/v1/transfer/download/{token}

# Cache stats
GET /api/v1/transfer/cache/stats
```

## ⚡ Performance

| Operation      | Without Cache | With Cache | Improvement     |
| -------------- | ------------- | ---------- | --------------- |
| ZIP Generation | 3-10s         | 50-200ms   | **50x faster**  |
| Build Time     | 30s+          | 42ms       | **100x faster** |

## 🚢 Deployment

```bash
# Docker
docker-compose up -d

# Environment
MONGO_URI=mongodb://localhost:27017/photo-st-denis
PORT=3000
CACHE_MAX_SIZE_MB=5000
PHOTOS_ROOT_PATH=/data/photos
```

## 🤝 Contributing

1. Fork & create feature branch
2. Make changes & test: `npx nx run-many --target=test,lint --all`
3. Commit & open PR

## License

MIT License - see [LICENSE](LICENSE) file.

---

**Built with ❤️ using NestJS, Nx, and TypeScript**
