"""
Common Ingestion Metadata Enrichment and Deterministic Deduplication Key Generator.
Enforces the data contract specified in Section 8 and Section 9.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from ingestion.config import SCHEMA_VERSION


def generate_deterministic_event_id(topic: str, record: Dict[str, Any]) -> str:
    """
    Generates a deterministic unique event identifier.
    Uses producer-generated unique IDs where available; otherwise uses a
    cryptographic SHA-256 hash over stable business attributes.
    """
    if topic == "engine-acars-events":
        packet_id = record.get("packet_id")
        if packet_id:
            return f"ENG-{str(packet_id).strip()}"

    if topic == "crew-clearance-events":
        crs = record.get("crs_release_number")
        ts = record.get("timestamp_utc", "")
        if crs:
            return f"CREW-{str(crs).strip()}-{str(ts).strip()}"

    # For telemetry: combination of icao24 and observation epoch
    if topic == "flight-events":
        icao = str(record.get("icao24", "")).strip().lower()
        obs_time = record.get("time_position") or record.get("event_time") or ""
        raw_key = f"FLIGHT:{icao}:{obs_time}"
        return f"FLT-{hashlib.sha256(raw_key.encode('utf-8')).hexdigest()[:16]}"

    if topic == "acdm-turnaround-events":
        flt = str(record.get("flight_number", "")).strip().upper()
        tail = str(record.get("tail_number", "")).strip().upper()
        ts = str(record.get("timestamp_utc", "")).strip()
        tobt = str(record.get("milestone_tobt", "")).strip()
        raw_key = f"ACDM:{flt}:{tail}:{ts}:{tobt}"
        return f"ACDM-{hashlib.sha256(raw_key.encode('utf-8')).hexdigest()[:16]}"

    if topic == "passenger-dcs-events":
        flt = str(record.get("flight_number", "")).strip().upper()
        orig = str(record.get("origin_iata", "")).strip().upper()
        dest = str(record.get("destination_iata", "")).strip().upper()
        ts = str(record.get("timestamp_utc", "")).strip()
        raw_key = f"DCS:{flt}:{orig}:{dest}:{ts}"
        return f"DCS-{hashlib.sha256(raw_key.encode('utf-8')).hexdigest()[:16]}"

    # Fallback deterministic key
    serialized = json.dumps(record, sort_keys=True, default=str)
    return f"EVT-{hashlib.sha256(serialized.encode('utf-8')).hexdigest()[:16]}"


def get_event_type_for_topic(topic: str) -> str:
    """Returns the logical event category for a given Kafka topic."""
    mapping = {
        "flight-events": "flight_telemetry",
        "acdm-turnaround-events": "turnaround_milestone",
        "engine-acars-events": "engine_condition",
        "passenger-dcs-events": "passenger_boarding",
        "crew-clearance-events": "crew_maintenance_clearance",
    }
    return mapping.get(topic, "generic_operational_event")


def enrich_with_metadata(
    topic: str,
    record: Dict[str, Any],
    raw_payload_str: str,
    validation_status: str,
    validation_errors: list,
    batch_id: Optional[str] = None,
    kafka_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Enriches a validated record with the common ingestion metadata contract
    and cross-stream correlation fields without mutating producer payload.
    """
    now_utc = datetime.now(timezone.utc)
    event_id = generate_deterministic_event_id(topic, record)
    event_type = get_event_type_for_topic(topic)

    # Determine normalized event time in UTC
    event_time_utc = record.get("observation_timestamp_utc") or record.get("event_time_utc_dt")
    if event_time_utc is None:
        # Fallback to ingestion time if missing, but mark it
        event_time_utc = now_utc

    enriched = dict(record)

    # Clean temporary helper keys
    enriched.pop("observation_timestamp_utc", None)
    enriched.pop("event_time_utc_dt", None)

    # Derive flight date (YYYY-MM-DD) for cross-stream correlation
    flight_date = event_time_utc.strftime("%Y-%m-%d") if isinstance(event_time_utc, datetime) else None

    # Attach common metadata
    enriched["_id"] = event_id
    enriched["event_id"] = event_id
    enriched["event_type"] = event_type
    enriched["source_topic"] = topic
    enriched["source_system"] = record.get("source", "UNKNOWN_SOURCE")
    enriched["event_time_utc"] = event_time_utc
    enriched["flight_date"] = flight_date
    enriched["ingested_at_utc"] = now_utc
    enriched["processed_at_utc"] = now_utc
    enriched["schema_version"] = SCHEMA_VERSION
    enriched["ingestion_batch_id"] = batch_id or "batch_0"
    enriched["validation_status"] = validation_status
    enriched["validation_errors"] = validation_errors
    enriched["raw_payload"] = raw_payload_str

    # Attach Kafka provenance if available
    if kafka_meta:
        enriched["kafka_topic"] = kafka_meta.get("topic")
        enriched["kafka_partition"] = kafka_meta.get("partition")
        enriched["kafka_offset"] = kafka_meta.get("offset")
        enriched["kafka_timestamp"] = kafka_meta.get("timestamp")

    return enriched
