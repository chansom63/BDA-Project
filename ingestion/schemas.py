"""
PySpark Schemas for all 5 Kafka Ingestion Topics and System Metadata.
Explicitly typed, no schema inference, preserving nested structures.
"""

from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    LongType,
    DoubleType,
    BooleanType,
    IntegerType,
    TimestampType,
    ArrayType,
)

# ==============================================================================
# Topic 1: flight-events (External OpenSky ADS-B telemetry)
# ==============================================================================
FLIGHT_EVENTS_SCHEMA = StructType([
    StructField("event_time", LongType(), True),           # Unix epoch timestamp of response
    StructField("icao24", StringType(), True),             # 24-bit ICAO transponder hex
    StructField("callsign", StringType(), True),           # Flight callsign (e.g. SG8181)
    StructField("origin_country", StringType(), True),     # Country inferred from icao24
    StructField("time_position", LongType(), True),        # Epoch time of last position update
    StructField("last_contact", LongType(), True),         # Epoch time of last contact
    StructField("longitude", DoubleType(), True),          # WGS-84 degrees (-180 to 180)
    StructField("latitude", DoubleType(), True),           # WGS-84 degrees (-90 to 90)
    StructField("baro_altitude", DoubleType(), True),      # Barometric altitude (m)
    StructField("on_ground", BooleanType(), True),         # Aircraft on ground flag
    StructField("velocity", DoubleType(), True),           # Ground speed (m/s)
    StructField("true_track", DoubleType(), True),         # Track angle (deg clockwise from N)
    StructField("vertical_rate", DoubleType(), True),      # Vertical speed (m/s)
    StructField("geo_altitude", DoubleType(), True),       # Geometric altitude (m)
    StructField("squawk", StringType(), True),             # Transponder code, preserves leading 0s
])

# ==============================================================================
# Topic 2: acdm-turnaround-events (A-CDM Turnaround Milestones)
# ==============================================================================
RAMP_SERVICES_SCHEMA = StructType([
    StructField("deboarding_completed", BooleanType(), True),
    StructField("cleaning_completed", BooleanType(), True),
    StructField("catering_completed", BooleanType(), True),
    StructField("fueling_liters_uplifted", DoubleType(), True),
    StructField("fueling_completed", BooleanType(), True),
    StructField("baggage_loading_pct", DoubleType(), True),
    StructField("boarding_pct", DoubleType(), True),
])

TURNAROUND_EVENTS_SCHEMA = StructType([
    StructField("timestamp_utc", StringType(), True),       # ISO-8601 UTC string
    StructField("flight_number", StringType(), True),       # Flight number (e.g. SG 8181)
    StructField("tail_number", StringType(), True),         # Aircraft registration (e.g. VT-SGB)
    StructField("origin_airport", StringType(), True),      # IATA/ICAO code (e.g. DEL)
    StructField("stand_gate", StringType(), True),          # Stand or Gate identifier (T3-G14)
    StructField("milestone_sobt", StringType(), True),      # Scheduled Off-Block Time (e.g. 08:00)
    StructField("milestone_tobt", StringType(), True),      # Target Off-Block Time (e.g. 08:18)
    StructField("milestone_tsat", StringType(), True),      # Target Startup Approval Time (08:23)
    StructField("tobt_variance_minutes", IntegerType(), True), # Variance in minutes
    StructField("turnaround_progress_pct", DoubleType(), True),# Progress (0 - 100%)
    StructField("ramp_services", RAMP_SERVICES_SCHEMA, True),# Nested ramp service status
    StructField("iata_delay_code", StringType(), True),     # IATA delay code (e.g. "35")
    StructField("source", StringType(), True),              # System generator source
])

# ==============================================================================
# Topic 3: engine-acars-events (FADEC / ACARS Diagnostics)
# ==============================================================================
ENGINE_MEASUREMENT_SCHEMA = StructType([
    StructField("egt_margin_c", DoubleType(), True),        # EGT margin in °C
    StructField("vibration_n1", DoubleType(), True),        # N1 spool vibration
    StructField("vibration_n2", DoubleType(), True),        # N2 spool vibration
    StructField("oil_pressure_psi", DoubleType(), True),    # Oil pressure in psi
    StructField("oil_temperature_c", DoubleType(), True),   # Oil temperature in °C
    StructField("sfc_drift_pct", DoubleType(), True),       # Specific fuel consumption drift %
    StructField("remaining_useful_life_cycles", IntegerType(), True), # RUL cycles
])

ENGINE_ACARS_EVENTS_SCHEMA = StructType([
    StructField("packet_id", StringType(), True),           # Unique packet ID for deduplication
    StructField("timestamp_utc", StringType(), True),       # ISO-8601 UTC string
    StructField("tail_number", StringType(), True),         # Aircraft registration
    StructField("aircraft_model", StringType(), True),      # e.g. Boeing 737-800
    StructField("engine_model", StringType(), True),        # e.g. CFM56-7B26
    StructField("engine_1", ENGINE_MEASUREMENT_SCHEMA, True),# Engine 1 diagnostics
    StructField("engine_2", ENGINE_MEASUREMENT_SCHEMA, True),# Engine 2 diagnostics
    StructField("apu_hours", DoubleType(), True),           # Auxiliary Power Unit hours
    StructField("apu_bleed_status", StringType(), True),    # e.g. NORMAL, DEGRADED
    StructField("source", StringType(), True),              # Source simulator
])

# ==============================================================================
# Topic 4: passenger-dcs-events (Departure Control System)
# ==============================================================================
CLASS_SPLIT_SCHEMA = StructType([
    StructField("spiceplus_boarded", IntegerType(), True),
    StructField("spiceflex_boarded", IntegerType(), True),
    StructField("economy_boarded", IntegerType(), True),
])

SPECIAL_SERVICE_REQUESTS_SCHEMA = StructType([
    StructField("wchr_wheelchair", IntegerType(), True),
    StructField("infants_onboard", IntegerType(), True),
    StructField("preordered_meals", IntegerType(), True),
])

PASSENGER_DCS_EVENTS_SCHEMA = StructType([
    StructField("timestamp_utc", StringType(), True),
    StructField("flight_number", StringType(), True),
    StructField("tail_number", StringType(), True),
    StructField("origin_iata", StringType(), True),
    StructField("destination_iata", StringType(), True),
    StructField("total_seating_capacity", IntegerType(), True),
    StructField("booked_passengers", IntegerType(), True),
    StructField("boarded_passengers", IntegerType(), True),
    StructField("digiyatra_biometric_count", IntegerType(), True),
    StructField("digiyatra_adoption_pct", DoubleType(), True),
    StructField("class_split", CLASS_SPLIT_SCHEMA, True),
    StructField("special_service_requests", SPECIAL_SERVICE_REQUESTS_SCHEMA, True),
    StructField("source", StringType(), True),
])

# ==============================================================================
# Topic 5: crew-clearance-events (MRO & Crew Duty / Clearance)
# ==============================================================================
COCKPIT_CREW_FDTL_SCHEMA = StructType([
    StructField("captain_hours_28d", DoubleType(), True),
    StructField("first_officer_hours_28d", DoubleType(), True),
    StructField("mandatory_rest_compliant", BooleanType(), True),
    StructField("fdp_within_limits", BooleanType(), True),
])

CREW_CLEARANCE_EVENTS_SCHEMA = StructType([
    StructField("timestamp_utc", StringType(), True),
    StructField("flight_number", StringType(), True),
    StructField("tail_number", StringType(), True),
    StructField("origin_iata", StringType(), True),
    StructField("certifying_ame_license", StringType(), True),
    StructField("crs_release_number", StringType(), True),
    StructField("pre_flight_inspection", StringType(), True), # PASSED, FAILED, PENDING
    StructField("engine_oil_uplift_qts", DoubleType(), True),
    StructField("tlb_technical_logbook_signed", BooleanType(), True),
    StructField("cockpit_crew_fdtl", COCKPIT_CREW_FDTL_SCHEMA, True),
    StructField("source", StringType(), True),
])

# ==============================================================================
# Common Ingestion Metadata Schema (Section 8)
# ==============================================================================
COMMON_METADATA_FIELDS = [
    StructField("event_id", StringType(), False),           # Deterministic deduplication key
    StructField("event_type", StringType(), False),         # Logical event category
    StructField("source_topic", StringType(), False),       # Kafka topic
    StructField("source_system", StringType(), True),       # Original system
    StructField("event_time_utc", TimestampType(), True),   # Normalized event time in UTC
    StructField("ingested_at_utc", TimestampType(), False), # Time received by Spark
    StructField("processed_at_utc", TimestampType(), False),# Time processed by Spark
    StructField("schema_version", StringType(), False),     # Version of data contract (1.0.0)
    StructField("ingestion_batch_id", StringType(), True),  # Microbatch ID
    StructField("validation_status", StringType(), False),  # VALID, INVALID, PARTIAL
    StructField("validation_errors", ArrayType(StringType()), True), # Error/warning reasons
    StructField("raw_payload", StringType(), True),         # Full original JSON
]

# ==============================================================================
# Quarantine Record Schema (Section 10, 11)
# ==============================================================================
QUARANTINE_RECORD_SCHEMA = StructType([
    StructField("event_id", StringType(), False),
    StructField("source_topic", StringType(), False),
    StructField("received_at_utc", TimestampType(), False),
    StructField("quarantine_reason", StringType(), False),
    StructField("validation_errors", ArrayType(StringType()), True),
    StructField("raw_payload", StringType(), True),
    StructField("kafka_topic", StringType(), True),
    StructField("kafka_partition", IntegerType(), True),
    StructField("kafka_offset", LongType(), True),
    StructField("kafka_timestamp", TimestampType(), True),
])

# Registry for topic schema lookups
TOPIC_SCHEMA_MAP = {
    "flight-events": FLIGHT_EVENTS_SCHEMA,
    "acdm-turnaround-events": TURNAROUND_EVENTS_SCHEMA,
    "engine-acars-events": ENGINE_ACARS_EVENTS_SCHEMA,
    "passenger-dcs-events": PASSENGER_DCS_EVENTS_SCHEMA,
    "crew-clearance-events": CREW_CLEARANCE_EVENTS_SCHEMA,
}
