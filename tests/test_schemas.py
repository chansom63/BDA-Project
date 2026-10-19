"""
Tests for explicit PySpark StructType schemas.
Verifies parsing of sample JSON payloads and nested structs.
"""

import json
from pyspark.sql.functions import from_json, col
from ingestion.schemas import (
    FLIGHT_EVENTS_SCHEMA,
    TURNAROUND_EVENTS_SCHEMA,
    ENGINE_ACARS_EVENTS_SCHEMA,
    PASSENGER_DCS_EVENTS_SCHEMA,
    CREW_CLEARANCE_EVENTS_SCHEMA,
)


def test_flight_events_schema(spark, sample_flight_data):
    json_str = json.dumps(sample_flight_data)
    df = spark.createDataFrame([(json_str,)], ["value"])
    parsed_df = df.select(from_json(col("value"), FLIGHT_EVENTS_SCHEMA).alias("data")).select("data.*")

    row = parsed_df.first()
    assert row["icao24"] == "800b21"
    assert row["callsign"] == "SG8181"
    assert row["latitude"] == 24.1892
    assert row["longitude"] == 75.3124
    assert row["velocity"] == 235.4
    assert row["squawk"] == "7000"


def test_turnaround_events_schema(spark, sample_turnaround_data):
    json_str = json.dumps(sample_turnaround_data)
    df = spark.createDataFrame([(json_str,)], ["value"])
    parsed_df = df.select(from_json(col("value"), TURNAROUND_EVENTS_SCHEMA).alias("data")).select("data.*")

    row = parsed_df.first()
    assert row["flight_number"] == "SG 8181"
    assert row["tail_number"] == "VT-SGB"
    assert row["origin_airport"] == "DEL"
    assert row["tobt_variance_minutes"] == 18
    # Test nested struct
    assert row["ramp_services"]["fueling_liters_uplifted"] == 4018.0
    assert row["ramp_services"]["deboarding_completed"] is True


def test_engine_acars_events_schema(spark, sample_engine_data):
    json_str = json.dumps(sample_engine_data)
    df = spark.createDataFrame([(json_str,)], ["value"])
    parsed_df = df.select(from_json(col("value"), ENGINE_ACARS_EVENTS_SCHEMA).alias("data")).select("data.*")

    row = parsed_df.first()
    assert row["packet_id"] == "ACARS-SIM-1792411200-2"
    assert row["engine_1"]["remaining_useful_life_cycles"] == 2324
    assert row["engine_2"]["remaining_useful_life_cycles"] == 2383
    assert row["engine_1"]["egt_margin_c"] == 26.4
    assert row["apu_hours"] == 9430.2


def test_passenger_dcs_events_schema(spark, sample_passenger_data):
    json_str = json.dumps(sample_passenger_data)
    df = spark.createDataFrame([(json_str,)], ["value"])
    parsed_df = df.select(from_json(col("value"), PASSENGER_DCS_EVENTS_SCHEMA).alias("data")).select("data.*")

    row = parsed_df.first()
    assert row["flight_number"] == "SG 8181"
    assert row["boarded_passengers"] == 162
    assert row["class_split"]["spiceplus_boarded"] == 12
    assert row["special_service_requests"]["wchr_wheelchair"] == 4


def test_crew_clearance_events_schema(spark, sample_crew_data):
    json_str = json.dumps(sample_crew_data)
    df = spark.createDataFrame([(json_str,)], ["value"])
    parsed_df = df.select(from_json(col("value"), CREW_CLEARANCE_EVENTS_SCHEMA).alias("data")).select("data.*")

    row = parsed_df.first()
    assert row["crs_release_number"] == "CRS-DEL-20261019-102"
    assert row["pre_flight_inspection"] == "PASSED"
    assert row["cockpit_crew_fdtl"]["mandatory_rest_compliant"] is True
