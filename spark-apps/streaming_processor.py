#!/usr/bin/env python3
"""
Apache Spark Structured Streaming Application
Flight Telemetry Stream Processing & Anomaly Detection Pipeline
"""

import os
import sys
import time
import json
import socket
import urllib.request
import urllib.parse
from datetime import datetime

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, to_json, struct, to_timestamp, lit,
    when, concat_ws, avg, count, max, current_timestamp
)
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType, ArrayType
)

# Configuration from Environment
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:29092")
KAFKA_INPUT_TOPIC = os.getenv("KAFKA_INPUT_TOPIC", "flight-telemetry")

CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "clickhouse")
CLICKHOUSE_PORT = os.getenv("CLICKHOUSE_PORT", "8123")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "ch_user")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "ch_password")
CLICKHOUSE_DB = os.getenv("CLICKHOUSE_DB", "default")

HDFS_NAMENODE = os.getenv("HDFS_NAMENODE", "hdfs://namenode:9000")
CHECKPOINT_DIR = os.getenv("CHECKPOINT_DIR", f"{HDFS_NAMENODE}/flight-telemetry/checkpoints/streaming_processor")

print("=" * 60)
print("🚀 Spark Flight Telemetry Structured Streaming Processor")
print(f"📡 Kafka Brokers: {KAFKA_BROKERS} (Input: {KAFKA_INPUT_TOPIC})")
print(f"💾 ClickHouse Sink: http://{CLICKHOUSE_HOST}:{CLICKHOUSE_PORT} (DB: {CLICKHOUSE_DB})")
print(f"🐘 HDFS Data Lake Sink: {HDFS_NAMENODE}")
print(f"📍 Checkpoint: {CHECKPOINT_DIR}")
print("=" * 60)


def wait_for_service(host, port, timeout_sec=60, name="Service"):
    """Wait for network service to be reachable."""
    print(f"⏳ Waiting for {name} ({host}:{port})...")
    start_time = time.time()
    while time.time() - start_time < timeout_sec:
        try:
            with socket.create_connection((host, int(port)), timeout=2):
                print(f"✅ {name} ({host}:{port}) is ready!")
                return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            time.sleep(2)
    print(f"⚠️ {name} ({host}:{port}) wait timed out after {timeout_sec}s, proceeding...")
    return False


def post_to_clickhouse(table, rows):
    """Post JSON rows to ClickHouse HTTP interface."""
    if not rows:
        return
    url = f"http://{CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}/?user={CLICKHOUSE_USER}&password={CLICKHOUSE_PASSWORD}&database={CLICKHOUSE_DB}&query=INSERT%20INTO%20{table}%20FORMAT%20JSONEachRow"
    data = "\n".join([json.dumps(r) for r in rows]).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status >= 400:
                print(f"⚠️ ClickHouse post to {table} returned status {resp.status}")
    except Exception as e:
        print(f"❌ ClickHouse insert error for {table}: {e}")


def main():
    # Wait for dependencies
    kafka_host, kafka_port = KAFKA_BROKERS.split(",")[0].split(":")
    wait_for_service(kafka_host, kafka_port, timeout_sec=60, name="Kafka Broker")
    wait_for_service(CLICKHOUSE_HOST, CLICKHOUSE_PORT, timeout_sec=60, name="ClickHouse HTTP")

    # Initialize Spark Session
    spark = (
        SparkSession.builder
        .appName("FlightTelemetryStreamingProcessor")
        .config("spark.sql.shuffle.partitions", "2")
        .config("spark.default.parallelism", "2")
        .config("spark.streaming.stopGracefullyOnShutdown", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    # Telemetry Schema
    telemetry_schema = StructType([
        StructField("eventId", StringType(), True),
        StructField("timestamp", StringType(), True),
        StructField("icao24", StringType(), True),
        StructField("callsign", StringType(), True),
        StructField("flightId", StringType(), True),
        StructField("airline", StringType(), True),
        StructField("aircraftType", StringType(), True),
        StructField("registration", StringType(), True),
        StructField("countryFlag", StringType(), True),
        StructField("radarSource", StringType(), True),
        StructField("photoUrl", StringType(), True),
        StructField("origin", StructType([
            StructField("code", StringType(), True),
            StructField("city", StringType(), True),
            StructField("country", StringType(), True),
            StructField("lat", DoubleType(), True),
            StructField("lon", DoubleType(), True),
        ]), True),
        StructField("destination", StructType([
            StructField("code", StringType(), True),
            StructField("city", StringType(), True),
            StructField("country", StringType(), True),
            StructField("lat", DoubleType(), True),
            StructField("lon", DoubleType(), True),
        ]), True),
        StructField("latitude", DoubleType(), True),
        StructField("longitude", DoubleType(), True),
        StructField("altitudeFt", IntegerType(), True),
        StructField("speedKnots", IntegerType(), True),
        StructField("headingDeg", IntegerType(), True),
        StructField("verticalRateFpm", IntegerType(), True),
        StructField("squawk", StringType(), True),
        StructField("status", StringType(), True),
        StructField("progressPct", IntegerType(), True),
        StructField("weatherTurbulence", StringType(), True),
        StructField("engineTemperature", IntegerType(), True),
        StructField("std", StringType(), True),
        StructField("atd", StringType(), True),
        StructField("sta", StringType(), True),
        StructField("eta", StringType(), True),
    ])

    print("📥 Subscribing to Kafka topic:", KAFKA_INPUT_TOPIC)
    kafka_stream = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BROKERS)
        .option("subscribe", KAFKA_INPUT_TOPIC)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # Parse JSON
    parsed_df = (
        kafka_stream
        .selectExpr("CAST(value AS STRING) as json_str")
        .select(from_json(col("json_str"), telemetry_schema).alias("data"))
        .select("data.*")
        .filter(col("flightId").isNotNull())
    )

    # Transform & enrich
    enriched_df = (
        parsed_df
        .withColumn("eventTime", to_timestamp(col("timestamp")))
        .withColumn("route", concat_ws(" ➔ ", col("origin.code"), col("destination.code")))
        .withColumn("originCode", col("origin.code"))
        .withColumn("destCode", col("destination.code"))
    )

    def process_micro_batch(batch_df, batch_id):
        count = batch_df.count()
        if count == 0:
            return

        batch_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n--- [MicroBatch #{batch_id}] Processing {count} records at {batch_time} UTC ---")

        # 1. Detect Anomalies
        anomalies_condition = (
            col("squawk").isin("7700", "7600", "7500") |
            (col("engineTemperature") >= 900) |
            (col("verticalRateFpm") <= -1200) |
            (col("weatherTurbulence") == "Severe")
        )

        anomalies_df = batch_df.filter(anomalies_condition).withColumn(
            "anomalyType",
            when(col("squawk") == "7700", lit("MAYDAY_GENERAL_EMERGENCY"))
            .when(col("squawk") == "7600", lit("RADIO_COMMUNICATION_FAILURE"))
            .when(col("squawk") == "7500", lit("HIJACK_UNLAWFUL_INTERFERENCE"))
            .when(col("engineTemperature") >= 900, lit("ENGINE_OVERHEAT_CRITICAL"))
            .when(col("verticalRateFpm") <= -1200, lit("RAPID_DESCENT_ALERT"))
            .otherwise(lit("SEVERE_TURBULENCE_HAZARD"))
        ).withColumn(
            "severity",
            when(col("squawk").isin("7700", "7500") | (col("engineTemperature") >= 920), lit("EMERGENCY"))
            .otherwise(lit("WARNING"))
        ).withColumn(
            "details",
            concat_ws(" | ",
                col("callsign"),
                col("status"),
                concat_ws("", lit("Alt: "), col("altitudeFt")),
                concat_ws("", lit("EGT: "), col("engineTemperature"), lit("C")),
                concat_ws("", lit("Squawk: "), col("squawk"))
            )
        )

        anomaly_count = anomalies_df.count()
        if anomaly_count > 0:
            print(f"⚠️ Detected {anomaly_count} flight anomalies in batch #{batch_id}!")

        # 2. Persist to HDFS
        try:
            # Save processed batch to HDFS
            hdfs_processed_path = f"{HDFS_NAMENODE}/flight-telemetry/processed"
            batch_df.write.mode("append").json(hdfs_processed_path)
            print(f"💾 Written {count} processed records to HDFS ({hdfs_processed_path})")

            # Save anomalies to HDFS if any
            if anomaly_count > 0:
                hdfs_anomalies_path = f"{HDFS_NAMENODE}/flight-telemetry/anomalies"
                anomalies_df.write.mode("append").json(hdfs_anomalies_path)
                print(f"💾 Written {anomaly_count} anomaly records to HDFS ({hdfs_anomalies_path})")
        except Exception as e:
            print(f"⚠️ HDFS persistence notice (fallback active if offline): {e}")

        # 4. Write to ClickHouse
        try:
            # Telemetry records
            telemetry_rows = []
            for r in batch_df.collect():
                orig_code = r["origin"]["code"] if r["origin"] else "UNK"
                dest_code = r["destination"]["code"] if r["destination"] else "UNK"
                telemetry_rows.append({
                    "eventId": r["eventId"] or f"ev_{int(time.time()*1000)}",
                    "timestamp": r["timestamp"][:19].replace("T", " ") if r["timestamp"] else batch_time,
                    "flightId": r["flightId"] or "UNK",
                    "callsign": r["callsign"] or "UNK",
                    "latitude": float(r["latitude"] or 0.0),
                    "longitude": float(r["longitude"] or 0.0),
                    "altitudeFt": int(r["altitudeFt"] or 0),
                    "speedKnots": int(r["speedKnots"] or 0),
                    "headingDeg": int(r["headingDeg"] or 0),
                    "verticalRateFpm": int(r["verticalRateFpm"] or 0),
                    "squawk": str(r["squawk"] or "1200"),
                    "status": str(r["status"] or "In-Flight"),
                    "engineTemperature": int(r["engineTemperature"] or 700),
                    "route": f"{orig_code} ➔ {dest_code}",
                    "origin": orig_code,
                    "destination": dest_code
                })
            post_to_clickhouse("flight_telemetry", telemetry_rows)

            # Anomaly records
            if anomaly_count > 0:
                anomaly_rows = []
                for a in anomalies_df.collect():
                    anomaly_rows.append({
                        "anomalyId": f"anom_{int(time.time()*1000)}_{a['flightId']}",
                        "timestamp": a["timestamp"][:19].replace("T", " ") if a["timestamp"] else batch_time,
                        "flightId": a["flightId"] or "UNK",
                        "callsign": a["callsign"] or "UNK",
                        "anomalyType": a["anomalyType"],
                        "severity": a["severity"],
                        "details": a["details"] or "",
                        "altitudeFt": int(a["altitudeFt"] or 0),
                        "speedKnots": int(a["speedKnots"] or 0),
                        "engineTemperature": int(a["engineTemperature"] or 700),
                        "squawk": str(a["squawk"] or "1200")
                    })
                post_to_clickhouse("flight_anomalies", anomaly_rows)

            # Aggregates record
            agg_stats = batch_df.select(
                avg("altitudeFt").alias("avgAlt"),
                avg("speedKnots").alias("avgSpeed"),
                avg("engineTemperature").alias("avgEgt"),
                max("engineTemperature").alias("maxEgt")
            ).collect()[0]

            agg_rows = [{
                "windowStart": batch_time,
                "windowEnd": batch_time,
                "totalFlights": count,
                "avgAltitude": float(agg_stats["avgAlt"] or 0.0),
                "avgSpeed": float(agg_stats["avgSpeed"] or 0.0),
                "avgEngineTemp": float(agg_stats["avgEgt"] or 0.0),
                "maxEngineTemp": int(agg_stats["maxEgt"] or 700),
                "anomalyCount": anomaly_count
            }]
            post_to_clickhouse("flight_aggregates", agg_rows)
            print(f"📊 ClickHouse updated: {len(telemetry_rows)} telemetry, {anomaly_count} anomalies, 1 aggregate summary")

        except Exception as e:
            print(f"❌ Error inserting to ClickHouse: {e}")

    # Launch Structured Streaming query
    query = (
        enriched_df.writeStream
        .foreachBatch(process_micro_batch)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .start()
    )

    print("✅ Structured Streaming query started. Awaiting incoming data...")
    query.awaitTermination()


if __name__ == "__main__":
    main()
