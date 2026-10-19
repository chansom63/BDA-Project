"""
Spark Structured Streaming Ingestion Pipeline.
Subscribes to all 5 Kafka topics, performs typed JSON decoding, executes data validation
and unit normalization, enriches records with metadata, routes malformed records to quarantine,
and writes idempotently to MongoDB.
"""

import sys
import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional

from pyspark.sql import SparkSession
from pyspark.sql.functions import col

from ingestion.config import (
    KAFKA_BOOTSTRAP_SERVERS,
    ALL_KAFKA_TOPICS,
    TOPIC_TO_COLLECTION,
    COLL_INGESTION_QUARANTINE,
    SPARK_APP_NAME,
    SPARK_MASTER,
    CHECKPOINT_DIR,
    STREAMING_TRIGGER_PROCESSING_TIME,
)
from ingestion.validators import (
    validate_and_normalize_flight_event,
    validate_and_normalize_turnaround_event,
    validate_and_normalize_engine_event,
    validate_and_normalize_passenger_event,
    validate_and_normalize_crew_event,
)
from ingestion.metadata import enrich_with_metadata
from ingestion.quarantine import create_quarantine_record
from ingestion.mongo_sink import write_batch_to_mongo, init_mongo_indexes

# Map each topic to its dedicated validation and normalization function
TOPIC_VALIDATOR_MAP = {
    "flight-events": validate_and_normalize_flight_event,
    "acdm-turnaround-events": validate_and_normalize_turnaround_event,
    "engine-acars-events": validate_and_normalize_engine_event,
    "passenger-dcs-events": validate_and_normalize_passenger_event,
    "crew-clearance-events": validate_and_normalize_crew_event,
}


def process_single_message(
    topic: str,
    raw_payload_str: str,
    kafka_meta: Dict[str, Any],
    batch_id: str,
) -> Tuple[str, Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Processes an individual Kafka record:
      1. Parses JSON safely (catches malformed payloads).
      2. Runs topic-specific data quality and unit validation.
      3. Enriches with metadata.
      4. Routes to valid/partial collection or quarantine collection.

    Returns:
      (destination_collection, processed_record, quarantine_record)
    """
    # 1. Decode JSON safely
    try:
        raw_dict = json.loads(raw_payload_str)
        if not isinstance(raw_dict, dict):
            qr = create_quarantine_record(
                source_topic=topic,
                raw_payload=raw_payload_str,
                quarantine_reason="MALFORMED_JSON: Root JSON element is not an object",
                validation_errors=["Root element must be a JSON object"],
                kafka_meta=kafka_meta,
            )
            return COLL_INGESTION_QUARANTINE, None, qr
    except Exception as exc:
        qr = create_quarantine_record(
            source_topic=topic,
            raw_payload=raw_payload_str,
            quarantine_reason=f"MALFORMED_JSON: {str(exc)}",
            validation_errors=[f"Parse error: {str(exc)}"],
            kafka_meta=kafka_meta,
        )
        return COLL_INGESTION_QUARANTINE, None, qr

    # 2. Topic-specific validation
    validator_func = TOPIC_VALIDATOR_MAP.get(topic)
    if not validator_func:
        qr = create_quarantine_record(
            source_topic=topic,
            raw_payload=raw_payload_str,
            quarantine_reason=f"UNKNOWN_TOPIC: No validator defined for topic '{topic}'",
            validation_errors=[f"Unregistered topic: {topic}"],
            kafka_meta=kafka_meta,
        )
        return COLL_INGESTION_QUARANTINE, None, qr

    status, errors, normalized_dict = validator_func(raw_dict)

    # 3. Enrich with metadata
    enriched = enrich_with_metadata(
        topic=topic,
        record=normalized_dict,
        raw_payload_str=raw_payload_str,
        validation_status=status,
        validation_errors=errors,
        batch_id=batch_id,
        kafka_meta=kafka_meta,
    )

    # 4. Quarantine routing for critical failures
    target_coll = TOPIC_TO_COLLECTION.get(topic, "unknown_events")
    if status == "INVALID":
        qr = create_quarantine_record(
            source_topic=topic,
            raw_payload=raw_payload_str,
            quarantine_reason=f"DATA_QUALITY_INVALID: {'; '.join(errors)}",
            validation_errors=errors,
            kafka_meta=kafka_meta,
        )
        # We store in quarantine for inspection, and can optionally omit from main table
        return COLL_INGESTION_QUARANTINE, enriched, qr

    return target_coll, enriched, None


def process_microbatch(batch_df, batch_id):
    """
    ForeachBatch microbatch processor invoked by Spark Structured Streaming.
    Guarantees isolation, exception logging, and idempotent writes into MongoDB.
    """
    row_count = batch_df.count()
    if row_count == 0:
        return

    print(f"\n⚡ [Microbatch {batch_id}] Ingesting {row_count} messages from Kafka...")
    rows = batch_df.select(
        col("topic").cast("string"),
        col("partition").cast("int"),
        col("offset").cast("long"),
        col("timestamp"),
        col("value").cast("string"),
    ).collect()

    records_by_coll: Dict[str, List[Dict[str, Any]]] = {}
    quarantine_records: List[Dict[str, Any]] = []

    for row in rows:
        topic = row["topic"]
        raw_val = row["value"] or ""
        kafka_meta = {
            "topic": topic,
            "partition": row["partition"],
            "offset": row["offset"],
            "timestamp": row["timestamp"],
        }

        coll_name, enriched_rec, qr_rec = process_single_message(
            topic=topic,
            raw_payload_str=raw_val,
            kafka_meta=kafka_meta,
            batch_id=str(batch_id),
        )

        if qr_rec:
            quarantine_records.append(qr_rec)

        if enriched_rec:
            records_by_coll.setdefault(coll_name, []).append(enriched_rec)

    # Write processed records to each MongoDB collection idempotently
    for coll_name, recs in records_by_coll.items():
        if recs:
            count_written = write_batch_to_mongo(coll_name, recs)
            print(f"  📥 Saved {count_written} documents into MongoDB collection '{coll_name}'")

    # Write quarantine records
    if quarantine_records:
        qr_written = write_batch_to_mongo(COLL_INGESTION_QUARANTINE, quarantine_records)
        print(f"  🚨 Quarantined {qr_written} records into '{COLL_INGESTION_QUARANTINE}'")


def create_spark_session() -> SparkSession:
    """Builds and tunes the PySpark session for streaming ingestion."""
    return (
        SparkSession.builder
        .appName(SPARK_APP_NAME)
        .master(SPARK_MASTER)
        .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0")
        .config("spark.sql.streaming.forceDeleteTempCheckpointLocation", "true")
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.driver.memory", "1g")
        .getOrCreate()
    )


def run_pipeline():
    """Main entrypoint to run the Spark Structured Streaming ingestion pipeline."""
    print("=" * 70)
    print("🛫 Starting Real-Time Flight Analytics Data Ingestion Pipeline")
    print(f"📡 Kafka Brokers : {KAFKA_BOOTSTRAP_SERVERS}")
    print(f"📦 Kafka Topics  : {', '.join(ALL_KAFKA_TOPICS)}")
    print(f"📍 Checkpoint Dir: {CHECKPOINT_DIR}")
    print("=" * 70)

    # 1. Initialize MongoDB collections and indexes
    try:
        init_mongo_indexes()
    except Exception as exc:
        print(f"⚠️ Warning: MongoDB index init deferred or failed: {exc}")

    # 2. Build Spark Session
    spark = create_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    # 3. Read streaming data from Kafka
    kafka_stream = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP_SERVERS)
        .option("subscribe", ",".join(ALL_KAFKA_TOPICS))
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # 4. Write stream using foreachBatch
    query = (
        kafka_stream.writeStream
        .foreachBatch(process_microbatch)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .trigger(processingTime=STREAMING_TRIGGER_PROCESSING_TIME)
        .start()
    )

    print("🚀 Pipeline streaming query active. Waiting for incoming events...")
    query.awaitTermination()


if __name__ == "__main__":
    run_pipeline()
