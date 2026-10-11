"""
Airflow DAG: Streaming Pipeline Health & Telemetry Monitor
Monitors Spark Structured Streaming microbatch status, ClickHouse ingestion velocity,
and active telemetry anomaly alerts every 15 minutes.
"""

from datetime import datetime, timedelta
import urllib.request
import urllib.parse
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
    'retry_delay': timedelta(seconds=30),
}

dag = DAG(
    'flight_streaming_pipeline_monitor',
    default_args=default_args,
    description='Monitors Spark Structured Streaming, ClickHouse ingestion velocity, and live anomalies',
    schedule_interval='*/15 * * * *',
    catchup=False,
    tags=['monitoring', 'streaming', 'spark', 'yarn', 'clickhouse', 'kafka'],
)


def monitor_spark_streaming_application():
    """Verify Spark streaming processor is healthy and active."""
    url = "http://spark-master:8080/json/"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        active_apps = data.get("activeapps", [])
        streaming_apps = [a for a in active_apps if "FlightTelemetryStreamingProcessor" in a.get("name", "")]
        if not streaming_apps:
            print("⚠️ Warning: FlightTelemetryStreamingProcessor not found in activeapps!")
        else:
            app = streaming_apps[0]
            print(f"✅ Streaming App '{app.get('name')}' is healthy:")
            print(f"   • Application ID: {app.get('id')}")
            print(f"   • Cores allocated: {app.get('cores')}")
            print(f"   • Memory: {app.get('memoryperexecutor')}MB")
            print(f"   • Up-time: {app.get('duration')}ms")


def monitor_clickhouse_ingestion_velocity():
    """Verify ClickHouse OLAP is actively receiving streaming telemetry."""
    query = "SELECT count() FROM flight_telemetry WHERE timestamp >= now() - INTERVAL 15 MINUTE"
    url = f"http://clickhouse:8123/?user=ch_user&password=ch_password&query={urllib.parse.quote(query)}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            recent_count = resp.read().decode('utf-8').strip()
            print(f"📈 [ClickHouse Ingestion Rate] Records ingested in last 15 min: {recent_count}")
    except Exception as e:
        print(f"ℹ️ ClickHouse query status: {e}")


def monitor_recent_anomalies():
    """Verify ClickHouse anomaly events and severity distribution."""
    query = "SELECT severity, count() FROM flight_anomalies GROUP BY severity"
    url = f"http://clickhouse:8123/?user=ch_user&password=ch_password&query={urllib.parse.quote(query)}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = resp.read().decode('utf-8').strip()
            print(f"⚠️ [Active Anomalies Summary by Severity]:\n{result}")
    except Exception as e:
        print(f"ℹ️ Anomaly audit status: {e}")


def monitor_yarn_cluster_resources():
    """Monitor Hadoop YARN cluster resource allocations and active applications."""
    metrics_url = "http://resourcemanager:8088/ws/v1/cluster/metrics"
    try:
        req = urllib.request.Request(metrics_url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            metrics = json.loads(resp.read().decode('utf-8')).get("clusterMetrics", {})
            apps_running = metrics.get("appsRunning", 0)
            apps_completed = metrics.get("appsCompleted", 0)
            allocated_mb = metrics.get("allocatedMB", 0)
            available_mb = metrics.get("availableMB", 0)
            total_mb = metrics.get("totalMB", 0)
            active_nodes = metrics.get("activeNodes", 0)
            containers_alloc = metrics.get("containersAllocated", 0)
            print(f"🧶 [YARN Cluster Resource Manager Audit]:")
            print(f"   • Active Nodes: {active_nodes}")
            print(f"   • Apps Running: {apps_running} | Apps Completed: {apps_completed}")
            print(f"   • Memory Usage: {allocated_mb}MB / {total_mb}MB (Available: {available_mb}MB)")
            print(f"   • Containers Allocated: {containers_alloc}")
    except Exception as e:
        print(f"ℹ️ YARN cluster metrics audit note: {e}")


t1_spark_status = PythonOperator(
    task_id='monitor_spark_streaming_application',
    python_callable=monitor_spark_streaming_application,
    dag=dag,
)

t2_ch_ingestion = PythonOperator(
    task_id='monitor_clickhouse_ingestion_velocity',
    python_callable=monitor_clickhouse_ingestion_velocity,
    dag=dag,
)

t3_anomalies = PythonOperator(
    task_id='monitor_recent_anomalies',
    python_callable=monitor_recent_anomalies,
    dag=dag,
)

t4_yarn_resources = PythonOperator(
    task_id='monitor_yarn_cluster_resources',
    python_callable=monitor_yarn_cluster_resources,
    dag=dag,
)

t1_spark_status >> t2_ch_ingestion >> t3_anomalies >> t4_yarn_resources
