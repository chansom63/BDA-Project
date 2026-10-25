"""
Tests for edge cases: malformed JSON, quarantine routing, missing fields,
duplicate messages, and late-arriving events.
"""

from datetime import datetime, timezone, timedelta
from ingestion.pipeline import process_single_message
from ingestion.config import COLL_INGESTION_QUARANTINE, COLL_FLIGHT_EVENTS, COLL_PASSENGER_DCS_EVENTS


def test_malformed_json_quarantined():
    malformed_raw = "{not_valid_json: true, broken...}"
    kafka_meta = {"topic": "flight-events", "partition": 0, "offset": 10, "timestamp": datetime.now(timezone.utc)}

    target_coll, enriched, qr = process_single_message(
        topic="flight-events",
        raw_payload_str=malformed_raw,
        kafka_meta=kafka_meta,
        batch_id="test_batch_1",
    )

    assert target_coll == COLL_INGESTION_QUARANTINE
    assert enriched is None
    assert qr is not None
    assert qr["quarantine_reason"].startswith("MALFORMED_JSON")
    assert qr["raw_payload"] == malformed_raw


def test_critically_invalid_record_quarantined(sample_passenger_data):
    # Passenger boarded exceeds aircraft capacity
    bad = dict(sample_passenger_data)
    bad["total_seating_capacity"] = 150
    bad["boarded_passengers"] = 200
    import json
    raw_str = json.dumps(bad)

    kafka_meta = {"topic": "passenger-dcs-events", "partition": 1, "offset": 50, "timestamp": datetime.now(timezone.utc)}

    target_coll, enriched, qr = process_single_message(
        topic="passenger-dcs-events",
        raw_payload_str=raw_str,
        kafka_meta=kafka_meta,
        batch_id="test_batch_2",
    )

    assert target_coll == COLL_INGESTION_QUARANTINE
    assert qr is not None
    assert qr["quarantine_reason"].startswith("DATA_QUALITY_INVALID")
    assert any("exceeds aircraft capacity" in e for e in qr["validation_errors"])


def test_duplicate_event_produces_identical_id(sample_flight_data):
    import json
    raw_str = json.dumps(sample_flight_data)
    kafka_meta = {"topic": "flight-events", "partition": 0, "offset": 100, "timestamp": datetime.now(timezone.utc)}

    _, enriched_1, _ = process_single_message("flight-events", raw_str, kafka_meta, "batch_1")
    _, enriched_2, _ = process_single_message("flight-events", raw_str, kafka_meta, "batch_2")

    assert enriched_1["event_id"] == enriched_2["event_id"]
    assert enriched_1["_id"] == enriched_2["_id"]


def test_late_arriving_event_handled(sample_flight_data):
    import json
    # Event occurred 2 hours ago
    past_epoch = int((datetime.now(timezone.utc) - timedelta(hours=2)).timestamp())
    late_data = dict(sample_flight_data)
    late_data["time_position"] = past_epoch
    late_data["event_time"] = past_epoch
    raw_str = json.dumps(late_data)

    kafka_meta = {"topic": "flight-events", "partition": 0, "offset": 200, "timestamp": datetime.now(timezone.utc)}

    target_coll, enriched, qr = process_single_message("flight-events", raw_str, kafka_meta, "batch_late")

    assert target_coll == COLL_FLIGHT_EVENTS
    assert enriched["validation_status"] == "VALID"
    assert enriched["event_time_utc"] < enriched["ingested_at_utc"]
