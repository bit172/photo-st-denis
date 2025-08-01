#!/bin/bash

# Development setup script for photo-st-denis monorepo

set -e

echo "🚀 Setting up photo-st-denis monorepo..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
npm install --workspaces

# Build shared package first
echo "🔨 Building shared package..."
npm run build -w @photo-st-denis/shared

# Build backend
echo "🔨 Building backend..."
npm run build -w @photo-st-denis/backend

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Docker services are running"
else
    echo "❌ Some Docker services failed to start"
    docker-compose logs
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run backend:dev    # Start backend in development mode"
echo "  npm run docker:up      # Start Docker services"
echo "  npm run docker:down    # Stop Docker services"
echo "  npm run docker:logs    # View Docker logs"
echo ""
echo "Services:"
echo "  Backend API: http://localhost:3000"
echo "  MongoDB: mongodb://localhost:27017"
echo "  Redis: redis://localhost:6379"
echo ""
