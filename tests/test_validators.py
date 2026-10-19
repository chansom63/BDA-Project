"""
Unit tests for data validation, unit normalization, coordinate checks,
and status assignment across all 5 topic validators.
"""

from ingestion.validators import (
    validate_and_normalize_flight_event,
    validate_and_normalize_turnaround_event,
    validate_and_normalize_engine_event,
    validate_and_normalize_passenger_event,
    validate_and_normalize_crew_event,
)


def test_flight_event_valid(sample_flight_data):
    status, errors, norm = validate_and_normalize_flight_event(sample_flight_data)
    assert status == "VALID"
    assert len(errors) == 0
    assert norm["icao24"] == "800b21"
    assert norm["squawk"] == "7000"
    assert norm["altitude_source_unit"] == "metres"
    assert norm["observation_timestamp_utc"] is not None


def test_flight_event_invalid_coordinates(sample_flight_data):
    bad = dict(sample_flight_data)
    bad["latitude"] = 99.5  # > 90
    bad["longitude"] = -200.0  # < -180
    status, errors, norm = validate_and_normalize_flight_event(bad)
    assert status == "INVALID"
    assert any("Latitude out of valid range" in e for e in errors)
    assert any("Longitude out of valid range" in e for e in errors)


def test_flight_event_negative_velocity(sample_flight_data):
    bad = dict(sample_flight_data)
    bad["velocity"] = -10.5
    status, errors, norm = validate_and_normalize_flight_event(bad)
    assert status == "INVALID"
    assert any("Negative velocity" in e for e in errors)


def test_flight_event_missing_coordinates_remains_null(sample_flight_data):
    clean = dict(sample_flight_data)
    clean["latitude"] = None
    clean["longitude"] = None
    status, errors, norm = validate_and_normalize_flight_event(clean)
    assert norm["latitude"] is None
    assert norm["longitude"] is None


def test_turnaround_event_valid(sample_turnaround_data):
    status, errors, norm = validate_and_normalize_turnaround_event(sample_turnaround_data)
    assert status == "VALID"
    assert norm["origin_airport"] == "DEL"
    assert norm["flight_number"] == "SG 8181"
    assert "milestone_tobt_utc" in norm


def test_turnaround_event_airport_case_normalization(sample_turnaround_data):
    rec = dict(sample_turnaround_data)
    rec["origin_airport"] = "bom"
    status, errors, norm = validate_and_normalize_turnaround_event(rec)
    assert norm["origin_airport"] == "BOM"


def test_engine_event_valid(sample_engine_data):
    status, errors, norm = validate_and_normalize_engine_event(sample_engine_data)
    assert status == "VALID"
    assert norm["packet_id"] == "ACARS-SIM-1792411200-2"
    assert norm["engine_1"]["remaining_useful_life_cycles"] == 2324


def test_passenger_event_boarded_exceeds_capacity(sample_passenger_data):
    bad = dict(sample_passenger_data)
    bad["total_seating_capacity"] = 100
    bad["boarded_passengers"] = 150
    status, errors, norm = validate_and_normalize_passenger_event(bad)
    assert status == "INVALID"
    assert any("exceeds aircraft capacity" in e for e in errors)


def test_passenger_event_class_split_mismatch(sample_passenger_data):
    partial = dict(sample_passenger_data)
    # Total boarded is 162, but classes sum to 100
    partial["class_split"] = {
        "spiceplus_boarded": 10,
        "spiceflex_boarded": 10,
        "economy_boarded": 80,
    }
    status, errors, norm = validate_and_normalize_passenger_event(partial)
    assert status == "PARTIAL"
    assert any("Class split sum" in e for e in errors)


def test_crew_event_unfamiliar_inspection_status(sample_crew_data):
    rec = dict(sample_crew_data)
    rec["pre_flight_inspection"] = "CONDITIONAL_APPROVAL"
    status, errors, norm = validate_and_normalize_crew_event(rec)
    assert status == "PARTIAL"
    assert any("Unfamiliar pre_flight_inspection" in e for e in errors)
    assert norm["pre_flight_inspection"] == "CONDITIONAL_APPROVAL"
