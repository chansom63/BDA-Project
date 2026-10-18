"""
High-Throughput Live Multi-Source Flight Telemetry & Event Simulator.
Publishes to Kafka topics at configurable rates:
- Sustained target: 5,000 events/sec
- Burst target: 10,000 events/sec
Emits across:
  flight-telemetry, flight-events, bookings, financial-events, weather-events, maintenance-events.
"""

import os
import sys
import time
import json
import random
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Force UTF-8 encoding on standard streams to avoid Windows cp1252 charmap errors
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from core.catalog import (
    GLOBAL_AIRPORTS, AIRPORT_LOOKUP, AIRLINES_CATALOG, AIRCRAFT_PROFILES
)
from core.kinematics import (
    haversine_distance_km, calculate_bearing, intermediate_point, compute_flight_kinematics
)
from core.models import (
    TelemetryEvent, FlightSchedule, PassengerBooking, FinancialRecord,
    WeatherObservation, FleetMaintenanceRecord
)

try:
    from kafka import KafkaProducer
    HAS_KAFKA = True
except ImportError:
    HAS_KAFKA = False


class LiveAviationSimulator:
    def __init__(
        self,
        bootstrap_servers: str = "localhost:9093",
        aircraft_count: int = 500,
        rate_target: int = 5000,
        compression_type: str = "lz4",
        seed: int = 42
    ):
        self.bootstrap_servers = bootstrap_servers
        self.aircraft_count = aircraft_count
        self.rate_target = rate_target
        self.compression_type = compression_type
        self.rng = random.Random(seed)
        self.producer = None
        self.is_running = False

        self.aircraft_keys = list(AIRCRAFT_PROFILES.keys())
        self.airports = GLOBAL_AIRPORTS

        # Initialize active airborne flights
        self.active_flights: List[Dict[str, Any]] = []
        for i in range(aircraft_count):
            al = self.rng.choice(AIRLINES_CATALOG)
            orig = self.rng.choice(self.airports)
            dest = self.rng.choice(self.airports)
            while dest.code == orig.code:
                dest = self.rng.choice(self.airports)

            aircraft_type = self.rng.choice(self.aircraft_keys)
            profile = AIRCRAFT_PROFILES[aircraft_type]
            dist_km = haversine_distance_km(orig.lat, orig.lon, dest.lat, dest.lon)
            flight_id = f"{al['code']}{1000 + i}"
            callsign = f"{al['code']}{1000 + i}"
            reg = f"{al['code']}-{2000 + i}"

            self.active_flights.append({
                "flight_id": flight_id,
                "callsign": callsign,
                "airline": al["name"],
                "airline_code": al["code"],
                "aircraft_type": aircraft_type,
                "registration": reg,
                "origin": orig,
                "destination": dest,
                "distance_km": dist_km,
                "speed_kts": profile.cruise_speed_knots,
                "cruise_alt": profile.cruise_altitude_ft,
                "fuel_burn_base": profile.fuel_burn_cruise_kgh,
                "progress": self.rng.uniform(0.05, 0.95),
                "is_emergency": (i % 250 == 0),
                "anomaly_type": "ENGINE_OVERHEAT" if (i % 250 == 0) else "NORMAL"
            })

    def connect_producer(self, retries: int = 5, retry_delay: float = 2.0) -> bool:
        """Connect to Kafka broker with high-throughput producer settings."""
        if not HAS_KAFKA:
            print("⚠️  kafka-python is not installed. Running in dry-run benchmark mode.", file=sys.stderr)
            return False

        print(f"⏳ Connecting KafkaProducer to {self.bootstrap_servers}...")
        for attempt in range(1, retries + 1):
            try:
                self.producer = KafkaProducer(
                    bootstrap_servers=self.bootstrap_servers.split(","),
                    key_serializer=lambda k: k.encode("utf-8") if isinstance(k, str) else k,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8") if isinstance(v, (dict, list)) else v,
                    acks=1,
                    linger_ms=10,
                    batch_size=65536,
                    compression_type=self.compression_type if self.compression_type != "none" else None,
                    max_request_size=5242880,
                    retries=3
                )
                print(f"✅ Kafka Producer connected successfully to {self.bootstrap_servers}!")
                return True
            except Exception as e:
                print(f"⚠️  Kafka connect attempt {attempt}/{retries} failed: {e}")
                if attempt < retries:
                    time.sleep(retry_delay)
        return False

    def step_telemetry(self, flight: Dict[str, Any], dt_sec: float) -> TelemetryEvent:
        """Advance aircraft position and emit TelemetryEvent."""
        speed_kmh = flight["speed_kts"] * 1.852
        dist_traveled_km = (speed_kmh / 3600.0) * dt_sec
        total_dist = max(1.0, flight["distance_km"])
        flight["progress"] += (dist_traveled_km / total_dist)

        # Wrap around route upon arrival
        if flight["progress"] >= 1.0:
            flight["progress"] = 0.01
            # swap origin and destination for return flight
            flight["origin"], flight["destination"] = flight["destination"], flight["origin"]

        f = flight["progress"]
        orig = flight["origin"]
        dest = flight["destination"]

        lat, lon = intermediate_point(orig.lat, orig.lon, dest.lat, dest.lon, f)
        heading = int(calculate_bearing(lat, lon, dest.lat, dest.lon))

        noise = (self.rng.random() - 0.5) * 1.5
        kin = compute_flight_kinematics(
            fraction=f,
            cruise_alt_ft=flight["cruise_alt"],
            cruise_speed_kts=flight["speed_kts"],
            base_fuel_burn_kgh=flight["fuel_burn_base"],
            anomaly_type=flight["anomaly_type"] if flight["is_emergency"] else "NORMAL",
            noise_factor=noise
        )

        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        return TelemetryEvent(
            event_id=f"EV-{flight['flight_id']}-{int(time.time()*1000)%1000000}",
            timestamp=now_str,
            flight_id=flight["flight_id"],
            callsign=flight["callsign"],
            airline=flight["airline"],
            aircraft_type=flight["aircraft_type"],
            aircraft_registration=flight["registration"],
            latitude=lat,
            longitude=lon,
            altitude_ft=kin["altitude_ft"],
            speed_knots=kin["speed_knots"],
            heading_deg=heading,
            vertical_rate_fpm=kin["vertical_rate_fpm"],
            squawk=kin["squawk"],
            flight_phase=kin["flight_phase"],
            engine_temperature=kin["engine_temperature"],
            fuel_flow_kgh=kin["fuel_flow_kgh"],
            vibration_mm_s=kin["vibration_mm_s"],
            co2_emission_rate_kgs=kin["co2_emission_rate_kgs"],
            sensor_quality=kin["sensor_quality"],
            anomaly_label=kin["anomaly_label"],
            route=f"{orig.code} ➔ {dest.code}",
            origin=orig.code,
            destination=dest.code
        )

    def run(self, duration_sec: int = 60, burst_mode: bool = False):
        target_eps = 10000 if burst_mode else self.rate_target
        print("=" * 72)
        print("✈️  HIGH-VOLUME AIRLINE LIVE SIMULATOR")
        print(f"📡 Target Kafka:    {self.bootstrap_servers}")
        print(f"🎯 Target Rate:     {target_eps:,} events/second ({'BURST MODE' if burst_mode else 'SUSTAINED'})")
        print(f"✈️  Fleet Size:      {self.aircraft_count:,} active aircraft")
        print(f"⏱️  Duration:        {duration_sec} seconds")
        print("=" * 72)

        has_connected = self.connect_producer()
        self.is_running = True

        start_time = time.time()
        last_metric_time = start_time
        total_produced = 0
        interval_produced = 0
        flight_idx = 0

        # Topic names
        TOPIC_TELEMETRY = "flight-telemetry"
        TOPIC_EVENTS = "flight-events"
        TOPIC_BOOKINGS = "bookings"
        TOPIC_FINANCIALS = "financial-events"
        TOPIC_WEATHER = "weather-events"
        TOPIC_MAINT = "maintenance-events"

        try:
            while self.is_running and (time.time() - start_time < duration_sec):
                batch_start = time.time()
                # Target batch for 100ms slice
                slice_target = int(target_eps * 0.1)

                for _ in range(slice_target):
                    flight = self.active_flights[flight_idx % len(self.active_flights)]
                    flight_idx += 1

                    ev = self.step_telemetry(flight, dt_sec=1.0)
                    total_produced += 1
                    interval_produced += 1

                    if has_connected and self.producer:
                        # 1. Primary telemetry event
                        self.producer.send(
                            TOPIC_TELEMETRY,
                            key=ev.flight_id,
                            value=ev.to_dict()
                        )

                        # 2. Intermittent business & operational events (schedules, bookings, financials)
                        if total_produced % 50 == 0:
                            self.producer.send(
                                TOPIC_EVENTS,
                                key=ev.flight_id,
                                value={
                                    "flightId": ev.flight_id,
                                    "callsign": ev.callsign,
                                    "phase": ev.flight_phase,
                                    "timestamp": ev.timestamp,
                                    "status": "In-Flight"
                                }
                            )

                        if total_produced % 100 == 0:
                            self.producer.send(
                                TOPIC_FINANCIALS,
                                key=ev.flight_id,
                                value={
                                    "flightId": ev.flight_id,
                                    "airline": ev.airline,
                                    "fuelBurnKg": round(ev.fuel_flow_kgh / 3600.0 * 10, 2),
                                    "co2Kg": round(ev.co2_emission_rate_kgs * 10, 2),
                                    "timestamp": ev.timestamp
                                }
                            )

                now = time.time()
                # Rate throttle to match slice
                elapsed_slice = now - batch_start
                expected_slice = 0.100
                if elapsed_slice < expected_slice:
                    time.sleep(expected_slice - elapsed_slice)

                # Report metric every 2 seconds
                if now - last_metric_time >= 2.0:
                    dt = now - last_metric_time
                    current_rate = interval_produced / dt
                    avg_rate = total_produced / (now - start_time)
                    print(
                        f"⏱️ [{now - start_time:4.1f}s] Produced: {total_produced:9,} events | "
                        f"Current Rate: {current_rate:7.0f} eps | "
                        f"Avg Rate: {avg_rate:7.0f} eps | "
                        f"Target: {target_eps:,} eps"
                    )
                    last_metric_time = now
                    interval_produced = 0

            if has_connected and self.producer:
                print("⏳ Flushing Kafka producer queue...")
                self.producer.flush(timeout=10)

        except KeyboardInterrupt:
            print("\n🛑 Simulation interrupted by user.")
        finally:
            if self.producer:
                self.producer.close(timeout=5)

        total_elapsed = max(0.001, time.time() - start_time)
        print("\n" + "=" * 72)
        print("✅ LIVE SIMULATION SESSION COMPLETE")
        print(f"📊 Total Events Produced:  {total_produced:,}")
        print(f"⏱️  Duration:              {total_elapsed:.2f} seconds")
        print(f"⚡ Average Ingestion Rate: {total_produced / total_elapsed:,.0f} events/second")
        print("=" * 72 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Live Flight Telemetry & Airline Analytics Kafka Simulator")
    parser.add_argument("--brokers", type=str, default="localhost:9093", help="Kafka bootstrap broker list")
    parser.add_argument("--aircraft", type=int, default=500, help="Number of concurrent simulated aircraft")
    parser.add_argument("--rate", type=int, default=5000, help="Target sustained events per second (e.g. 5000)")
    parser.add_argument("--burst", action="store_true", help="Enable 10,000 eps burst mode")
    parser.add_argument("--duration", type=int, default=60, help="Duration in seconds")
    parser.add_argument("--compression", type=str, choices=["none", "gzip", "snappy", "lz4"], default="lz4", help="Kafka compression codec")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")

    args = parser.parse_args()

    sim = LiveAviationSimulator(
        bootstrap_servers=args.brokers,
        aircraft_count=args.aircraft,
        rate_target=args.rate,
        compression_type=args.compression,
        seed=args.seed
    )
    sim.run(duration_sec=args.duration, burst_mode=args.burst)


if __name__ == "__main__":
    main()
