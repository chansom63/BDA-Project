"""
Tests for deterministic event_id generation and common metadata enrichment.
"""

from datetime import datetime, timezone
from ingestion.metadata import generate_deterministic_event_id, enrich_with_metadata


def test_deterministic_event_id_stable(sample_flight_data):
    id1 = generate_deterministic_event_id("flight-events", sample_flight_data)
    id2 = generate_deterministic_event_id("flight-events", sample_flight_data)
    assert id1 == id2
    assert id1.startswith("FLT-")


def test_deterministic_event_id_distinct_for_different_times(sample_flight_data):
    d1 = dict(sample_flight_data)
    d2 = dict(sample_flight_data)
    d2["time_position"] = d1["time_position"] + 10

    id1 = generate_deterministic_event_id("flight-events", d1)
    id2 = generate_deterministic_event_id("flight-events", d2)
    assert id1 != id2


def test_engine_packet_id_used_as_event_id(sample_engine_data):
    eid = generate_deterministic_event_id("engine-acars-events", sample_engine_data)
    assert eid == "ENG-ACARS-SIM-1792411200-2"


def test_enrich_with_metadata_fields(sample_flight_data):
    enriched = enrich_with_metadata(
        topic="flight-events",
        record=sample_flight_data,
        raw_payload_str="{}",
        validation_status="VALID",
        validation_errors=[],
        batch_id="batch_42",
        kafka_meta={"topic": "flight-events", "partition": 0, "offset": 100, "timestamp": datetime.now(timezone.utc)},
    )

    assert enriched["event_id"].startswith("FLT-")
    assert enriched["event_type"] == "flight_telemetry"
    assert enriched["schema_version"] == "1.0.0"
    assert enriched["ingestion_batch_id"] == "batch_42"
    assert enriched["validation_status"] == "VALID"
    assert enriched["kafka_partition"] == 0
    assert enriched["kafka_offset"] == 100
    assert "flight_date" in enriched
