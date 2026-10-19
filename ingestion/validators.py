"""
Validation and Normalization Module for Real-Time Flight Analytics.
Implements data-quality rules, unit conversions, timestamp standardizations,
and status assignment (VALID, PARTIAL, INVALID) across all 5 Kafka streams.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Tuple, List, Optional
import math


def parse_iso_or_epoch_to_utc(val: Any) -> Optional[datetime]:
    """
    Standardize timestamp values (Unix epoch seconds or ISO-8601 string)
    to a timezone-aware UTC datetime object. Returns None if invalid or missing.
    """
    if val is None:
        return None
    try:
        if isinstance(val, (int, float)):
            # Handle millisecond vs second epochs safely
            epoch_sec = float(val) / 1000.0 if float(val) > 1e11 else float(val)
            return datetime.fromtimestamp(epoch_sec, tz=timezone.utc)
        if isinstance(val, str):
            val_clean = val.strip().replace("Z", "+00:00")
            # Handle ISO formats
            dt = datetime.fromisoformat(val_clean)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
    except Exception:
        return None
    return None


# ==============================================================================
# Topic 1: flight-events validator & normalizer
# ==============================================================================
def validate_and_normalize_flight_event(raw: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
    """
    Validates and normalizes flight telemetry records from OpenSky / ADS-B.
    Rules:
      - Latitude within [-90.0, 90.0]
      - Longitude within [-180.0, 180.0]
      - True track within [0.0, 360.0]
      - Velocity >= 0.0 (negative velocity rejected)
      - Missing coordinates remain null (no synthetic filling)
      - Altitude source unit tracked (metres for OpenSky)
      - Preferred timestamp: time_position if valid, fallback to event_time
    """
    errors: List[str] = []
    status = "VALID"
    norm = dict(raw)

    # 1. Aircraft Identification
    icao24 = norm.get("icao24")
    if not icao24 or not str(icao24).strip():
        errors.append("Missing mandatory aircraft identifier 'icao24'")
        status = "INVALID"
    else:
        norm["icao24"] = str(icao24).strip().lower()

    # 2. Coordinates validation
    lat = norm.get("latitude")
    lon = norm.get("longitude")

    if lat is not None:
        try:
            lat_f = float(lat)
            if lat_f < -90.0 or lat_f > 90.0 or math.isnan(lat_f):
                errors.append(f"Latitude out of valid range [-90, +90]: {lat_f}")
                status = "INVALID"
            norm["latitude"] = lat_f
        except (ValueError, TypeError):
            errors.append(f"Non-numeric latitude: {lat}")
            status = "INVALID"
            norm["latitude"] = None

    if lon is not None:
        try:
            lon_f = float(lon)
            if lon_f < -180.0 or lon_f > 180.0 or math.isnan(lon_f):
                errors.append(f"Longitude out of valid range [-180, +180]: {lon_f}")
                status = "INVALID"
            norm["longitude"] = lon_f
        except (ValueError, TypeError):
            errors.append(f"Non-numeric longitude: {lon}")
            status = "INVALID"
            norm["longitude"] = None

    # Track angle validation
    track = norm.get("true_track")
    if track is not None:
        try:
            track_f = float(track)
            if track_f < 0.0 or track_f > 360.0 or math.isnan(track_f):
                errors.append(f"True track out of valid range [0, 360]: {track_f}")
                if status == "VALID":
                    status = "PARTIAL"
            norm["true_track"] = track_f
        except (ValueError, TypeError):
            norm["true_track"] = None

    # Velocity validation (reject negative velocity)
    vel = norm.get("velocity")
    if vel is not None:
        try:
            vel_f = float(vel)
            if vel_f < 0.0 or math.isnan(vel_f):
                errors.append(f"Negative velocity rejected: {vel_f} m/s")
                status = "INVALID"
            norm["velocity"] = vel_f
        except (ValueError, TypeError):
            errors.append(f"Non-numeric velocity: {vel}")
            status = "INVALID"
            norm["velocity"] = None

    # Altitude preservation and normalization
    # OpenSky reports barometric and geometric altitude in metres
    norm["altitude_source_unit"] = "metres"
    norm["altitude_m"] = norm.get("baro_altitude")

    # Squawk formatting: preserve leading zeros
    squawk = norm.get("squawk")
    if squawk is not None:
        norm["squawk"] = str(squawk).strip().zfill(4) if str(squawk).isdigit() else str(squawk).strip()

    # Determine preferred observation timestamp
    time_pos = norm.get("time_position")
    event_time = norm.get("event_time")
    chosen_epoch = time_pos if (time_pos is not None and time_pos > 0) else event_time
    norm["observation_timestamp_utc"] = parse_iso_or_epoch_to_utc(chosen_epoch)

    if norm["observation_timestamp_utc"] is None:
        errors.append("Missing or unparseable event timestamp")
        status = "INVALID"

    return status, errors, norm


# ==============================================================================
# Topic 2: acdm-turnaround-events validator & normalizer
# ==============================================================================
def validate_and_normalize_turnaround_event(raw: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
    """
    Validates and normalizes A-CDM turnaround milestone records.
    Rules:
      - Airport codes normalized to uppercase
      - Progress percentages in [0.0, 100.0]
      - IATA delay codes preserved as string
      - Milestone times combined with flight date for reliable UTC timestamps
      - Positive TOBT variance preserved as variance indicator, not actual departure delay
    """
    errors: List[str] = []
    status = "VALID"
    norm = dict(raw)

    # 1. Airport code normalization
    origin_airport = norm.get("origin_airport")
    if origin_airport:
        norm["origin_airport"] = str(origin_airport).strip().upper()
    else:
        errors.append("Missing origin airport code")
        if status == "VALID":
            status = "PARTIAL"

    # Flight number & tail number
    if norm.get("flight_number"):
        norm["flight_number"] = str(norm["flight_number"]).strip().upper()
    else:
        errors.append("Missing flight_number")
        status = "INVALID"

    if norm.get("tail_number"):
        norm["tail_number"] = str(norm["tail_number"]).strip().upper()

    # 2. Progress percentage validation
    pct = norm.get("turnaround_progress_pct")
    if pct is not None:
        try:
            pct_f = float(pct)
            if pct_f < 0.0 or pct_f > 100.0:
                errors.append(f"turnaround_progress_pct out of range [0, 100]: {pct_f}")
                if status == "VALID":
                    status = "PARTIAL"
            norm["turnaround_progress_pct"] = pct_f
        except (ValueError, TypeError):
            errors.append(f"Non-numeric turnaround_progress_pct: {pct}")
            norm["turnaround_progress_pct"] = None

    # Nested ramp services validation
    ramp = norm.get("ramp_services")
    if isinstance(ramp, dict):
        for sub_pct in ["baggage_loading_pct", "boarding_pct"]:
            if ramp.get(sub_pct) is not None:
                try:
                    val_f = float(ramp[sub_pct])
                    if val_f < 0.0 or val_f > 100.0:
                        errors.append(f"Ramp service '{sub_pct}' out of range [0, 100]: {val_f}")
                        if status == "VALID":
                            status = "PARTIAL"
                    ramp[sub_pct] = val_f
                except (ValueError, TypeError):
                    ramp[sub_pct] = None
        norm["ramp_services"] = ramp

    # 3. Delay code preservation
    if norm.get("iata_delay_code") is not None:
        norm["iata_delay_code"] = str(norm["iata_delay_code"]).strip()

    # 4. Milestone UTC construction
    event_dt = parse_iso_or_epoch_to_utc(norm.get("timestamp_utc"))
    norm["event_time_utc_dt"] = event_dt
    if event_dt:
        date_str = event_dt.strftime("%Y-%m-%d")
        for milestone_key in ["milestone_sobt", "milestone_tobt", "milestone_tsat"]:
            m_val = norm.get(milestone_key)
            if m_val and isinstance(m_val, str) and ":" in m_val:
                try:
                    # Construct composite UTC timestamp for reliable ordering
                    full_iso = f"{date_str}T{m_val.strip()}:00Z"
                    norm[f"{milestone_key}_utc"] = full_iso
                except Exception:
                    norm[f"{milestone_key}_utc"] = None
    else:
        errors.append("Invalid or missing timestamp_utc")
        status = "INVALID"

    return status, errors, norm


# ==============================================================================
# Topic 3: engine-acars-events validator & normalizer
# ==============================================================================
def validate_and_normalize_engine_event(raw: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
    """
    Validates and normalizes FADEC/ACARS engine condition records.
    Rules:
      - Independent measurement preservation for engine_1 and engine_2
      - Keep original packet_id for deduplication
      - Validate non-negative numbers for RUL cycles and APU hours
      - Preserve source units (°C, psi, cycles) without imposing arbitrary cutoff alerts
    """
    errors: List[str] = []
    status = "VALID"
    norm = dict(raw)

    # 1. Packet ID for deduplication
    packet_id = norm.get("packet_id")
    if not packet_id or not str(packet_id).strip():
        errors.append("Missing packet_id for engine ACARS message")
        status = "INVALID"
    else:
        norm["packet_id"] = str(packet_id).strip()

    # 2. Tail number
    if norm.get("tail_number"):
        norm["tail_number"] = str(norm["tail_number"]).strip().upper()

    # 3. Engines nested validation
    for eng_name in ["engine_1", "engine_2"]:
        eng = norm.get(eng_name)
        if isinstance(eng, dict):
            # Check remaining useful life cycles
            rul = eng.get("remaining_useful_life_cycles")
            if rul is not None:
                try:
                    rul_int = int(rul)
                    if rul_int < 0:
                        errors.append(f"{eng_name} remaining_useful_life_cycles is negative: {rul_int}")
                        if status == "VALID":
                            status = "PARTIAL"
                    eng["remaining_useful_life_cycles"] = rul_int
                except (ValueError, TypeError):
                    errors.append(f"{eng_name} non-integer remaining_useful_life_cycles: {rul}")
                    eng["remaining_useful_life_cycles"] = None

            # Validate numeric physical bounds
            for field in ["egt_margin_c", "vibration_n1", "vibration_n2", "oil_pressure_psi", "oil_temperature_c", "sfc_drift_pct"]:
                val = eng.get(field)
                if val is not None:
                    try:
                        eng[field] = float(val)
                    except (ValueError, TypeError):
                        eng[field] = None
            norm[eng_name] = eng

    # 4. APU Hours
    apu_hours = norm.get("apu_hours")
    if apu_hours is not None:
        try:
            apu_f = float(apu_hours)
            if apu_f < 0:
                errors.append(f"Negative APU hours: {apu_f}")
                if status == "VALID":
                    status = "PARTIAL"
            norm["apu_hours"] = apu_f
        except (ValueError, TypeError):
            norm["apu_hours"] = None

    # Timestamp
    event_dt = parse_iso_or_epoch_to_utc(norm.get("timestamp_utc"))
    norm["event_time_utc_dt"] = event_dt
    if not event_dt:
        errors.append("Missing or unparseable timestamp_utc in engine record")
        status = "INVALID"

    return status, errors, norm


# ==============================================================================
# Topic 4: passenger-dcs-events validator & normalizer
# ==============================================================================
def validate_and_normalize_passenger_event(raw: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
    """
    Validates and normalizes DCS passenger boarding records.
    Rules:
      - Passenger counts must be non-negative integers
      - boarded_passengers <= booked_passengers
      - boarded_passengers <= total_seating_capacity
      - Cross-check sum of class split vs boarded count
      - Standardize airport codes to uppercase
      - Operational data: No PII collected
    """
    errors: List[str] = []
    status = "VALID"
    norm = dict(raw)

    # Normalize IATA
    for airport_field in ["origin_iata", "destination_iata"]:
        if norm.get(airport_field):
            norm[airport_field] = str(norm[airport_field]).strip().upper()

    if norm.get("flight_number"):
        norm["flight_number"] = str(norm["flight_number"]).strip().upper()

    # Validate integer passenger counts
    capacity = norm.get("total_seating_capacity")
    booked = norm.get("booked_passengers")
    boarded = norm.get("boarded_passengers")

    capacity_int = int(capacity) if (capacity is not None and str(capacity).isdigit()) else None
    booked_int = int(booked) if (booked is not None and str(booked).isdigit()) else None
    boarded_int = int(boarded) if (boarded is not None and str(boarded).isdigit()) else None

    norm["total_seating_capacity"] = capacity_int
    norm["booked_passengers"] = booked_int
    norm["boarded_passengers"] = boarded_int

    if boarded_int is not None and booked_int is not None:
        if boarded_int > booked_int:
            errors.append(f"boarded_passengers ({boarded_int}) exceeds booked_passengers ({booked_int})")
            if status == "VALID":
                status = "PARTIAL"

    if boarded_int is not None and capacity_int is not None:
        if boarded_int > capacity_int:
            errors.append(f"boarded_passengers ({boarded_int}) exceeds aircraft capacity ({capacity_int})")
            status = "INVALID"

    # Validate class split consistency
    class_split = norm.get("class_split")
    if isinstance(class_split, dict) and boarded_int is not None:
        sp = class_split.get("spiceplus_boarded", 0) or 0
        sf = class_split.get("spiceflex_boarded", 0) or 0
        ec = class_split.get("economy_boarded", 0) or 0
        sum_classes = sp + sf + ec
        if sum_classes != boarded_int:
            errors.append(f"Class split sum ({sum_classes}) does not match boarded_passengers ({boarded_int})")
            if status == "VALID":
                status = "PARTIAL"

    # Compute load factor percentage
    if boarded_int is not None and capacity_int and capacity_int > 0:
        norm["computed_load_factor_pct"] = round((boarded_int / capacity_int) * 100.0, 2)
    else:
        norm["computed_load_factor_pct"] = None

    # Timestamp
    event_dt = parse_iso_or_epoch_to_utc(norm.get("timestamp_utc"))
    norm["event_time_utc_dt"] = event_dt
    if not event_dt:
        errors.append("Missing or unparseable timestamp_utc in DCS passenger record")
        status = "INVALID"

    return status, errors, norm


# ==============================================================================
# Topic 5: crew-clearance-events validator & normalizer
# ==============================================================================
def validate_and_normalize_crew_event(raw: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
    """
    Validates and normalizes crew and maintenance clearance records.
    Rules:
      - Controlled inspection status (PASSED, FAILED, PENDING), preserving others for review
      - Certifying license and CRS release number preserved as strings
      - Numeric duty-hour fields >= 0
      - Distinguish missing clearance from failed clearance
      - Surface exceptions to human reviewers; never automate approval
    """
    errors: List[str] = []
    status = "VALID"
    norm = dict(raw)

    if norm.get("origin_iata"):
        norm["origin_iata"] = str(norm["origin_iata"]).strip().upper()
    if norm.get("flight_number"):
        norm["flight_number"] = str(norm["flight_number"]).strip().upper()

    # Controlled inspection status
    inspection = norm.get("pre_flight_inspection")
    if inspection:
        norm["pre_flight_inspection"] = str(inspection).strip().upper()
        if norm["pre_flight_inspection"] not in ["PASSED", "FAILED", "PENDING"]:
            errors.append(f"Unfamiliar pre_flight_inspection value '{inspection}'; marked for human review")
            if status == "VALID":
                status = "PARTIAL"
    else:
        errors.append("Missing pre_flight_inspection status")
        if status == "VALID":
            status = "PARTIAL"

    # Duty hours validation
    fdtl = norm.get("cockpit_crew_fdtl")
    if isinstance(fdtl, dict):
        for duty_col in ["captain_hours_28d", "first_officer_hours_28d"]:
            val = fdtl.get(duty_col)
            if val is not None:
                try:
                    val_f = float(val)
                    if val_f < 0.0:
                        errors.append(f"Negative {duty_col}: {val_f}")
                        if status == "VALID":
                            status = "PARTIAL"
                    fdtl[duty_col] = val_f
                except (ValueError, TypeError):
                    fdtl[duty_col] = None
        norm["cockpit_crew_fdtl"] = fdtl

    # Timestamp
    event_dt = parse_iso_or_epoch_to_utc(norm.get("timestamp_utc"))
    norm["event_time_utc_dt"] = event_dt
    if not event_dt:
        errors.append("Missing or unparseable timestamp_utc in crew clearance record")
        status = "INVALID"

    return status, errors, norm
