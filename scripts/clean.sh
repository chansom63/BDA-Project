#!/usr/bin/env bash
# ==============================================================================
# BDA Flight Telemetry Pipeline - Disk & Container Cleanup Script
# ==============================================================================
# Stops all compose containers and purges all volumes, persistent data,
# checkpoints, and disk caches created by the project.
#
# Usage:
#   ./scripts/clean.sh         # Normal cleanup (containers + all volumes + cache)
#   ./scripts/clean.sh --all   # Deep cleanup (also removes built images & build cache)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

DEEP_CLEAN=false
if [[ "$*" == *"--all"* || "$*" == *"--deep"* ]]; then
  DEEP_CLEAN=true
fi

echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${CYAN}${BOLD}🧹 BDA PIPELINE - FULL DISK & CONTAINER DATA CLEANUP${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"

# Show disk usage before cleanup
echo -e "\n${BLUE}📊 Docker disk usage before cleanup:${NC}"
docker system df || true

echo -e "\n${YELLOW}⏳ 1. Stopping containers and removing compose volumes...${NC}"
docker compose down -v --remove-orphans || true

echo -e "\n${YELLOW}⏳ 2. Removing project volumes (ClickHouse, Grafana, Spark checkpoints)...${NC}"
# Explicitly identify and remove all volumes matching project patterns
PROJECT_VOLUMES=$(docker volume ls -q | grep -E 'bda-project|clickhouse.*data|spark_checkpoints|grafana_data' || true)
if [ -n "${PROJECT_VOLUMES}" ]; then
  echo "${PROJECT_VOLUMES}" | while read -r vol; do
    if [ -n "$vol" ]; then
      docker volume rm -f "$vol" 2>/dev/null && echo -e "   ${GREEN}✓ Removed volume: ${vol}${NC}" || true
    fi
  done
else
  echo -e "   ${GREEN}✓ No lingering project volumes found.${NC}"
fi

echo -e "\n${YELLOW}⏳ 3. Pruning dangling/unused Docker volumes...${NC}"
docker volume prune -f

echo -e "\n${YELLOW}⏳ 4. Cleaning host temporary directories and caches...${NC}"
rm -rf /tmp/spark-checkpoints/* 2>/dev/null || true
rm -rf /tmp/.ivy2/* 2>/dev/null || true
echo -e "   ${GREEN}✓ Host caches cleared.${NC}"

if [ "$DEEP_CLEAN" = true ]; then
  echo -e "\n${YELLOW}⏳ 5. Deep clean: removing project built images and build cache...${NC}"
  docker rmi -f bda-project-backend bda-project-frontend bda-project-flight-generator 2>/dev/null || true
  docker image prune -f
  docker builder prune -f
  echo -e "   ${GREEN}✓ Images and build cache pruned.${NC}"
fi

echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}✅ CLEANUP COMPLETE: All container data on disk has been wiped clean!${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "\n${BLUE}📊 Docker disk usage after cleanup:${NC}"
docker system df || true
