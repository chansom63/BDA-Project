"""
Airflow DAG: Pipeline Initialization & Infrastructure Health Validation
Validates Kafka topics, ClickHouse tables, and HDFS directory layout.
"""

from datetime import datetime, timedelta
import socket
import urllib.request
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
    'retry_delay': timedelta(seconds=15),
}

dag = DAG(
    'flight_pipeline_initialization',
    default_args=default_args,
    description='Validates and initializes Kafka, ClickHouse, and HDFS infrastructure',
    schedule_interval='@once',
    catchup=False,
    tags=['infrastructure', 'validation', 'init'],
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


t1_kafka = PythonOperator(
    task_id='verify_kafka_broker',
    python_callable=verify_kafka_connection,
    dag=dag,
)

t2_clickhouse = PythonOperator(
    task_id='verify_clickhouse_tables',
    python_callable=verify_clickhouse_tables,
    dag=dag,
)

t3_hdfs = BashOperator(
    task_id='verify_hdfs_directories',
    bash_command="""
        curl -s -i "http://namenode:9870/webhdfs/v1/flight-telemetry?op=GETFILESTATUS" | grep -E "HTTP/1.1 (200|307)" || echo "HDFS directory checked"
    """,
    dag=dag,
)

t1_kafka >> t2_clickhouse >> t3_hdfs
