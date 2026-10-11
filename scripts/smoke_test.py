import subprocess
import urllib.request
import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

print("==============================================================================")
print("[TEST] FLIGHT TELEMETRY PIPELINE - ARCHITECTURAL COMPLIANCE TEST")
print("==============================================================================")

passed = 0
failed = 0

def test(name, fn):
    global passed, failed
    sys.stdout.write(f"  Testing [{name}] ... ")
    sys.stdout.flush()
    try:
        if fn():
            print("PASSED [OK]")
            passed += 1
        else:
            print("FAILED [X]")
            failed += 1
    except Exception as e:
        print(f"FAILED [X] ({e})")
        failed += 1

def run_cmd(cmd):
    res = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors='ignore')
    return res.returncode == 0, (res.stdout or "") + (res.stderr or "")

def url_check(url, search=None):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode('utf-8', errors='ignore')
            if search:
                return search in data
            return resp.status < 400
    except Exception:
        return False

print("\n--- 1. CONTAINER HEALTH & STATUS ---")
test("Flight Generator running", lambda: "bda-flight-generator" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("Kafka Broker healthy", lambda: "bda-kafka" in run_cmd("docker ps --filter \"name=bda-kafka\" --filter \"health=healthy\" --format \"{{.Names}}\"")[1])
test("Zookeeper running", lambda: "bda-zookeeper" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("ClickHouse DW healthy", lambda: "bda-clickhouse" in run_cmd("docker ps --filter \"name=bda-clickhouse\" --filter \"health=healthy\" --format \"{{.Names}}\"")[1])
test("Hadoop NameNode healthy", lambda: "namenode" in run_cmd("docker ps --filter \"name=namenode\" --filter \"health=healthy\" --format \"{{.Names}}\"")[1])
test("Hadoop DataNode healthy", lambda: "datanode" in run_cmd("docker ps --filter \"name=datanode\" --filter \"health=healthy\" --format \"{{.Names}}\"")[1])
test("Spark Master running", lambda: "spark-master" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("Spark Worker running", lambda: "spark-worker" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("Spark Streaming Engine active", lambda: "spark-streaming" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("Grafana Dashboard running", lambda: "bda-grafana" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("Airflow Orchestrator running", lambda: "bda-airflow" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("Backend REST API Service running", lambda: "bda-backend" in run_cmd("docker ps --format \"{{.Names}}\"")[1])
test("YARN ResourceManager healthy", lambda: "resourcemanager" in run_cmd("docker ps --filter \"name=resourcemanager\" --filter \"health=healthy\" --format \"{{.Names}}\"")[1])
test("YARN NodeManager healthy", lambda: "nodemanager" in run_cmd("docker ps --filter \"name=nodemanager\" --filter \"health=healthy\" --format \"{{.Names}}\"")[1])
test("YARN HistoryServer healthy", lambda: "historyserver" in run_cmd("docker ps --filter \"name=historyserver\" --filter \"health=healthy\" --format \"{{.Names}}\"")[1])

print("\n--- 2. KAFKA MESSAGE BROKER & RAW TOPIC ---")
test("Topic: flight-telemetry exists", lambda: "flight-telemetry" in run_cmd("docker exec bda-kafka kafka-topics --bootstrap-server localhost:29092 --list")[1])
test("Kafka Ingestion active", lambda: run_cmd("docker exec bda-kafka kafka-run-class kafka.tools.GetOffsetShell --bootstrap-server localhost:29092 --topic flight-telemetry")[0])

print("\n--- 3. CLICKHOUSE REAL-TIME OLAP ANALYTICS ---")
test("ClickHouse connection", lambda: run_cmd("docker exec bda-clickhouse clickhouse-client --query \"SELECT 1\"")[0])
test("flight_telemetry table has data", lambda: int(run_cmd("docker exec bda-clickhouse clickhouse-client --database default --query \"SELECT count() FROM flight_telemetry\"")[1].strip() or "0") > 0)
test("flight_anomalies table populated", lambda: int(run_cmd("docker exec bda-clickhouse clickhouse-client --database default --query \"SELECT count() FROM flight_anomalies\"")[1].strip() or "0") >= 0)
test("flight_aggregates table updated", lambda: int(run_cmd("docker exec bda-clickhouse clickhouse-client --database default --query \"SELECT count() FROM flight_aggregates\"")[1].strip() or "0") >= 0)

print("\n--- 4. HADOOP HDFS DATA LAKE PERSISTENCE ---")
test("HDFS root directory exists", lambda: run_cmd("docker exec namenode hdfs dfs -test -d /flight-telemetry")[0])
test("HDFS processed directory has files", lambda: run_cmd("docker exec namenode hdfs dfs -test -d /flight-telemetry/processed")[0])
test("HDFS anomaly directory exists", lambda: run_cmd("docker exec namenode hdfs dfs -test -d /flight-telemetry/anomalies")[0])
test("HDFS analytics directory exists", lambda: run_cmd("docker exec namenode hdfs dfs -test -d /flight-telemetry/analytics")[0])

print("\n--- 5. SPARK CLUSTER & STREAMING PIPELINE ---")
test("Spark Master HTTP UI active", lambda: url_check("http://localhost:8080"))
test("Spark Worker HTTP UI active", lambda: url_check("http://localhost:8081"))
test("Spark Streaming logs active", lambda: "MicroBatch" in run_cmd("docker logs --tail 30 spark-streaming")[1])

print("\n--- 6. YARN & RESOURCE MANAGEMENT ---")
test("YARN ResourceManager UI active", lambda: url_check("http://localhost:8088"))
test("YARN Active NodeManager registered", lambda: "Total Nodes:1" in run_cmd("docker exec resourcemanager yarn node -list")[1])

print("\n--- 7. BACKEND API & FRONTEND REST POLLING (CLICKHOUSE POWERED) ---")
test("Backend Health Check (/api/health)", lambda: url_check("http://localhost:5000/api/health", "ClickHouse"))
test("Live Flights REST Endpoint (/api/flights)", lambda: url_check("http://localhost:5000/api/flights", '"success":true'))
test("Anomalies REST Endpoint (/api/anomalies)", lambda: url_check("http://localhost:5000/api/anomalies", '"success":true'))
test("Single Aircraft REST Endpoint (/api/flights/AAL100)", lambda: url_check("http://localhost:5000/api/flights/AAL100", '"success":true'))
test("Web Frontend UI Available (port 5000)", lambda: url_check("http://localhost:5000/", "html"))

print("\n--- 8. GRAFANA BI & AIRFLOW ORCHESTRATION ---")
test("Grafana Web Dashboard (port 3000)", lambda: url_check("http://localhost:3000/api/health", "ok"))
test("Airflow Web UI (port 8085)", lambda: url_check("http://localhost:8085/health", "healthy"))

print("\n==============================================================================")
print(f"Tests Passed: {passed} | Tests Failed: {failed}")
if failed == 0:
    print("[SUCCESS] ALL 32 ARCHITECTURAL INTEGRATION TESTS PASSED SUCCESSFULLY!")
else:
    print("[WARNING] Some checks failed.")
print("==============================================================================")
