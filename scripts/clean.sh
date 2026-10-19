#!/usr/bin/env bash
# ==============================================================================
# BDA Flight Telemetry Pipeline - Full Storage & Container Cleanup Script
# ==============================================================================
# Stops all containers and purges all volumes, persistent database storage
# (MongoDB, ClickHouse, Kafka), Spark checkpoints, and disk caches.
#
# Usage:
#   npm run clean              # Normal cleanup (containers + all database volumes + cache)
#   npm run deep:clean         # Deep cleanup (also removes built images & build cache)
#   ./scripts/clean.sh --all   # Direct deep clean
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
if [ "$DEEP_CLEAN" = true ]; then
  echo -e "${YELLOW}${BOLD}   (Deep Clean: Containers + All Volumes + Built Images + Build Cache)${NC}"
else
  echo -e "${YELLOW}${BOLD}   (Standard Clean: Containers + All Volumes + Database Data + Checkpoints)${NC}"
fi
echo -e "${CYAN}${BOLD}==============================================================================${NC}"

# Show disk usage before cleanup
echo -e "\n${BLUE}📊 Docker disk usage before cleanup:${NC}"
docker system df || true

# 1. Stop host background processes
echo -e "\n${YELLOW}⏳ 1. Stopping host simulator and dashboard processes...${NC}"
pkill -f "simulators/unified_simulator.py" 2>/dev/null || true
pkill -f "streamlit run dashboard/app.py" 2>/dev/null || true
echo -e "   ${GREEN}✓ Host processes stopped.${NC}"

# 2. Stop and remove containers from all compose files with volume flag
echo -e "\n${YELLOW}⏳ 2. Stopping and removing Docker compose containers and networks...${NC}"
docker compose -f docker-compose.pipeline.yml down -v --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.yml down -v --remove-orphans 2>/dev/null || true

# Force terminate any remaining project containers
CONTAINERS_TO_REMOVE="flight-dashboard flight-spark-streaming bda-frontend flight-mongo-express flight-simulator bda-backend flight-spark-worker flight-spark-master flight-kafka-init-topics flight-kafka flight-mongodb flight-zookeeper bda-clickhouse bda-clickhouse-init bda-grafana bda-flight-generator bda-kafka bda-zookeeper spark-master spark-worker spark-streaming"
docker rm -f $CONTAINERS_TO_REMOVE 2>/dev/null || true
echo -e "   ${GREEN}✓ All project containers and networks removed.${NC}"

# 3. Purge all project persistent storage volumes (MongoDB, ClickHouse, Checkpoints, Kafka)
echo -e "\n${YELLOW}⏳ 3. Purging persistent data volumes (MongoDB, ClickHouse, Kafka, Checkpoints)...${NC}"
PROJECT_VOLUMES=$(docker volume ls -q | grep -E 'bda-project|mongo_flight_data|flight_streaming|spark_checkpoints|clickhouse.*data|grafana_data|mongo_data|project_|hadoop' || true)
if [ -n "${PROJECT_VOLUMES}" ]; then
  echo "${PROJECT_VOLUMES}" | while read -r vol; do
    if [ -n "$vol" ]; then
      docker volume rm -f "$vol" 2>/dev/null && echo -e "   ${GREEN}✓ Removed volume:${NC} ${vol}" || true
    fi
  done
else
  echo -e "   ${GREEN}✓ No specific project volumes found.${NC}"
fi

# 4. Prune all unused Docker volumes (both named and anonymous)
echo -e "\n${YELLOW}⏳ 4. Pruning all unused Docker volumes (-a --force)...${NC}"
docker volume prune -a -f

# 5. Clean host temporary directories, checkpoints, and logs
echo -e "\n${YELLOW}⏳ 5. Cleaning host temporary directories, Spark checkpoints, and logs...${NC}"
rm -rf /tmp/spark-checkpoints/* 2>/dev/null || true
rm -rf /tmp/.ivy2/* 2>/dev/null || true
rm -f /tmp/flight_simulator.log /tmp/streamlit_dashboard.log 2>/dev/null || true
echo -e "   ${GREEN}✓ Host caches, Spark checkpoints, and temp logs cleared.${NC}"

# 6. Deep clean: remove built project images and build cache
if [ "$DEEP_CLEAN" = true ]; then
  echo -e "\n${YELLOW}⏳ 6. Deep clean: removing project built images and build cache...${NC}"
  docker rmi -f flight-spark:3.5.0 flight-dashboard:latest flight-simulator:latest bda-project-backend:latest bda-project-frontend:latest bda-project-flight-generator:latest bda-project-backend bda-project-frontend 2>/dev/null || true
  docker image prune -f
  docker builder prune -a -f
  echo -e "   ${GREEN}✓ Project images and Docker build cache purged.${NC}"
fi

echo -e "\n${CYAN}${BOLD}==============================================================================${NC}"
echo -e "${GREEN}${BOLD}✅ CLEANUP COMPLETE: All container data on disk has been wiped clean!${NC}"
echo -e "${CYAN}${BOLD}==============================================================================${NC}"
echo -e "\n${BLUE}📊 Docker disk usage after cleanup:${NC}"
docker system df || true
