"""
High-Throughput Synthetic Flight Telemetry Generator.
Generates realistic flight trajectories, sensor streams, and ground-truth anomaly labels.
Memory-efficient chunk generator designed to emit millions of records with constant RAM usage.
"""

import random
from datetime import datetime, timedelta
from typing import Generator, List, Dict, Any, Optional
import os
import sys

# Ensure data-generator root is in sys.path for direct imports
_generator_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _generator_root not in sys.path:
    sys.path.insert(0, _generator_root)

from core.models import TelemetryEvent
from core.catalog import (
    GLOBAL_AIRPORTS, AIRPORT_LOOKUP, AIRLINES_CATALOG, AIRCRAFT_PROFILES
)
from core.kinematics import (
    haversine_distance_km, calculate_bearing, intermediate_point, compute_flight_kinematics
)


class TelemetryGenerator:
    def __init__(self, seed: Optional[int] = 42):
        self.rng = random.Random(seed)
        self.aircraft_keys = list(AIRCRAFT_PROFILES.keys())
        self.airports = GLOBAL_AIRPORTS

    def generate_flight_waypoints(
        self,
        flight_id: str,
        callsign: str,
        airline: str,
        aircraft_type: str,
        registration: str,
        origin_code: str,
        dest_code: str,
        start_time: datetime,
        duration_minutes: int,
        points_count: int,
        inject_anomaly: bool = False,
        anomaly_type: str = "NORMAL"
    ) -> List[TelemetryEvent]:
        """Generate all telemetry events for a single flight leg."""
        orig = AIRPORT_LOOKUP[origin_code]
        dest = AIRPORT_LOOKUP[dest_code]
        profile = AIRCRAFT_PROFILES[aircraft_type]
        route_str = f"{orig.code} ➔ {dest.code}"

        events: List[TelemetryEvent] = []
        time_step = duration_minutes * 60.0 / max(1, (points_count - 1))

        # Select a random window where the anomaly occurs if flagged
        anomaly_window_start = self.rng.uniform(0.35, 0.65) if inject_anomaly else -1.0
        anomaly_window_end = anomaly_window_start + 0.15

        for i in range(points_count):
            fraction = i / max(1, points_count - 1)
            t = start_time + timedelta(seconds=i * time_step)
            t_str = t.strftime("%Y-%m-%d %H:%M:%S")

            lat, lon = intermediate_point(orig.lat, orig.lon, dest.lat, dest.lon, fraction)
            heading = int(calculate_bearing(lat, lon, dest.lat, dest.lon))

            is_in_anomaly = inject_anomaly and (anomaly_window_start <= fraction <= anomaly_window_end)
            active_anomaly = anomaly_type if is_in_anomaly else "NORMAL"
            noise = (self.rng.random() - 0.5) * 2.0  # -1.0 to 1.0

            kin = compute_flight_kinematics(
                fraction=fraction,
                cruise_alt_ft=profile.cruise_altitude_ft,
                cruise_speed_kts=profile.cruise_speed_knots,
                base_fuel_burn_kgh=profile.fuel_burn_cruise_kgh,
                anomaly_type=active_anomaly,
                noise_factor=noise
            )

            event = TelemetryEvent(
                event_id=f"EV-{flight_id}-{i:04d}",
                timestamp=t_str,
                flight_id=flight_id,
                callsign=callsign,
                airline=airline,
                aircraft_type=aircraft_type,
                aircraft_registration=registration,
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
                route=route_str,
                origin=orig.code,
                destination=dest.code
            )
            events.append(event)

        return events

    def stream_telemetry_batches(
        self,
        total_events: int,
        batch_size: int = 10000,
        start_date: datetime = datetime(2026, 1, 1, 0, 0, 0),
        anomaly_ratio: float = 0.02
    ) -> Generator[List[TelemetryEvent], None, None]:
        """
        Yields batches of TelemetryEvents until total_events is reached.
        Keeps memory strictly bounded to O(batch_size).
        """
        events_emitted = 0
        flight_seq = 1

        batch: List[TelemetryEvent] = []

        anomaly_options = [
            "ENGINE_OVERHEAT", "HIGH_VIBRATION", "FUEL_DIVERGENCE",
            "EMERGENCY_SQUAWK", "RAPID_DESCENT"
        ]

        while events_emitted < total_events:
            al = self.rng.choice(AIRLINES_CATALOG)
            orig = self.rng.choice(self.airports)
            dest = self.rng.choice(self.airports)
            while dest.code == orig.code:
                dest = self.rng.choice(self.airports)

            aircraft_type = self.rng.choice(self.aircraft_keys)
            dist_km = haversine_distance_km(orig.lat, orig.lon, dest.lat, dest.lon)
            speed_kts = AIRCRAFT_PROFILES[aircraft_type].cruise_speed_knots
            duration_hrs = max(0.8, dist_km / (speed_kts * 1.852))
            duration_mins = int(duration_hrs * 60)

            # Sample points per flight (e.g. 50-100 waypoints per flight)
            points_for_flight = min(100, max(20, duration_mins // 5))
            if events_emitted + len(batch) + points_for_flight > total_events:
                points_for_flight = total_events - (events_emitted + len(batch))

            if points_for_flight <= 0:
                break

            flight_id = f"{al['code']}{flight_seq:05d}"
            callsign = f"{al['code']}{flight_seq}"
            reg = f"{al['code']}-{1000 + (flight_seq % 8000)}"

            inject_anomaly = self.rng.random() < anomaly_ratio
            chosen_anomaly = self.rng.choice(anomaly_options) if inject_anomaly else "NORMAL"

            # Progress departure date
            flight_start = start_date + timedelta(
                days=(flight_seq // 400),
                minutes=(flight_seq % 1440)
            )

            flight_events = self.generate_flight_waypoints(
                flight_id=flight_id,
                callsign=callsign,
                airline=al["name"],
                aircraft_type=aircraft_type,
                registration=reg,
                origin_code=orig.code,
                dest_code=dest.code,
                start_time=flight_start,
                duration_minutes=duration_mins,
                points_count=points_for_flight,
                inject_anomaly=inject_anomaly,
                anomaly_type=chosen_anomaly
            )

            batch.extend(flight_events)
            flight_seq += 1

            if len(batch) >= batch_size:
                events_emitted += len(batch)
                yield batch
                batch = []

        if batch:
            events_emitted += len(batch)
            yield batch
