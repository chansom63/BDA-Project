"""
Quarantine Strategy Module.
Routes malformed JSON and critically invalid records to the quarantine store,
preserving raw payloads and diagnostic error reasons for auditing and replay.
"""

import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from ingestion.config import COLL_INGESTION_QUARANTINE


def create_quarantine_record(
    source_topic: str,
    raw_payload: str,
    quarantine_reason: str,
    validation_errors: Optional[List[str]] = None,
    kafka_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Constructs a standardized quarantine document for MongoDB ingestion_quarantine collection.
    """
    now_utc = datetime.now(timezone.utc)
    raw_key = f"{source_topic}:{now_utc.isoformat()}:{raw_payload[:64]}"
    quarantine_id = f"QRN-{hashlib.sha256(raw_key.encode('utf-8')).hexdigest()[:16]}"

    record = {
        "_id": quarantine_id,
        "event_id": quarantine_id,
        "source_topic": source_topic,
        "received_at_utc": now_utc,
        "quarantine_reason": quarantine_reason,
        "validation_errors": validation_errors or [quarantine_reason],
        "raw_payload": raw_payload,
        "resolved": False,
        "resolution_notes": None,
    }

    if kafka_meta:
        record["kafka_topic"] = kafka_meta.get("topic")
        record["kafka_partition"] = kafka_meta.get("partition")
        record["kafka_offset"] = kafka_meta.get("offset")
        record["kafka_timestamp"] = kafka_meta.get("timestamp")

    return record
