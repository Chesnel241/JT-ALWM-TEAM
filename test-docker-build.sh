#!/bin/bash

# 🧪 Script de validation - Vérifie que les Dockerfiles buildent correctement
# Usage: bash test-docker-build.sh

set -e

echo "═════════════════════════════════════════════════════════════"
echo "🧪 VALIDATION - Docker Build Test"
echo "═════════════════════════════════════════════════════════════"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"

# Backend Build
echo ""
echo "═════════════════════════════════════════════════════════════"
echo "🔨 Building Backend Docker image..."
echo "═════════════════════════════════════════════════════════════"

if docker build -t jt-alwm-backend:test ./backend; then
    echo -e "${GREEN}✅ Backend build successful${NC}"
    # Show image size
    SIZE=$(docker images jt-alwm-backend:test --format "{{.Size}}")
    echo "   Image size: $SIZE"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi

# Frontend Build
echo ""
echo "═════════════════════════════════════════════════════════════"
echo "🔨 Building Frontend Docker image..."
echo "═════════════════════════════════════════════════════════════"

if docker build -t jt-alwm-frontend:test ./frontend; then
    echo -e "${GREEN}✅ Frontend build successful${NC}"
    # Show image size
    SIZE=$(docker images jt-alwm-frontend:test --format "{{.Size}}")
    echo "   Image size: $SIZE"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

# Docker Compose validation
echo ""
echo "═════════════════════════════════════════════════════════════"
echo "🔍 Validating docker-compose.yml..."
echo "═════════════════════════════════════════════════════════════"

if docker-compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✅ docker-compose.yml is valid${NC}"
else
    echo -e "${RED}❌ docker-compose.yml validation failed${NC}"
    exit 1
fi

# Cleanup
echo ""
echo "═════════════════════════════════════════════════════════════"
echo "🧹 Cleaning up test images..."
echo "═════════════════════════════════════════════════════════════"

docker rmi jt-alwm-backend:test jt-alwm-frontend:test --force > /dev/null 2>&1
echo -e "${GREEN}✓ Cleanup done${NC}"

echo ""
echo "═════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ ALL VALIDATIONS PASSED${NC}"
echo "═════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Start local environment: docker-compose up -d"
echo "  2. Test: http://localhost"
echo "  3. See QUICKSTART.md for more info"
