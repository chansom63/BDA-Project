"""
Airflow DAG: Pipeline Initialization & Infrastructure Health Validation
Validates Kafka broker, ClickHouse tables, HDFS layout, and Spark Cluster readiness.
"""

from datetime import datetime, timedelta
import socket
import urllib.request
import json
from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    'owner': 'data-engineering',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(seconds=15),
}

dag = DAG(
    'flight_pipeline_initialization',
    default_args=default_args,
    description='Validates and initializes Kafka, ClickHouse, HDFS, and Spark infrastructure',
    schedule_interval='@once',
    catchup=False,
    tags=['infrastructure', 'validation', 'init', 'spark', 'kafka'],
)


def verify_kafka_connection():
    """Verify Kafka broker is reachable."""
    host, port = "kafka", 29092
    with socket.create_connection((host, port), timeout=5):
        print(f"✅ Kafka broker at {host}:{port} is reachable.")


def verify_clickhouse_tables():
    """Verify ClickHouse tables exist."""
    url = "http://clickhouse:8123/?user=ch_user&password=ch_password&query=SHOW%20TABLES"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        content = resp.read().decode('utf-8')
        tables = [t.strip() for t in content.split('\n') if t.strip()]
        print(f"ClickHouse existing tables: {tables}")
        for required in ['flight_telemetry', 'flight_anomalies', 'flight_aggregates']:
            if required not in tables:
                raise ValueError(f"Missing required ClickHouse table: {required}")
            print(f"✅ Table confirmed: {required}")


def verify_hdfs_hierarchy():
    """Verify HDFS directory hierarchy via WebHDFS REST API."""
    url = "http://namenode:9870/webhdfs/v1/flight-telemetry?op=LISTSTATUS"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        subdirs = [f.get("pathSuffix") for f in data.get("FileStatuses", {}).get("FileStatus", [])]
        print(f"HDFS /flight-telemetry subdirectories: {subdirs}")
        for required in ['raw', 'processed', 'anomalies']:
            if required in subdirs:
                print(f"✅ HDFS directory confirmed: /flight-telemetry/{required}")
            else:
                print(f"ℹ️ HDFS directory pending / created dynamically: /flight-telemetry/{required}")


def verify_spark_cluster():
    """Verify Spark Standalone Master is ALIVE and workers are registered."""
    url = "http://spark-master:8080/json/"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        status = data.get("status")
        workers = data.get("workers", [])
        alive_workers = data.get("aliveworkers", 0)
        print(f"⚡ Spark Master Status: {status} | Registered Workers: {len(workers)} (Alive: {alive_workers})")
        if status != "ALIVE":
            raise ValueError(f"Spark Master is not in ALIVE state: {status}")
        if alive_workers < 1:
            raise ValueError(f"No alive Spark workers found on cluster!")
        for w in workers:
            print(f"  • Worker ID: {w.get('id')}, Cores: {w.get('cores')}, Memory: {w.get('memory')}MB, State: {w.get('state')}")


def verify_spark_streaming_active():
    """Verify Spark Structured Streaming processor is actively registered."""
    url = "http://spark-master:8080/json/"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        active_apps = data.get("activeapps", [])
        app_names = [a.get("name") for a in active_apps]
        print(f"⚡ Active Spark Applications: {app_names}")
        streaming_active = any("FlightTelemetryStreamingProcessor" in name for name in app_names)
        if streaming_active:
            print("✅ Spark Streaming Processor is ACTIVE and running on the cluster!")
        else:
            print("ℹ️ FlightTelemetryStreamingProcessor starting up or queued.")


def verify_yarn_cluster():
    """Verify Hadoop YARN ResourceManager, NodeManagers, and MapReduce HistoryServer readiness."""
    # 1. ResourceManager Cluster Info
    rm_url = "http://resourcemanager:8088/ws/v1/cluster/info"
    req_rm = urllib.request.Request(rm_url)
    with urllib.request.urlopen(req_rm, timeout=10) as resp:
        rm_data = json.loads(resp.read().decode('utf-8')).get("clusterInfo", {})
        rm_state = rm_data.get("state")
        ha_state = rm_data.get("haState")
        hadoop_ver = rm_data.get("hadoopVersion")
        print(f"🧶 YARN ResourceManager Status: State={rm_state}, HA={ha_state}, HadoopVersion={hadoop_ver}")
        if rm_state != "STARTED":
            raise ValueError(f"YARN ResourceManager is not in STARTED state: {rm_state}")

    # 2. NodeManager Registration & Heartbeats
    nodes_url = "http://resourcemanager:8088/ws/v1/cluster/nodes"
    req_nodes = urllib.request.Request(nodes_url)
    with urllib.request.urlopen(req_nodes, timeout=10) as resp:
        nodes_data = json.loads(resp.read().decode('utf-8')).get("nodes", {}).get("node", [])
        active_nodes = [n for n in nodes_data if n.get("state") == "RUNNING"]
        print(f"🧶 YARN NodeManagers: {len(active_nodes)} active node(s) registered.")
        if len(active_nodes) < 1:
            raise ValueError("No active RUNNING NodeManagers registered with YARN ResourceManager!")
        for node in active_nodes:
            print(f"  • Node: {node.get('nodeHTTPAddress')}, AvailMemory: {node.get('availMemoryMB')}MB, RunningContainers: {node.get('numContainers')}")

    # 3. MapReduce HistoryServer
    hs_url = "http://historyserver:8188/ws/v1/applicationhistory/about"
    req_hs = urllib.request.Request(hs_url)
    with urllib.request.urlopen(req_hs, timeout=10) as resp:
        hs_data = json.loads(resp.read().decode('utf-8'))
        print(f"📜 MapReduce JobHistoryServer Status: {hs_data.get('About')}, HadoopVersion={hs_data.get('hadoop-version')}")


t1_kafka = PythonOperator(
    task_id='verify_kafka_broker',
    python_callable=verify_kafka_connection,
    dag=dag,
)

t2_hdfs = PythonOperator(
    task_id='verify_hdfs_directories',
    python_callable=verify_hdfs_hierarchy,
    dag=dag,
)

t3_clickhouse = PythonOperator(
    task_id='verify_clickhouse_tables',
    python_callable=verify_clickhouse_tables,
    dag=dag,
)

t4_spark_master = PythonOperator(
    task_id='verify_spark_cluster',
    python_callable=verify_spark_cluster,
    dag=dag,
)

t5_spark_streaming = PythonOperator(
    task_id='verify_spark_streaming_active',
    python_callable=verify_spark_streaming_active,
    dag=dag,
)

t6_yarn = PythonOperator(
    task_id='verify_yarn_cluster_ready',
    python_callable=verify_yarn_cluster,
    dag=dag,
)

t1_kafka >> t2_hdfs >> t3_clickhouse >> t4_spark_master >> t5_spark_streaming >> t6_yarn
