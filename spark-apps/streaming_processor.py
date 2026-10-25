#!/usr/bin/env python3
"""
Apache Spark Structured Streaming Application
Flight Telemetry Stream Processing & Anomaly Detection Pipeline

Data Flow (approved architecture):
  Kafka: flight-telemetry
    → Spark (parse, enrich, detect anomalies, aggregate)
    → Kafka: processed-events  (picked up by ClickHouse Kafka Engine)
    → Kafka: anomalies          (picked up by ClickHouse Kafka Engine)

ClickHouse ingests from those Kafka topics via its Kafka Engine tables.
Spark does NOT write to ClickHouse directly.
"""

import os
import sys
import time
import json
import socket
from datetime import datetime

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, to_json, struct, to_timestamp, lit,
    when, concat_ws, avg, count, max as spark_max, current_timestamp
)
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType
)

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------
KAFKA_BROKERS          = os.getenv("KAFKA_BROKERS",          "kafka:29092")
KAFKA_INPUT_TOPIC      = os.getenv("KAFKA_INPUT_TOPIC",      "flight-telemetry")
KAFKA_PROCESSED_TOPIC  = os.getenv("KAFKA_PROCESSED_TOPIC",  "processed-events")
KAFKA_ANOMALIES_TOPIC  = os.getenv("KAFKA_ANOMALIES_TOPIC",  "anomalies")
CHECKPOINT_DIR         = os.getenv("CHECKPOINT_DIR",         "/tmp/spark-checkpoints/streaming_processor")

print("=" * 60)
print("🚀 Spark Flight Telemetry Structured Streaming Processor")
print(f"📡 Kafka In : {KAFKA_BROKERS} / topic: {KAFKA_INPUT_TOPIC}")
print(f"📤 Kafka Out: processed-events={KAFKA_PROCESSED_TOPIC}, anomalies={KAFKA_ANOMALIES_TOPIC}")
print(f"📍 Checkpoint: {CHECKPOINT_DIR}")
print("=" * 60)


def wait_for_kafka(brokers, timeout_sec=120):
    """Wait until at least one Kafka broker is reachable."""
    host, port = brokers.split(",")[0].split(":")
    print(f"⏳ Waiting for Kafka ({host}:{port})...")
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with socket.create_connection((host, int(port)), timeout=2):
                print(f"✅ Kafka is ready!")
                return
        except (socket.timeout, ConnectionRefusedError, OSError):
            time.sleep(2)
    print(f"⚠️  Kafka wait timed out after {timeout_sec}s, proceeding anyway…")


# ---------------------------------------------------------------------------
# Telemetry JSON schema (must match the generator's event shape)
# ---------------------------------------------------------------------------
TELEMETRY_SCHEMA = StructType([
    StructField("eventId",            StringType(),  True),
    StructField("timestamp",          StringType(),  True),
    StructField("icao24",             StringType(),  True),
    StructField("callsign",           StringType(),  True),
    StructField("flightId",           StringType(),  True),
    StructField("airline",            StringType(),  True),
    StructField("aircraftType",       StringType(),  True),
    StructField("registration",       StringType(),  True),
    StructField("countryFlag",        StringType(),  True),
    StructField("radarSource",        StringType(),  True),
    StructField("photoUrl",           StringType(),  True),
    StructField("origin", StructType([
        StructField("code",    StringType(),  True),
        StructField("city",    StringType(),  True),
        StructField("country", StringType(),  True),
        StructField("lat",     DoubleType(),  True),
        StructField("lon",     DoubleType(),  True),
    ]), True),
    StructField("destination", StructType([
        StructField("code",    StringType(),  True),
        StructField("city",    StringType(),  True),
        StructField("country", StringType(),  True),
        StructField("lat",     DoubleType(),  True),
        StructField("lon",     DoubleType(),  True),
    ]), True),
    StructField("latitude",           DoubleType(),  True),
    StructField("longitude",          DoubleType(),  True),
    StructField("altitudeFt",         IntegerType(), True),
    StructField("speedKnots",         IntegerType(), True),
    StructField("headingDeg",         IntegerType(), True),
    StructField("verticalRateFpm",    IntegerType(), True),
    StructField("squawk",             StringType(),  True),
    StructField("status",             StringType(),  True),
    StructField("progressPct",        IntegerType(), True),
    StructField("weatherTurbulence",  StringType(),  True),
    StructField("engineTemperature",  IntegerType(), True),
    StructField("std",                StringType(),  True),
    StructField("atd",                StringType(),  True),
    StructField("sta",                StringType(),  True),
    StructField("eta",                StringType(),  True),
])


def main():
    wait_for_kafka(KAFKA_BROKERS)

    spark = (
        SparkSession.builder
        .appName("FlightTelemetryStreamingProcessor")
        .config("spark.sql.shuffle.partitions", "2")
        .config("spark.default.parallelism",    "2")
        .config("spark.streaming.stopGracefullyOnShutdown", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    # ── Read raw telemetry from Kafka ───────────────────────────────────────
    raw_stream = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BROKERS)
        .option("subscribe", KAFKA_INPUT_TOPIC)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    parsed_df = (
        raw_stream
        .selectExpr("CAST(value AS STRING) AS json_str")
        .select(from_json(col("json_str"), TELEMETRY_SCHEMA).alias("d"))
        .select("d.*")
        .filter(col("flightId").isNotNull())
    )

    # ── Enrich ──────────────────────────────────────────────────────────────
    enriched_df = (
        parsed_df
        .withColumn("eventTime",   to_timestamp(col("timestamp")))
        .withColumn("route",       concat_ws(" ➔ ", col("origin.code"), col("destination.code")))
        .withColumn("originCode",  col("origin.code"))
        .withColumn("destCode",    col("destination.code"))
    )

    # ── foreachBatch: detect anomalies, build Kafka payloads ────────────────
    def process_micro_batch(batch_df, batch_id):
        record_count = batch_df.count()
        if record_count == 0:
            return

        batch_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n--- [Batch #{batch_id}] {record_count} records @ {batch_time} UTC ---")

        # ── Anomaly detection ───────────────────────────────────────────────
        anomaly_condition = (
            col("squawk").isin("7700", "7600", "7500") |
            (col("engineTemperature") >= 900) |
            (col("verticalRateFpm") <= -1200) |
            (col("weatherTurbulence") == "Severe")
        )

        anomalies_df = batch_df.filter(anomaly_condition).withColumn(
            "anomalyType",
            when(col("squawk") == "7700", lit("MAYDAY_GENERAL_EMERGENCY"))
            .when(col("squawk") == "7600", lit("RADIO_COMMUNICATION_FAILURE"))
            .when(col("squawk") == "7500", lit("HIJACK_UNLAWFUL_INTERFERENCE"))
            .when(col("engineTemperature") >= 900, lit("ENGINE_OVERHEAT_CRITICAL"))
            .when(col("verticalRateFpm") <= -1200, lit("RAPID_DESCENT_ALERT"))
            .otherwise(lit("SEVERE_TURBULENCE_HAZARD"))
        ).withColumn(
            "severity",
            when(
                col("squawk").isin("7700", "7500") | (col("engineTemperature") >= 920),
                lit("EMERGENCY")
            ).otherwise(lit("WARNING"))
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
            print(f"⚠️  {anomaly_count} anomalies detected in batch #{batch_id}")

        # ── Aggregate statistics (per micro-batch) ──────────────────────────
        agg = batch_df.select(
            avg("altitudeFt").alias("avgAlt"),
            avg("speedKnots").alias("avgSpeed"),
            avg("engineTemperature").alias("avgEgt"),
            spark_max("engineTemperature").alias("maxEgt")
        ).collect()[0]

        # ── Build processed-events rows ────────────────────────────────────
        #   Shape stored in ClickHouse: matches flight_telemetry table schema
        processed_rows = []
        for r in batch_df.collect():
            orig = r["origin"]["code"] if r["origin"] else "UNK"
            dest = r["destination"]["code"] if r["destination"] else "UNK"
            processed_rows.append({
                "eventId":           r["eventId"]   or f"ev_{int(time.time()*1000)}",
                "timestamp":         (r["timestamp"] or batch_time)[:19].replace("T", " "),
                "flightId":          r["flightId"]  or "UNK",
                "callsign":          r["callsign"]  or "UNK",
                "latitude":          float(r["latitude"]          or 0.0),
                "longitude":         float(r["longitude"]         or 0.0),
                "altitudeFt":        int(r["altitudeFt"]          or 0),
                "speedKnots":        int(r["speedKnots"]          or 0),
                "headingDeg":        int(r["headingDeg"]          or 0),
                "verticalRateFpm":   int(r["verticalRateFpm"]     or 0),
                "squawk":            str(r["squawk"]              or "1200"),
                "status":            str(r["status"]              or "In-Flight"),
                "engineTemperature": int(r["engineTemperature"]   or 700),
                "route":             f"{orig} ➔ {dest}",
                "origin":            orig,
                "destination":       dest,
            })

        # ── Build anomaly rows ─────────────────────────────────────────────
        anomaly_rows = []
        for a in anomalies_df.collect():
            anomaly_rows.append({
                "anomalyId":         f"anom_{int(time.time()*1000)}_{a['flightId']}",
                "timestamp":         (a["timestamp"] or batch_time)[:19].replace("T", " "),
                "flightId":          a["flightId"]          or "UNK",
                "callsign":          a["callsign"]          or "UNK",
                "anomalyType":       a["anomalyType"],
                "severity":          a["severity"],
                "details":           a["details"]           or "",
                "altitudeFt":        int(a["altitudeFt"]    or 0),
                "speedKnots":        int(a["speedKnots"]    or 0),
                "engineTemperature": int(a["engineTemperature"] or 700),
                "squawk":            str(a["squawk"]        or "1200"),
            })

        # ── Build aggregate summary row ────────────────────────────────────
        aggregate_row = {
            "windowStart":    batch_time,
            "windowEnd":      batch_time,
            "totalFlights":   record_count,
            "avgAltitude":    float(agg["avgAlt"]  or 0.0),
            "avgSpeed":       float(agg["avgSpeed"] or 0.0),
            "avgEngineTemp":  float(agg["avgEgt"]  or 0.0),
            "maxEngineTemp":  int(agg["maxEgt"]    or 700),
            "anomalyCount":   anomaly_count,
        }

        # ── Publish processed telemetry to Kafka: processed-events ──────────
        if processed_rows:
            msgs = [{"key": r["flightId"], "value": json.dumps(r)} for r in processed_rows]
            _write_to_kafka(spark, KAFKA_PROCESSED_TOPIC, msgs)
            print(f"📤 Published {len(msgs)} records → Kafka: {KAFKA_PROCESSED_TOPIC}")

        # ── Publish anomalies to Kafka: anomalies ───────────────────────────
        if anomaly_rows:
            msgs = [{"key": r["flightId"], "value": json.dumps(r)} for r in anomaly_rows]
            _write_to_kafka(spark, KAFKA_ANOMALIES_TOPIC, msgs)
            print(f"🚨 Published {len(msgs)} anomalies → Kafka: {KAFKA_ANOMALIES_TOPIC}")

        # ── Publish aggregate summary alongside processed-events ───────────
        # Aggregate rows use a dedicated key so ClickHouse can route them
        agg_msg = [{"key": "aggregate", "value": json.dumps(aggregate_row)}]
        _write_to_kafka(spark, KAFKA_PROCESSED_TOPIC, agg_msg)
        print(f"📊 Aggregate summary published → Kafka: {KAFKA_PROCESSED_TOPIC}")

    def _write_to_kafka(spark, topic, messages):
        """Write a list of {key, value} dicts as a batch to a Kafka topic."""
        try:
            rows = [(m["key"], m["value"]) for m in messages]
            df = spark.createDataFrame(rows, ["key", "value"])
            (
                df.write
                .format("kafka")
                .option("kafka.bootstrap.servers", KAFKA_BROKERS)
                .option("topic", topic)
                .save()
            )
        except Exception as e:
            print(f"❌ Error writing to Kafka topic {topic}: {e}")

    # ── Start the streaming query ────────────────────────────────────────────
    query = (
        enriched_df.writeStream
        .foreachBatch(process_micro_batch)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .start()
    )

    print("✅ Structured Streaming query started — consuming flight-telemetry…")
    query.awaitTermination()


if __name__ == "__main__":
    main()
