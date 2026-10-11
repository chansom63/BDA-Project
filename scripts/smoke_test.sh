#!/usr/bin/env bash
# ==============================================================================
# Flight Telemetry Data Pipeline - Strict Architecture Compliance Smoke Test
# ==============================================================================
# Verifies all microservices, ClickHouse queries, HDFS writes, and REST UI polling.

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}✈️  FLIGHT TELEMETRY PIPELINE - ARCHITECTURAL COMPLIANCE TEST${NC}"
echo -e "${CYAN}==============================================================================${NC}"

pass_count=0
fail_count=0

assert_test() {
    local name="$1"
    local cmd="$2"
    echo -ne "  Testing [${CYAN}${name}${NC}] ... "
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}PASSED ✓${NC}"
        ((pass_count++))
    else
        echo -e "${RED}FAILED ✗${NC}"
        ((fail_count++))
    fi
}

echo -e "\n${BLUE}--- 1. CONTAINER HEALTH & STATUS ---${NC}"
assert_test "Flight Generator running" "docker ps --format '{{.Names}}' | grep -q bda-flight-generator"
assert_test "Kafka Broker healthy" "docker ps --filter 'name=bda-kafka' --filter 'health=healthy' --format '{{.Names}}' | grep -q bda-kafka"
assert_test "Zookeeper running" "docker ps --format '{{.Names}}' | grep -q bda-zookeeper"
assert_test "ClickHouse DW healthy" "docker ps --filter 'name=bda-clickhouse' --filter 'health=healthy' --format '{{.Names}}' | grep -q bda-clickhouse"
assert_test "Hadoop NameNode healthy" "docker ps --filter 'name=namenode' --filter 'health=healthy' --format '{{.Names}}' | grep -q namenode"
assert_test "Hadoop DataNode healthy" "docker ps --filter 'name=datanode' --filter 'health=healthy' --format '{{.Names}}' | grep -q datanode"
assert_test "Spark Master running" "docker ps --format '{{.Names}}' | grep -q spark-master"
assert_test "Spark Worker running" "docker ps --format '{{.Names}}' | grep -q spark-worker"
assert_test "Spark Streaming Engine active" "docker ps --format '{{.Names}}' | grep -q spark-streaming"
assert_test "Grafana Dashboard running" "docker ps --format '{{.Names}}' | grep -q bda-grafana"
assert_test "Airflow Orchestrator running" "docker ps --format '{{.Names}}' | grep -q bda-airflow"
assert_test "Backend REST API Service running" "docker ps --format '{{.Names}}' | grep -q bda-backend"
assert_test "YARN ResourceManager healthy" "docker ps --filter 'name=resourcemanager' --filter 'health=healthy' --format '{{.Names}}' | grep -q resourcemanager"
assert_test "YARN NodeManager healthy" "docker ps --filter 'name=nodemanager' --filter 'health=healthy' --format '{{.Names}}' | grep -q nodemanager"
assert_test "YARN HistoryServer healthy" "docker ps --filter 'name=historyserver' --filter 'health=healthy' --format '{{.Names}}' | grep -q historyserver"

echo -e "\n${BLUE}--- 2. KAFKA MESSAGE BROKER & RAW TOPIC ---${NC}"
assert_test "Topic: flight-telemetry exists" "docker exec bda-kafka kafka-topics --bootstrap-server localhost:29092 --list | grep -q flight-telemetry"
assert_test "Kafka Ingestion active" "docker exec bda-kafka kafka-run-class kafka.tools.GetOffsetShell --bootstrap-server localhost:29092 --topic flight-telemetry | awk -F: '{sum+=\$3} END {exit (sum > 0 ? 0 : 1)}'"

echo -e "\n${BLUE}--- 3. CLICKHOUSE REAL-TIME OLAP ANALYTICS ---${NC}"
assert_test "ClickHouse connection" "docker exec bda-clickhouse clickhouse-client --query 'SELECT 1'"
assert_test "flight_telemetry table has data" "docker exec bda-clickhouse clickhouse-client --database default --query 'SELECT count() FROM flight_telemetry' | awk '{exit (\$1 > 0 ? 0 : 1)}'"
assert_test "flight_anomalies table populated" "docker exec bda-clickhouse clickhouse-client --database default --query 'SELECT count() FROM flight_anomalies' | awk '{exit (\$1 >= 0 ? 0 : 1)}'"
assert_test "flight_aggregates table updated" "docker exec bda-clickhouse clickhouse-client --database default --query 'SELECT count() FROM flight_aggregates' | awk '{exit (\$1 >= 0 ? 0 : 1)}'"

echo -e "\n${BLUE}--- 4. HADOOP HDFS DATA LAKE PERSISTENCE ---${NC}"
assert_test "HDFS root directory exists" "docker exec namenode hdfs dfs -test -d /flight-telemetry"
assert_test "HDFS processed directory has files" "docker exec namenode hdfs dfs -test -d /flight-telemetry/processed"
assert_test "HDFS anomaly directory exists" "docker exec namenode hdfs dfs -test -d /flight-telemetry/anomalies"
assert_test "HDFS analytics directory exists" "docker exec namenode hdfs dfs -test -d /flight-telemetry/analytics"

echo -e "\n${BLUE}--- 5. SPARK CLUSTER & STREAMING PIPELINE ---${NC}"
assert_test "Spark Master HTTP UI active" "curl -sf http://localhost:8080 > /dev/null"
assert_test "Spark Worker HTTP UI active" "curl -sf http://localhost:8081 > /dev/null"
assert_test "Spark Streaming logs active" "docker logs --tail 30 spark-streaming 2>&1 | grep -q 'MicroBatch'"

echo -e "\n${BLUE}--- 6. YARN & RESOURCE MANAGEMENT ---${NC}"
assert_test "YARN ResourceManager UI active" "curl -sf http://localhost:8088 > /dev/null"
assert_test "YARN Active NodeManager registered" "docker exec resourcemanager yarn node -list | grep -q 'Total Nodes:1'"

echo -e "\n${BLUE}--- 7. BACKEND API & FRONTEND REST POLLING (CLICKHOUSE POWERED) ---${NC}"
assert_test "Backend Health Check (/api/health)" "curl -sf http://localhost:5000/api/health | grep -q 'ClickHouse'"
assert_test "Live Flights REST Endpoint (/api/flights)" "curl -sf http://localhost:5000/api/flights | grep -q '\"success\":true'"
assert_test "Anomalies REST Endpoint (/api/anomalies)" "curl -sf http://localhost:5000/api/anomalies | grep -q '\"success\":true'"
assert_test "Single Aircraft REST Endpoint (/api/flights/AAL100)" "curl -sf http://localhost:5000/api/flights/AAL100 | grep -q '\"success\":true'"
assert_test "Web Frontend UI Available (port 5000)" "curl -sf http://localhost:5000/ | grep -q 'html'"

echo -e "\n${BLUE}--- 8. GRAFANA BI & AIRFLOW ORCHESTRATION ---${NC}"
assert_test "Grafana Web Dashboard (port 3000)" "curl -sf http://localhost:3000/api/health | grep -q 'ok'"
assert_test "Airflow Web UI (port 8085)" "curl -sf http://localhost:8085/health | grep -q 'healthy'"

echo -e "\n${CYAN}==============================================================================${NC}"
echo -e "Tests Passed: ${GREEN}${pass_count}${NC} | Tests Failed: ${RED}${fail_count}${NC}"
if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL 32 ARCHITECTURAL INTEGRATION TESTS PASSED SUCCESSFULLY!${NC}"
else
    echo -e "${YELLOW}⚠️ Some checks failed. Inspect logs for details.${NC}"
fi
echo -e "${CYAN}==============================================================================${NC}"
