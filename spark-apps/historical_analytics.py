#!/usr/bin/env python3
"""
Spark SQL Historical Batch Analytics Application
Performs SQL queries on historical flight telemetry stored in HDFS.
"""

import os
import sys
import time
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, avg, max, min, count, desc

HDFS_NAMENODE = os.getenv("HDFS_NAMENODE", "hdfs://namenode:9000")
PROCESSED_PATH = f"{HDFS_NAMENODE}/flight-telemetry/processed"
ANOMALIES_PATH = f"{HDFS_NAMENODE}/flight-telemetry/anomalies"
ANALYTICS_OUT_PATH = f"{HDFS_NAMENODE}/flight-telemetry/analytics"

print("=" * 60)
print("📊 Running Spark SQL Historical Batch Analytics Job")
print(f"🐘 HDFS NameNode: {HDFS_NAMENODE}")
print(f"📂 Reading Processed: {PROCESSED_PATH}")
print(f"📂 Reading Anomalies: {ANOMALIES_PATH}")
print("=" * 60)

spark = (
    SparkSession.builder
    .appName("FlightHistoricalSQLAnalytics")
    .config("spark.sql.shuffle.partitions", "2")
    .getOrCreate()
)
spark.sparkContext.setLogLevel("WARN")

try:
    print("\n[1/5] Loading Historical Processed Telemetry from HDFS...")
    processed_df = spark.read.json(PROCESSED_PATH)
    processed_df.createOrReplaceTempView("historical_telemetry")
    total_processed = processed_df.count()
    print(f"✅ Loaded {total_processed} processed records.")

    print("\n--- 📈 Analytical Query 1: Average Altitude & Speed by Aircraft Type ---")
    q1 = spark.sql("""
        SELECT 
            aircraftType,
            COUNT(DISTINCT flightId) AS unique_flights,
            ROUND(AVG(altitudeFt), 0) AS avg_altitude_ft,
            ROUND(AVG(speedKnots), 0) AS avg_speed_knots,
            ROUND(AVG(engineTemperature), 1) AS avg_egt_celsius,
            MAX(engineTemperature) AS max_egt_celsius
        FROM historical_telemetry
        GROUP BY aircraftType
        ORDER BY unique_flights DESC
        LIMIT 10
    """)
    q1.show(truncate=False)

    print("\n--- 📈 Analytical Query 2: Engine Temperature & Airline Health ---")
    q2 = spark.sql("""
        SELECT 
            airline,
            COUNT(flightId) AS total_reports,
            ROUND(AVG(engineTemperature), 1) AS avg_engine_temp,
            MAX(engineTemperature) AS peak_engine_temp,
            SUM(CASE WHEN engineTemperature >= 900 THEN 1 ELSE 0 END) AS overheat_incidents
        FROM historical_telemetry
        GROUP BY airline
        ORDER BY peak_engine_temp DESC
        LIMIT 10
    """)
    q2.show(truncate=False)

    print("\n--- 📈 Analytical Query 3: Busiest Corridors / Routes ---")
    q3 = spark.sql("""
        SELECT 
            origin.code AS origin_airport,
            destination.code AS dest_airport,
            COUNT(DISTINCT flightId) AS flights_active,
            ROUND(AVG(speedKnots), 0) AS avg_speed_knots
        FROM historical_telemetry
        WHERE origin.code IS NOT NULL AND destination.code IS NOT NULL
        GROUP BY origin.code, destination.code
        ORDER BY flights_active DESC
        LIMIT 8
    """)
    q3.show(truncate=False)

    print("\n[2/5] Loading Historical Anomalies from HDFS...")
    try:
        anomalies_df = spark.read.json(ANOMALIES_PATH)
        anomalies_df.createOrReplaceTempView("historical_anomalies")
        total_anomalies = anomalies_df.count()
        print(f"✅ Loaded {total_anomalies} anomaly records.")

        print("\n--- ⚠️ Analytical Query 4: Anomaly Breakdown by Type & Severity ---")
        q4 = spark.sql("""
            SELECT 
                anomalyType,
                severity,
                COUNT(*) AS occurrences,
                ROUND(AVG(altitudeFt), 0) AS avg_alt_at_anomaly,
                ROUND(AVG(engineTemperature), 0) AS avg_egt_at_anomaly
            FROM historical_anomalies
            GROUP BY anomalyType, severity
            ORDER BY occurrences DESC
        """)
        q4.show(truncate=False)
    except Exception as anom_err:
        print(f"ℹ️ Anomalies dataset empty or still building: {anom_err}")

    # Write summary analytics output to HDFS
    print(f"\n[3/5] Writing summary analytics to HDFS: {ANALYTICS_OUT_PATH}...")
    q1.coalesce(1).write.mode("overwrite").json(f"{ANALYTICS_OUT_PATH}/aircraft_stats")
    q2.coalesce(1).write.mode("overwrite").json(f"{ANALYTICS_OUT_PATH}/airline_engine_stats")
    print(f"✅ Batch historical analytics completed successfully and saved to HDFS.")

except Exception as e:
    print(f"❌ Error running historical analytics: {e}")
    sys.exit(1)
finally:
    spark.stop()
