"""
High-Throughput Airline Operations Simulator.
Simulates a diverse fleet of 25 aircraft across domestic and international routes,
generating continuous high-volume operational events across all 5 Kafka topics:
  1. flight-events
  2. acdm-turnaround-events
  3. engine-acars-events
  4. passenger-dcs-events
  5. crew-clearance-events
"""

import os
import sys
import time
import json
import random
from datetime import datetime, timezone

from ingestion.config import (
    KAFKA_BOOTSTRAP_SERVERS,
    TOPIC_FLIGHT_EVENTS,
    TOPIC_TURNAROUND_EVENTS,
    TOPIC_ENGINE_ACARS_EVENTS,
    TOPIC_PASSENGER_DCS_EVENTS,
    TOPIC_CREW_CLEARANCE_EVENTS,
)

# 25 Aircraft Fleet across multiple airlines, aircraft models, and route pairs
AIRCRAFT_FLEET = [
    # SpiceJet
    {"icao24": "800b21", "callsign": "SG8181", "tail_number": "VT-SGB", "model": "Boeing 737-800", "engine": "CFM56-7B26", "origin": "DEL", "dest": "BOM", "lat": 28.5562, "lon": 77.1000},
    {"icao24": "800b22", "callsign": "SG8182", "tail_number": "VT-SGC", "model": "Boeing 737 MAX 8", "engine": "LEAP-1B", "origin": "BOM", "dest": "BLR", "lat": 19.0896, "lon": 72.8656},
    {"icao24": "800b23", "callsign": "SG104",  "tail_number": "VT-SGD", "model": "Boeing 737-800", "engine": "CFM56-7B26", "origin": "DEL", "dest": "DXB", "lat": 27.2000, "lon": 73.5000},
    {"icao24": "800b24", "callsign": "SG215",  "tail_number": "VT-SGE", "model": "Q400 Dash 8",   "engine": "PW150A",     "origin": "HYD", "dest": "GOI", "lat": 17.2403, "lon": 78.4294},

    # IndiGo
    {"icao24": "800d41", "callsign": "6E202",  "tail_number": "VT-IZD", "model": "Airbus A321neo", "engine": "PW1100G",    "origin": "BLR", "dest": "CCU", "lat": 13.1986, "lon": 77.7066},
    {"icao24": "800d42", "callsign": "6E505",  "tail_number": "VT-IZE", "model": "Airbus A320neo", "engine": "CFM LEAP-1A", "origin": "DEL", "dest": "MAA", "lat": 24.5000, "lon": 78.5000},
    {"icao24": "800d43", "callsign": "6E611",  "tail_number": "VT-IZF", "model": "Airbus A320neo", "engine": "PW1100G",    "origin": "BOM", "dest": "HYD", "lat": 18.5000, "lon": 75.0000},
    {"icao24": "800d44", "callsign": "6E819",  "tail_number": "VT-IZG", "model": "Airbus A321neo", "engine": "CFM LEAP-1A", "origin": "CCU", "dest": "BKK", "lat": 22.6547, "lon": 88.4467},

    # Air India
    {"icao24": "800c31", "callsign": "AI101",  "tail_number": "VT-EXA", "model": "Boeing 787-9",   "engine": "GEnx-1B",    "origin": "DEL", "dest": "LHR", "lat": 30.5000, "lon": 70.0000},
    {"icao24": "800c32", "callsign": "AI302",  "tail_number": "VT-EXB", "model": "Boeing 777-300ER","engine": "GE90-115B", "origin": "BOM", "dest": "JFK", "lat": 22.0000, "lon": 68.0000},
    {"icao24": "800c33", "callsign": "AI508",  "tail_number": "VT-EXC", "model": "Airbus A350-900", "engine": "Trent XWB", "origin": "BLR", "dest": "DEL", "lat": 16.5000, "lon": 76.5000},
    {"icao24": "800c34", "callsign": "AI804",  "tail_number": "VT-EXD", "model": "Airbus A320neo", "engine": "CFM LEAP-1A", "origin": "MAA", "dest": "DEL", "lat": 15.0000, "lon": 79.0000},

    # Vistara
    {"icao24": "800e51", "callsign": "UK945",  "tail_number": "VT-TVA", "model": "Boeing 787-9",   "engine": "GEnx-1B",    "origin": "DEL", "dest": "SIN", "lat": 21.0000, "lon": 82.0000},
    {"icao24": "800e52", "callsign": "UK812",  "tail_number": "VT-TVB", "model": "Airbus A321neo", "engine": "CFM LEAP-1A", "origin": "BOM", "dest": "DEL", "lat": 23.0000, "lon": 75.0000},
    {"icao24": "800e53", "callsign": "UK707",  "tail_number": "VT-TVC", "model": "Airbus A320neo", "engine": "CFM LEAP-1A", "origin": "CCU", "dest": "BOM", "lat": 21.5000, "lon": 82.5000},

    # Akasa Air
    {"icao24": "800f61", "callsign": "QP1101", "tail_number": "VT-YAA", "model": "Boeing 737 MAX 8", "engine": "LEAP-1B", "origin": "BOM", "dest": "AMD", "lat": 21.0000, "lon": 72.5000},
    {"icao24": "800f62", "callsign": "QP1332", "tail_number": "VT-YAB", "model": "Boeing 737 MAX 8", "engine": "LEAP-1B", "origin": "BLR", "dest": "COK", "lat": 11.5000, "lon": 76.8000},
    {"icao24": "800f63", "callsign": "QP1405", "tail_number": "VT-YAC", "model": "Boeing 737 MAX 8", "engine": "LEAP-1B", "origin": "DEL", "dest": "GOI", "lat": 22.5000, "lon": 75.5000},

    # Regional & Cargo
    {"icao24": "800a11", "callsign": "SG901",  "tail_number": "VT-SGF", "model": "Boeing 737-700F", "engine": "CFM56-7B24", "origin": "DEL", "dest": "CCU", "lat": 26.0000, "lon": 82.0000},
    {"icao24": "800a12", "callsign": "6E902",  "tail_number": "VT-IZH", "model": "Airbus A321P2F",  "engine": "CFM56-5B",   "origin": "BOM", "dest": "MAA", "lat": 15.5000, "lon": 76.0000},
    {"icao24": "800a13", "callsign": "AI404",  "tail_number": "VT-EXE", "model": "Airbus A319",     "engine": "CFM56-5B",   "origin": "DEL", "dest": "JAI", "lat": 27.5000, "lon": 76.0000},
    {"icao24": "800a14", "callsign": "AI405",  "tail_number": "VT-EXF", "model": "Airbus A320neo", "engine": "CFM LEAP-1A", "origin": "DEL", "dest": "PNQ", "lat": 22.0000, "lon": 74.5000},
    {"icao24": "800a15", "callsign": "UK612",  "tail_number": "VT-TVD", "model": "Airbus A320neo", "engine": "CFM LEAP-1A", "origin": "BLR", "dest": "HYD", "lat": 15.0000, "lon": 78.0000},
    {"icao24": "800a16", "callsign": "6E701",  "tail_number": "VT-IZI", "model": "Airbus A320neo", "engine": "PW1100G",    "origin": "CCU", "dest": "GAU", "lat": 24.5000, "lon": 90.0000},
    {"icao24": "800a17", "callsign": "SG305",  "tail_number": "VT-SGG", "model": "Boeing 737-800", "engine": "CFM56-7B26", "origin": "DEL", "dest": "PAT", "lat": 26.5000, "lon": 82.5000},
]


def generate_flight_event(ac):
    now_epoch = int(time.time())
    # Drift coordinates slightly to simulate trajectory
    ac["lat"] += (random.random() - 0.49) * 0.08
    ac["lon"] += (random.random() - 0.49) * 0.08
    # Keep within Indian region bounds
    ac["lat"] = max(8.0, min(35.0, ac["lat"]))
    ac["lon"] = max(68.0, min(95.0, ac["lon"]))

    is_ground = random.random() < 0.12
    alt = 0.0 if is_ground else round(random.uniform(2500.0, 11800.0), 1)
    vel = round(random.uniform(0.0, 25.0), 1) if is_ground else round(random.uniform(160.0, 260.0), 1)

    # Transponder squawk: mostly 7000, occasionally 7700 (emergency), 7600 (radio fail), 2000
    squawk_choice = random.choices(["7000", "7700", "7600", "2000", "1200"], weights=[0.88, 0.04, 0.03, 0.03, 0.02])[0]

    return {
        "event_time": now_epoch,
        "icao24": ac["icao24"],
        "callsign": ac["callsign"],
        "origin_country": "India",
        "time_position": now_epoch - random.randint(1, 4),
        "last_contact": now_epoch,
        "longitude": round(ac["lon"], 4),
        "latitude": round(ac["lat"], 4),
        "baro_altitude": alt,
        "geo_altitude": alt + random.uniform(-30.0, 45.0) if alt > 0 else 0.0,
        "on_ground": is_ground,
        "velocity": vel,
        "true_track": round(random.uniform(0.0, 360.0), 1),
        "vertical_rate": round(random.uniform(-6.0, 6.0), 1) if not is_ground else 0.0,
        "squawk": squawk_choice,
    }


def generate_turnaround_event(ac):
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    progress = round(random.uniform(15.0, 98.0), 1)
    variance = random.choice([0, 2, 5, 8, 14, 18, 25, 35, 45])
    delay_code = random.choices(["00", "35", "41", "89", "93", "11"], weights=[0.55, 0.15, 0.10, 0.10, 0.05, 0.05])[0]

    return {
        "timestamp_utc": now_utc,
        "flight_number": ac["callsign"],
        "tail_number": ac["tail_number"],
        "origin_airport": ac["origin"],
        "stand_gate": f"T{random.randint(1, 3)}-G{random.randint(10, 45)}",
        "milestone_sobt": "08:00",
        "milestone_tobt": f"08:{variance:02d}",
        "milestone_tsat": f"08:{variance + 5:02d}",
        "tobt_variance_minutes": variance,
        "turnaround_progress_pct": progress,
        "ramp_services": {
            "deboarding_completed": progress > 20,
            "cleaning_completed": progress > 38,
            "catering_completed": progress > 55,
            "fueling_liters_uplifted": round(random.uniform(2500.0, 7500.0), 1),
            "fueling_completed": progress > 65,
            "baggage_loading_pct": min(100.0, round(progress * 1.08, 1)),
            "boarding_pct": min(100.0, round(max(0.0, (progress - 35) * 1.55), 1)),
        },
        "iata_delay_code": str(delay_code),
        "source": "A-CDM_RAMP_TELEMETRY_SIMULATOR",
    }


def generate_engine_event(ac):
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    packet_id = f"ACARS-SIM-{int(time.time())}-{random.randint(1000, 9999)}"

    # Generate realistic RUL (some engines near maintenance threshold < 800 cycles)
    rul1 = random.randint(450, 3200)
    rul2 = rul1 + random.randint(-80, 80)

    return {
        "packet_id": packet_id,
        "timestamp_utc": now_utc,
        "tail_number": ac["tail_number"],
        "aircraft_model": ac["model"],
        "engine_model": ac["engine"],
        "engine_1": {
            "egt_margin_c": round(random.uniform(18.0, 38.0), 1),
            "vibration_n1": round(random.uniform(0.25, 0.75), 2),
            "vibration_n2": round(random.uniform(0.25, 0.70), 2),
            "oil_pressure_psi": round(random.uniform(38.0, 56.0), 1),
            "oil_temperature_c": round(random.uniform(84.0, 104.0), 1),
            "sfc_drift_pct": round(random.uniform(0.2, 1.4), 2),
            "remaining_useful_life_cycles": rul1,
        },
        "engine_2": {
            "egt_margin_c": round(random.uniform(18.0, 38.0), 1),
            "vibration_n1": round(random.uniform(0.25, 0.75), 2),
            "vibration_n2": round(random.uniform(0.25, 0.70), 2),
            "oil_pressure_psi": round(random.uniform(38.0, 56.0), 1),
            "oil_temperature_c": round(random.uniform(84.0, 104.0), 1),
            "sfc_drift_pct": round(random.uniform(0.2, 1.4), 2),
            "remaining_useful_life_cycles": rul2,
        },
        "apu_hours": round(random.uniform(6000.0, 14000.0), 1),
        "apu_bleed_status": "NORMAL" if random.random() > 0.08 else "DEGRADED",
        "source": "FADEC_ACARS_EMU_SIMULATOR",
    }


def generate_passenger_event(ac):
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cap = 189 if "737" in ac["model"] or "A320" in ac["model"] else (232 if "A321" in ac["model"] else 296)
    booked = random.randint(int(cap * 0.75), int(cap * 0.98))
    boarded = random.randint(int(booked * 0.70), booked)

    sp = random.randint(6, 18)
    sf = random.randint(12, 35)
    ec = max(0, boarded - sp - sf)
    dy_count = int(boarded * random.uniform(0.50, 0.85))

    return {
        "timestamp_utc": now_utc,
        "flight_number": ac["callsign"],
        "tail_number": ac["tail_number"],
        "origin_iata": ac["origin"],
        "destination_iata": ac["dest"],
        "total_seating_capacity": cap,
        "booked_passengers": booked,
        "boarded_passengers": boarded,
        "digiyatra_biometric_count": dy_count,
        "digiyatra_adoption_pct": round((dy_count / boarded) * 100.0, 1) if boarded > 0 else 0.0,
        "class_split": {
            "spiceplus_boarded": sp,
            "spiceflex_boarded": sf,
            "economy_boarded": ec,
        },
        "special_service_requests": {
            "wchr_wheelchair": random.randint(0, 6),
            "infants_onboard": random.randint(0, 4),
            "preordered_meals": random.randint(30, int(boarded * 0.75)),
        },
        "source": "DCS_PASSENGER_BOARDING_SIMULATOR",
    }


def generate_crew_event(ac):
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    date_compact = datetime.now(timezone.utc).strftime("%Y%m%d")
    crs_num = f"CRS-{ac['origin']}-{date_compact}-{random.randint(100, 999)}"
    inspection_status = random.choices(["PASSED", "PENDING", "FAILED"], weights=[0.90, 0.07, 0.03])[0]

    return {
        "timestamp_utc": now_utc,
        "flight_number": ac["callsign"],
        "tail_number": ac["tail_number"],
        "origin_iata": ac["origin"],
        "certifying_ame_license": f"CAR66-B1-{random.randint(1000, 9999)}",
        "crs_release_number": crs_num,
        "pre_flight_inspection": inspection_status,
        "engine_oil_uplift_qts": round(random.uniform(0.0, 2.0), 1),
        "tlb_technical_logbook_signed": inspection_status == "PASSED",
        "cockpit_crew_fdtl": {
            "captain_hours_28d": round(random.uniform(40.0, 85.0), 1),
            "first_officer_hours_28d": round(random.uniform(35.0, 80.0), 1),
            "mandatory_rest_compliant": True,
            "fdp_within_limits": True,
        },
        "source": "CMS_MRO_CLEARANCE_SIMULATOR",
    }


def run_producer_loop(interval_sec: float = 1.0, max_iterations: int = 0):
    producer = None
    try:
        from kafka import KafkaProducer
    except ImportError:
        print("⚠️ kafka-python-ng not found, operating in dry-run mode.")
        producer = None

    if "KafkaProducer" in locals():
        while not producer:
            try:
                producer = KafkaProducer(
                    bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(","),
                    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                    request_timeout_ms=5000,
                    max_block_ms=3000,
                )
                print(f"✅ High-Throughput Producer connected to Kafka ({KAFKA_BOOTSTRAP_SERVERS})!")
            except Exception as exc:
                print(f"⏳ Waiting for Kafka broker ({KAFKA_BOOTSTRAP_SERVERS})... {exc}")
                time.sleep(2)

    iteration = 0
    print(f"🚀 High-Throughput Simulator active! Emitting 125 events/sec (25 aircraft × 5 topics)...")

    while True:
        iteration += 1
        for ac in AIRCRAFT_FLEET:
            e_flight = generate_flight_event(ac)
            e_turnaround = generate_turnaround_event(ac)
            e_engine = generate_engine_event(ac)
            e_pax = generate_passenger_event(ac)
            e_crew = generate_crew_event(ac)

            events = [
                (TOPIC_FLIGHT_EVENTS, e_flight),
                (TOPIC_TURNAROUND_EVENTS, e_turnaround),
                (TOPIC_ENGINE_ACARS_EVENTS, e_engine),
                (TOPIC_PASSENGER_DCS_EVENTS, e_pax),
                (TOPIC_CREW_CLEARANCE_EVENTS, e_crew),
            ]

            for topic, payload in events:
                if producer:
                    try:
                        producer.send(topic, payload)
                    except Exception as pe:
                        pass

        if producer:
            producer.flush()
            if iteration % 5 == 0:
                print(f"📡 [Iter {iteration}] Emitted 125 events across 25 aircraft to Kafka.")

        if max_iterations > 0 and iteration >= max_iterations:
            break

        time.sleep(interval_sec)


if __name__ == "__main__":
    run_producer_loop(interval_sec=1.0)
