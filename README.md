# Real-Time Flight Telemetry & Analytics Platform
## Strict Architecture Compliance & Big Data Pipeline

An end-to-end, high-performance **Real-Time Flight Telemetry & Distributed Analytics Pipeline** built in strict compliance with the reference architecture using **Kafka, Apache Spark Structured Streaming, Apache Hadoop HDFS, ClickHouse OLAP, Apache Hive, YARN MapReduce, Apache Airflow, Grafana, and React**.

---

## 🏗️ System Architecture & Data Flow

```
[ Flight Telemetry Data Source ]
    │  (bda-flight-generator: 500 simulated aircraft with engineTemperature & emergency squawks)
    ▼
[ Kafka Message Broker ] (bda-kafka: 29092 / 9093)
    └── Topic: flight-telemetry (raw 15s batches)
    │
    ▼
[ Spark Structured Streaming ] (spark-streaming / spark-master / spark-worker)
    ├── Anomaly Detection Engine (Squawks 7700/7600, EGT > 900°C, Rapid Descent)
    ├── Real-Time Metrics & Microbatch Aggregations
    ├── Storage Sink 1: ClickHouse OLAP Database (live results)
    └── Storage Sink 2: Hadoop HDFS Data Lake (historical batches)
    │
    ├──► [ ClickHouse OLAP DW ] (bda-clickhouse: 8123)
    │        ├── Table: flight_telemetry (queried via argMax for latest aircraft positions)
    │        ├── Table: flight_anomalies (detected emergency alerts)
    │        └── Table: flight_aggregates (15s rollup summaries)
    │        │
    │        ├──► [ Backend REST API & Web UI ] (bda-backend: 5000)
    │        │        ├── GET /api/flights       (10s REST polling by React Leaflet Map)
    │        │        ├── GET /api/flights/:id   (Detailed aircraft trajectory)
    │        │        ├── GET /api/anomalies     (Live alert notification feed)
    │        │        └── GET /api/analytics     (ClickHouse DW rollups)
    │        │
    │        └──► [ Grafana Dashboards ] (bda-grafana: 3000)
    │                 └── Real-Time Monitoring & Anomaly Alert Panels
    │
    └──► [ Hadoop HDFS Data Lake ] (namenode: 9870 / 9000 & datanode: 9864)
             ├── /flight-telemetry/processed
             ├── /flight-telemetry/anomalies
             └── /flight-telemetry/analytics
                     │
                     ├──► [ Spark SQL Historical Batch Analytics ] (spark-apps/historical_analytics.py)
                     ├──► [ Apache Hive Tables & Queries ] (hive/create_tables.sql)
                     └──► [ YARN MapReduce Streaming Batch Jobs ] (nodemanager: 8042 & resourcemanager: 8088)

[ Apache Airflow Orchestrator ] (bda-airflow: 8085)
    ├── DAG: flight_telemetry_pipeline_init (Topic creation, HDFS dirs, ClickHouse tables)
    └── DAG: flight_telemetry_historical_analytics (Hourly/daily analytical batch jobs)
```

---

## 🌐 Microservices Ports & Web Interfaces

| Service | Container Name | Host Port | Internal Port | Description / URL |
| :--- | :--- | :--- | :--- | :--- |
| **Web Frontend & API** | `bda-backend` | **5000** | 5000 | [http://localhost:5000](http://localhost:5000) (Interactive Radar Map) |
| **Grafana** | `bda-grafana` | **3000** | 3000 | [http://localhost:3000](http://localhost:3000) (admin/admin) |
| **Spark Master UI** | `spark-master` | **8080** | 8080 | [http://localhost:8080](http://localhost:8080) |
| **Spark Worker UI** | `spark-worker` | **8081** | 8081 | [http://localhost:8081](http://localhost:8081) |
| **HDFS NameNode UI** | `namenode` | **9870** | 9870 | [http://localhost:9870](http://localhost:9870) |
| **HDFS DataNode UI** | `datanode` | **9864** | 9864 | [http://localhost:9864](http://localhost:9864) |
| **YARN ResourceManager** | `resourcemanager` | **8088** | 8088 | [http://localhost:8088](http://localhost:8088) |
| **YARN NodeManager** | `nodemanager` | **8042** | 8042 | [http://localhost:8042](http://localhost:8042) |
| **YARN HistoryServer** | `historyserver` | **8188** | 8188 | [http://localhost:8188](http://localhost:8188) |
| **Apache Airflow** | `bda-airflow` | **8085** | 8080 | [http://localhost:8085](http://localhost:8085) (admin/admin) |
| **ClickHouse HTTP** | `bda-clickhouse` | **8123** | 8123 | [http://localhost:8123](http://localhost:8123) |
| **Kafka Broker** | `bda-kafka` | **9093** | 29092 | PLAINTEXT: `localhost:9093` |

---

## 🚀 Quick Start

To start all microservices:

```bash
# Start all containers in background
docker compose --profile hadoop-batch up -d

# Verify all containers are up and healthy
docker compose --profile hadoop-batch ps
```

To run the automated compliance test verifying all 32 integration points:

```bash
bash scripts/smoke_test.sh
```

---

## 🔍 Interactive Verification Guide

### 1. Interactive Radar Map & Backend API (`bda-backend`)
- Open [http://localhost:5000](http://localhost:5000) in your browser.
- The React frontend polls `GET /api/flights` every 10 seconds directly from ClickHouse and renders 500 live aircraft gliding across the map using client-side dead-reckoning.
- Test the REST API directly:
```bash
# Query latest active flights from ClickHouse
curl -s http://localhost:5000/api/flights | head -c 200

# Query detected anomalies from ClickHouse
curl -s http://localhost:5000/api/anomalies | head -c 200

# Query specific aircraft
curl -s http://localhost:5000/api/flights/AAL100
```

### 2. Flight Telemetry Data Generator (`bda-flight-generator`)
Inspect live flight generation producing 500 simulated aircraft every 15 seconds to Kafka:
```bash
docker logs -f --tail 20 bda-flight-generator
```

### 3. Kafka Message Broker (`bda-kafka`)
Interactively consume incoming raw telemetry:
```bash
docker exec -it bda-kafka kafka-console-consumer \
  --bootstrap-server localhost:29092 \
  --topic flight-telemetry \
  --max-messages 2
```

### 4. Spark Structured Streaming Engine (`spark-streaming`)
Monitor the stream processing microbatches:
```bash
docker logs -f --tail 20 spark-streaming
```
*Expected Output:*
```
--- [MicroBatch #342] Processing 500 records at 2026-10-11 06:30:14 UTC ---
⚠️ Detected 2 flight anomalies in batch #342!
💾 Written 500 processed records to HDFS (hdfs://namenode:9000/flight-telemetry/processed)
💾 Written 2 anomaly records to HDFS (hdfs://namenode:9000/flight-telemetry/anomalies)
📊 ClickHouse updated: 500 telemetry, 2 anomalies, 1 aggregate summary
```

### 5. ClickHouse OLAP Data Warehouse (`bda-clickhouse`)
Open an interactive ClickHouse terminal:
```bash
docker exec -it bda-clickhouse clickhouse-client
```
Execute analytical queries:
```sql
SELECT count() AS total_records FROM flight_telemetry;
SELECT eventId, callsign, airline, anomalyType, severity FROM flight_anomalies LIMIT 5;
exit;
```

### 6. Hadoop HDFS Distributed File System (`namenode`)
Inspect historical batches stored in HDFS:
```bash
docker exec -it namenode hdfs dfs -ls /flight-telemetry/
docker exec -it namenode hdfs dfs -count /flight-telemetry/processed
```

### 7. Hadoop YARN MapReduce Batch Job (`nodemanager`)
Execute a MapReduce streaming batch job across YARN:
```bash
docker exec -it nodemanager /bin/bash /opt/hadoop/mapreduce/run_job.sh
```

### 8. Grafana Real-Time Dashboard (`bda-grafana`)
Open [http://localhost:3000](http://localhost:3000) (User: `admin` / Password: `admin`) → **Dashboards** → **Flight Telemetry Real-Time Monitoring**.

### 9. Apache Airflow Orchestrator (`bda-airflow`)
Open [http://localhost:8085](http://localhost:8085) (User: `admin` / Password: `admin`) to view DAGs and triggered tasks.
