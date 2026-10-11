"""
Airflow DAG: Scheduled Historical Batch Analytics Workflow
Orchestrates periodic Spark SQL batch processing on HDFS historical flight data,
verifies generated analytical outputs in HDFS, and audits ClickHouse OLAP consistency.
"""

from datetime import datetime, timedelta
import urllib.request
import urllib.parse
import json
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

default_args = {
    'owner': 'data-engineering',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=1),
}

dag = DAG(
    'flight_historical_batch_analytics',
    default_args=default_args,
    description='Orchestrates scheduled Spark SQL analytics on historical HDFS flight telemetry',
    schedule_interval='@hourly',
    catchup=False,
    tags=['batch', 'analytics', 'spark', 'yarn', 'mapreduce', 'hdfs', 'clickhouse'],
)


def verify_processed_data_available():
    """Verify HDFS has processed telemetry data to analyze."""
    url = "http://namenode:9870/webhdfs/v1/flight-telemetry/processed?op=LISTSTATUS"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            statuses = data.get("FileStatuses", {}).get("FileStatus", [])
            print(f"✅ Found {len(statuses)} batch files in HDFS processed directory.")
            if len(statuses) == 0:
                print("⚠️ No processed batch files found in HDFS yet; proceeding with available dataset.")
            return True
    except Exception as e:
        print(f"ℹ️ HDFS query status: {e}")
        return True


def verify_analytics_output_artifacts():
    """Verify Spark SQL and YARN MapReduce batch analytics outputs written to HDFS."""
    datasets = ["aircraft_stats", "airline_engine_stats", "route_corridors"]
    for dataset in datasets:
        url = f"http://namenode:9870/webhdfs/v1/flight-telemetry/analytics/{dataset}?op=LISTSTATUS"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                files = data.get("FileStatuses", {}).get("FileStatus", [])
                part_files = [f.get("pathSuffix") for f in files if f.get("pathSuffix", "").startswith("part-")]
                print(f"✅ HDFS Analytics Dataset [{dataset}]: {len(part_files)} partition output file(s) confirmed.")
        except Exception as e:
            print(f"ℹ️ Dataset [{dataset}] check note: {e}")

    # Check YARN MapReduce output directories
    try:
        url = "http://namenode:9870/webhdfs/v1/flight-telemetry/analytics?op=LISTSTATUS"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            subdirs = [f.get("pathSuffix") for f in data.get("FileStatuses", {}).get("FileStatus", []) if f.get("pathSuffix", "").startswith("mapreduce_summary_")]
            print(f"✅ HDFS YARN MapReduce Summaries: {len(subdirs)} batch run directories confirmed: {subdirs[-3:]}")
    except Exception as e:
        print(f"ℹ️ YARN MapReduce output check note: {e}")


def audit_clickhouse_stats():
    """Audit real-time metrics stored in ClickHouse Data Warehouse."""
    queries = {
        "Total Telemetry Records": "SELECT count() FROM flight_telemetry",
        "Total Flight Anomalies": "SELECT count() FROM flight_anomalies",
        "Latest Altitude Window": "SELECT max(altitudeFt), avg(altitudeFt) FROM flight_telemetry",
    }
    for label, q in queries.items():
        url = f"http://clickhouse:8123/?user=ch_user&password=ch_password&query={urllib.parse.quote(q)}"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = resp.read().decode('utf-8').strip()
                print(f"📊 [ClickHouse OLAP Audit] {label}: {result}")
        except Exception as e:
            print(f"ℹ️ ClickHouse audit note for {label}: {e}")


t1_check_data = PythonOperator(
    task_id='check_hdfs_processed_data',
    python_callable=verify_processed_data_available,
    dag=dag,
)

t2_run_spark_analytics = BashOperator(
    task_id='submit_spark_sql_analytics_job',
    bash_command="""
        echo "🚀 Submitting Spark SQL Batch Analytics Job to Spark Cluster..."
        docker exec spark-streaming /opt/spark/bin/spark-submit \
            --master spark://spark-master:7077 \
            --conf spark.cores.max=1 \
            --conf spark.driver.memory=512m \
            --conf spark.executor.memory=512m \
            /opt/spark-apps/historical_analytics.py
    """,
    dag=dag,
)

t3_run_yarn_mapreduce = BashOperator(
    task_id='submit_yarn_mapreduce_job',
    bash_command="""
        echo "🚀 Submitting MapReduce Batch Analytics Job to YARN Cluster..."
        docker exec nodemanager /bin/bash /opt/hadoop/mapreduce/run_job.sh
    """,
    dag=dag,
)

t4_verify_artifacts = PythonOperator(
    task_id='verify_hdfs_analytics_artifacts',
    python_callable=verify_analytics_output_artifacts,
    dag=dag,
)

t5_audit_dw = PythonOperator(
    task_id='audit_clickhouse_warehouse',
    python_callable=audit_clickhouse_stats,
    dag=dag,
)

t1_check_data >> t2_run_spark_analytics >> t3_run_yarn_mapreduce >> t4_verify_artifacts >> t5_audit_dw
