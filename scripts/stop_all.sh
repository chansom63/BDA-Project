#!/usr/bin/env bash
# ==============================================================================
# FlightOps Real-Time Pipeline - Shutdown Script
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "======================================================================"
echo "🛑 Stopping Real-Time Flight Analytics Platform"
echo "======================================================================"

# 1. Stop Python Background Processes
echo "⏹️  [1/2] Terminating Simulator and Streamlit processes..."
pkill -f "simulators/unified_simulator.py" 2>/dev/null && echo "   Stopped simulator." || echo "   Simulator was not running."
pkill -f "streamlit run dashboard/app.py" 2>/dev/null && echo "   Stopped Streamlit." || echo "   Streamlit was not running."

# 2. Stop Docker Containers
echo "🐳 [2/2] Stopping Docker cluster (Kafka, Spark, MongoDB)..."
docker compose -f docker-compose.pipeline.yml down

echo "======================================================================"
echo "✅ All pipeline services and Docker containers stopped cleanly."
echo "======================================================================"
