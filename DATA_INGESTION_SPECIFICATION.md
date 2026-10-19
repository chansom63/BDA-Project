# Real-Time Flight Analytics Platform: Data Ingestion & Schema Specification

**Architecture:** Data Sources → Apache Kafka → Apache Spark Structured Streaming → MongoDB → Streamlit Dashboard

---

## 1. Executive Summary & Architecture Overview

This platform implements an end-to-end distributed data engineering pipeline designed to ingest, validate, standardize, and store real-time aircraft telemetry and simulated airline operational data. 

The pipeline ingests events from five dedicated Apache Kafka topics, applies explicit typed schemas in Apache Spark Structured Streaming, enriches records with provenance metadata, enforces data-quality bounds, isolates corrupt records into a dedicated quarantine collection, and executes idempotent writes into MongoDB. Real-time operational metrics are queried directly by a centralized Streamlit dashboard.

```
┌─────────────────────────────────┐
│     EXTERNAL & SIMULATED        │
│          DATA SOURCES           │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       APACHE KAFKA BROKER       │
│  ├── flight-events              │
│  ├── acdm-turnaround-events     │
│  ├── engine-acars-events        │
│  ├── passenger-dcs-events       │
│  └── crew-clearance-events      │
└────────────────┬────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│        APACHE SPARK STRUCTURED STREAMING               │
│  ├── Explicit Schema JSON Parsing (No Inference)       │
│  ├── Timestamp Standardization (UTC ISO-8601 / Epoch)  │
│  ├── Unit Normalization & Coordinate Validation        │
│  ├── Common Metadata Attachment & Deterministic ID Gen │
│  └── Quarantine Router (Catches Malformed/Invalid)     │
└───────────────┬───────────────────────────────┬────────┘
                │                               │
                ▼ (Valid / Partial)             ▼ (Corrupt / Invalid)
┌────────────────────────────────┐ ┌────────────────────────────────┐
│      MONGODB DATABASE          │ │      MONGODB DATABASE          │
│  ├── flight_events             │ │  └── ingestion_quarantine      │
│  ├── turnaround_events         │ └────────────────────────────────┘
│  ├── engine_health_events      │
│  ├── passenger_dcs_events      │
│  └── crew_clearance_events     │
└───────────────┬────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│       STREAMLIT DASHBOARD       │
│  ├── Live Radar & Aircraft Map  │
│  ├── A-CDM Turnaround Milestones│
│  ├── Engine Health & RUL Cycles │
│  ├── Pax DCS Load & DigiYatra   │
│  ├── MRO Crew Duty Clearance    │
│  └── Quarantine & Data Quality  │
└─────────────────────────────────┘
```

---

## 2. Kafka Topics & Ingestion Schemas

The platform maintains five independent Kafka topics with strict schemas.

### Topic 1: `flight-events`
- **Purpose:** Ingests live OpenSky Network ADS-B telemetry state-vectors.
- **Spark Schema:**

| Field | Spark Type | Nullable | Description |
|---|---|---|---|
| `event_time` | `LongType` | Yes | Unix epoch timestamp of OpenSky response |
| `icao24` | `StringType` | Yes | 24-bit ICAO aircraft transponder identifier |
| `callsign` | `StringType` | Yes | Commercial flight callsign (e.g. `SG8181`) |
| `origin_country` | `StringType` | Yes | Country registered with ICAO |
| `time_position` | `LongType` | Yes | Epoch timestamp of latest position fix |
| `last_contact` | `LongType` | Yes | Epoch timestamp of last radio contact |
| `longitude` | `DoubleType` | Yes | WGS-84 longitude (-180° to +180°) |
| `latitude` | `DoubleType` | Yes | WGS-84 latitude (-90° to +90°) |
| `baro_altitude` | `DoubleType` | Yes | Barometric altitude (m) |
| `on_ground` | `BooleanType` | Yes | Ground status flag |
| `velocity` | `DoubleType` | Yes | Ground speed (m/s) |
| `true_track` | `DoubleType` | Yes | Direction of motion (0° to 360°) |
| `vertical_rate` | `DoubleType` | Yes | Climb/descent rate (m/s) |
| `geo_altitude` | `DoubleType` | Yes | Geometric altitude (m) |
| `squawk` | `StringType` | Yes | 4-digit transponder code (e.g. `7000`, `7700`) |

- **Validation & Normalization Rules:**
  - Latitude validated in $[-90.0, 90.0]$.
  - Longitude validated in $[-180.0, 180.0]$.
  - Velocity must be $\ge 0.0$; negative speed triggers quarantine.
  - Missing coordinates remain `null`; synthetic or 0.0 coordinates are never fabricated.
  - Observation timestamp prefers `time_position` if non-zero; otherwise falls back to `event_time`.

---

### Topic 2: `acdm-turnaround-events`
- **Purpose:** Tracks Airport Collaborative Decision Making (A-CDM) milestones and ramp services.
- **Spark Schema:**

| Field | Spark Type | Nullable | Description |
|---|---|---|---|
| `timestamp_utc` | `StringType` | Yes | ISO-8601 UTC timestamp string |
| `flight_number` | `StringType` | Yes | Scheduled flight number |
| `tail_number` | `StringType` | Yes | Aircraft registration tail |
| `origin_airport` | `StringType` | Yes | IATA airport code (e.g. `DEL`) |
| `stand_gate` | `StringType` | Yes | Terminal stand/gate (e.g. `T3-G14`) |
| `milestone_sobt` | `StringType` | Yes | Scheduled Off-Block Time (e.g. `08:00`) |
| `milestone_tobt` | `StringType` | Yes | Target Off-Block Time (e.g. `08:18`) |
| `milestone_tsat` | `StringType` | Yes | Target Startup Approval Time (`08:23`) |
| `tobt_variance_minutes` | `IntegerType` | Yes | Schedule variance in minutes |
| `turnaround_progress_pct`| `DoubleType` | Yes | Overall turnaround completion percentage |
| `ramp_services` | `StructType` | Yes | Nested ramp milestone flags |
| `iata_delay_code` | `StringType` | Yes | Standard IATA delay code (e.g. `35`) |
| `source` | `StringType` | Yes | Originating simulator tag |

- **`ramp_services` Nested Struct:**
  - `deboarding_completed`: `BooleanType`
  - `cleaning_completed`: `BooleanType`
  - `catering_completed`: `BooleanType`
  - `fueling_liters_uplifted`: `DoubleType`
  - `fueling_completed`: `BooleanType`
  - `baggage_loading_pct`: `DoubleType` (validated $[0.0, 100.0]$)
  - `boarding_pct`: `DoubleType` (validated $[0.0, 100.0]$)

---

### Topic 3: `engine-acars-events`
- **Purpose:** Continuous engine diagnostic telemetry and Remaining Useful Life (RUL) monitoring.
- **Spark Schema:**

| Field | Spark Type | Nullable | Description |
|---|---|---|---|
| `packet_id` | `StringType` | Yes | Unique ACARS message identifier |
| `timestamp_utc` | `StringType` | Yes | ISO-8601 UTC timestamp |
| `tail_number` | `StringType` | Yes | Aircraft registration |
| `aircraft_model` | `StringType` | Yes | E.g. `Boeing 737-800` |
| `engine_model` | `StringType` | Yes | E.g. `CFM56-7B26` |
| `engine_1` | `StructType` | Yes | Left engine measurements |
| `engine_2` | `StructType` | Yes | Right engine measurements |
| `apu_hours` | `DoubleType` | Yes | Auxiliary Power Unit accumulated hours |
| `apu_bleed_status` | `StringType` | Yes | Bleed air status (`NORMAL`, `DEGRADED`) |
| `source` | `StringType` | Yes | Generator identifier |

- **`engine_1` & `engine_2` Nested Struct:**
  - `egt_margin_c`: `DoubleType` (Exhaust Gas Temperature margin in °C)
  - `vibration_n1`: `DoubleType` (N1 spool vibration)
  - `vibration_n2`: `DoubleType` (N2 spool vibration)
  - `oil_pressure_psi`: `DoubleType` (Oil pressure in psi)
  - `oil_temperature_c`: `DoubleType` (Oil temperature in °C)
  - `sfc_drift_pct`: `DoubleType` (Specific fuel consumption drift %)
  - `remaining_useful_life_cycles`: `IntegerType` (Estimated RUL in flight cycles)

---

### Topic 4: `passenger-dcs-events`
- **Purpose:** Passenger check-in, DigiYatra biometric counts, cabin class split, and special assistance requests.
- **Spark Schema:**

| Field | Spark Type | Nullable | Description |
|---|---|---|---|
| `timestamp_utc` | `StringType` | Yes | ISO-8601 UTC timestamp |
| `flight_number` | `StringType` | Yes | Flight commercial number |
| `tail_number` | `StringType` | Yes | Aircraft tail registration |
| `origin_iata` | `StringType` | Yes | Origin airport IATA code |
| `destination_iata` | `StringType` | Yes | Destination airport IATA code |
| `total_seating_capacity` | `IntegerType` | Yes | Maximum aircraft cabin capacity |
| `booked_passengers` | `IntegerType` | Yes | Total confirmed bookings |
| `boarded_passengers` | `IntegerType` | Yes | Physically boarded passenger count |
| `digiyatra_biometric_count` | `IntegerType` | Yes | Biometric gate processed count |
| `digiyatra_adoption_pct` | `DoubleType` | Yes | DigiYatra percentage |
| `class_split` | `StructType` | Yes | Cabin class distribution |
| `special_service_requests` | `StructType` | Yes | SSR breakdown |
| `source` | `StringType` | Yes | Simulator name |

- **Nested Structs:**
  - `class_split`: `spiceplus_boarded` (Int), `spiceflex_boarded` (Int), `economy_boarded` (Int).
  - `special_service_requests`: `wchr_wheelchair` (Int), `infants_onboard` (Int), `preordered_meals` (Int).

---

### Topic 5: `crew-clearance-events`
- **Purpose:** Aircraft Maintenance Release (CRS) and Cockpit Crew Flight Duty Time Limitations (FDTL).
- **Spark Schema:**

| Field | Spark Type | Nullable | Description |
|---|---|---|---|
| `timestamp_utc` | `StringType` | Yes | ISO-8601 UTC timestamp |
| `flight_number` | `StringType` | Yes | Operating flight number |
| `tail_number` | `StringType` | Yes | Aircraft tail |
| `origin_iata` | `StringType` | Yes | Station IATA code |
| `certifying_ame_license`| `StringType` | Yes | Licensed engineer identifier |
| `crs_release_number` | `StringType` | Yes | Certificate of Release to Service ID |
| `pre_flight_inspection` | `StringType` | Yes | Status (`PASSED`, `FAILED`, `PENDING`) |
| `engine_oil_uplift_qts` | `DoubleType` | Yes | Oil uplifted in quarts |
| `tlb_technical_logbook_signed`| `BooleanType` | Yes | Pilot/AME technical logbook signed |
| `cockpit_crew_fdtl` | `StructType` | Yes | Pilot duty limitation compliance |
| `source` | `StringType` | Yes | Generator source identifier |

- **`cockpit_crew_fdtl` Nested Struct:**
  - `captain_hours_28d`: `DoubleType` (Cumulative 28-day flight hours)
  - `first_officer_hours_28d`: `DoubleType` (Cumulative 28-day flight hours)
  - `mandatory_rest_compliant`: `BooleanType` (Rest regulatory compliance)
  - `fdp_within_limits`: `BooleanType` (Flight Duty Period validity)

---

## 3. Common Ingestion Metadata Contract

Every processed event document receives the following standardized metadata fields:

| Field | Type | Description |
|---|---|---|
| `_id` | `StringType` | Matches `event_id` for idempotent MongoDB upserts |
| `event_id` | `StringType` | Deterministic deduplication key |
| `event_type` | `StringType` | Logical event type (`flight_telemetry`, `turnaround_milestone`, etc.) |
| `source_topic` | `StringType` | Kafka topic source |
| `source_system` | `StringType` | Producing system / simulator ID |
| `event_time_utc` | `Date` (ISODate) | Normalized event occurrence timestamp |
| `flight_date` | `StringType` | YYYY-MM-DD partition & correlation key |
| `ingested_at_utc` | `Date` (ISODate) | Time Spark ingested the microbatch |
| `processed_at_utc` | `Date` (ISODate) | Processing completion time |
| `schema_version` | `StringType` | Semantic contract version (`1.0.0`) |
| `ingestion_batch_id`| `StringType` | Spark microbatch execution ID |
| `validation_status` | `StringType` | `VALID`, `PARTIAL`, or `INVALID` |
| `validation_errors` | `Array[String]`| List of non-fatal warnings or validation errors |
| `raw_payload` | `StringType` | Full original JSON for provenance and auditability |

---

## 4. Cross-Stream Correlation Strategy

To join disparate operational streams without introducing artificial coupling:
1. **Primary Business Key:** `(flight_number, flight_date)`. Since flight numbers repeat daily, `flight_date` is mandatory for disambiguation.
2. **Aircraft Association:** `tail_number` identifies the physical airframe across A-CDM, ACARS, DCS, and Crew clearance.
3. **Telemetry Bridge:** `icao24` transponder hex is mapped to `tail_number` via an aircraft registry lookup table (`800b21` $\leftrightarrow$ `VT-SGB`).
4. **Windowed Temporal Joins:** Stream-stream joins use watermarking on `event_time_utc` with late-arrival tolerances (10–30 minutes) to prevent dropping delayed ACARS or turnaround milestone packets.

---

## 5. MongoDB Storage & Indexing Design

The platform maintains 6 dedicated collections in MongoDB (`flight_analytics` database):

| Collection | Primary Key | Key Query Indexes |
|---|---|---|
| `flight_events` | `_id` = `event_id` | `event_time_utc` (1)<br/>`("icao24", 1), ("event_time_utc", -1)`<br/>`("callsign", 1), ("event_time_utc", -1)`<br/>`validation_status` (1) |
| `turnaround_events` | `_id` = `event_id` | `event_time_utc` (1)<br/>`("flight_number", 1), ("event_time_utc", -1)`<br/>`tail_number` (1)<br/>`origin_airport` (1) |
| `engine_health_events`| `_id` = `event_id` | `event_time_utc` (1)<br/>`("tail_number", 1), ("event_time_utc", -1)`<br/>`packet_id` (1, unique, sparse) |
| `passenger_dcs_events`| `_id` = `event_id` | `event_time_utc` (1)<br/>`("flight_number", 1), ("event_time_utc", -1)`<br/>`("origin_iata", 1), ("destination_iata", 1)` |
| `crew_clearance_events`| `_id` = `event_id`| `event_time_utc` (1)<br/>`("flight_number", 1), ("event_time_utc", -1)`<br/>`crs_release_number` (1) |
| `ingestion_quarantine`| `_id` = `event_id` | `received_at_utc` (-1)<br/>`source_topic` (1)<br/>`quarantine_reason` (1) |

---

## 6. Streamlit Dashboard Data Contract

The Streamlit dashboard (`dashboard/app.py`) reads directly from MongoDB collections:
1. **Radar & Telemetry Map:** Queries `flight_events` for latest aircraft coordinates, altitude, velocity, and emergency squawk alerts (7700).
2. **Turnaround Dashboard:** Queries `turnaround_events` for gate assignments, TOBT variance, progress %, and completed ramp services.
3. **Engine Diagnostics:** Queries `engine_health_events` for EGT margins, vibration levels, and Remaining Useful Life cycles per engine.
4. **Passenger Operations:** Queries `passenger_dcs_events` for booked vs boarded load factors, cabin split, and DigiYatra biometric adoption.
5. **Technical Clearance:** Queries `crew_clearance_events` for CRS release status, AME license, and cockpit crew FDTL duty compliance.
6. **Data Quality Auditor:** Queries `ingestion_quarantine` for real-time audit logs of malformed or invalid packets.

---

## 7. Operational Guidelines & Limitations

- **Simulated vs Certified Telemetry:** Operational measurements produced by simulators are designed for distributed systems training and analytics development; they do not represent FAA/DGCA-certified dispatch decisions.
- **Idempotent Upsert Guarantee:** Microbatch reprocessing and Kafka replay operations update documents in-place via `_id` without creating duplicates.
