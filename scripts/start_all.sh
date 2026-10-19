#!/usr/bin/env bash
# ==============================================================================
# FlightOps Real-Time Pipeline - Startup Script
# ==============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "======================================================================"
echo "🛫 Starting Real-Time Flight Analytics Platform"
echo "======================================================================"

# 1. Clean up any leftover host background processes
pkill -f "simulators/unified_simulator.py" 2>/dev/null || true
pkill -f "streamlit run dashboard/app.py" 2>/dev/null || true

# 2. Start Full Containerized Pipeline via Docker Compose
echo "🐳 [1/2] Launching containerized services via Docker Compose..."
docker compose -f docker-compose.pipeline.yml up -d

# 3. Wait for services to initialize
echo "⏳ [2/2] Waiting for services to initialize..."
sleep 4

echo "======================================================================"
echo "✨ All components started successfully!"
echo "----------------------------------------------------------------------"
echo "🌐 Streamlit Dashboard      : http://localhost:8501"
echo "🗄️  Mongo Express Web UI     : http://localhost:8082"
echo "⚡ Spark Master Web UI      : http://localhost:8084"
echo "👷 Spark Worker Web UI      : http://localhost:8083"
echo "🌊 Spark Streaming App UI   : http://localhost:4040"
echo "📡 Kafka Broker Host Port   : localhost:9092"
echo "📦 MongoDB Native Port      : localhost:27017"
echo "======================================================================"
