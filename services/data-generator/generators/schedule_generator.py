"""
Flight Schedule and Operational Events Generator.
Produces scheduled flights, actual operational timestamps, delay metrics,
cancellations, and diversions with log-normal delay distributions.
"""

import random
from datetime import datetime, timedelta
from typing import Generator, List, Optional
import os
import sys

# Ensure data-generator root is in sys.path for direct imports
_generator_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _generator_root not in sys.path:
    sys.path.insert(0, _generator_root)

from core.models import FlightSchedule
from core.catalog import (
    GLOBAL_AIRPORTS, AIRPORT_LOOKUP, AIRLINES_CATALOG, AIRCRAFT_PROFILES
)
from core.kinematics import haversine_distance_km


class ScheduleGenerator:
    def __init__(self, seed: Optional[int] = 42):
        self.rng = random.Random(seed)
        self.aircraft_keys = list(AIRCRAFT_PROFILES.keys())
        self.airports = GLOBAL_AIRPORTS

    def stream_schedule_batches(
        self,
        total_records: int,
        batch_size: int = 10000,
        start_date: datetime = datetime(2026, 1, 1, 6, 0, 0)
    ) -> Generator[List[FlightSchedule], None, None]:
        """
        Yields batches of FlightSchedule records with consistent delay metrics.
        """
        records_emitted = 0
        flight_seq = 1
        batch: List[FlightSchedule] = []

        weather_conditions = ["CLEAR", "PARTLY_CLOUDY", "RAIN", "THUNDERSTORM", "SNOW", "FOG"]
        cancellation_reasons = ["WEATHER", "MECHANICAL", "AIR_TRAFFIC_CONTROL", "CREW_SCHEDULING", "SECURITY"]

        while records_emitted < total_records:
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

            sched_dep = start_date + timedelta(
                days=(flight_seq // 400),
                minutes=(flight_seq * 17 % 1440)
            )
            sched_arr = sched_dep + timedelta(minutes=duration_mins)

            # Determine operational outcome
            rand_val = self.rng.random()
            if rand_val < 0.015:
                # Cancelled flight
                status = "CANCELLED"
                dep_delay = 0
                arr_delay = 0
                act_dep_str = "1970-01-01 00:00:00"
                act_arr_str = "1970-01-01 00:00:00"
                cancel_reason = self.rng.choice(cancellation_reasons)
                weather_cond = self.rng.choice(weather_conditions)
            elif rand_val < 0.022:
                # Diverted flight
                status = "DIVERTED"
                dep_delay = int(self.rng.lognormvariate(2.2, 0.7))
                act_dep = sched_dep + timedelta(minutes=dep_delay)
                act_dep_str = act_dep.strftime("%Y-%m-%d %H:%M:%S")
                act_arr_str = "1970-01-01 00:00:00"
                arr_delay = 180
                cancel_reason = "DIVERTED_TO_ALTERNATE"
                weather_cond = "THUNDERSTORM"
            else:
                # Normal operational flight (On-time or Delayed)
                status = "ARRIVED"
                cancel_reason = "NONE"
                weather_cond = self.rng.choice(weather_conditions)

                # Departure delay: realistic log-normal skew centered around small values (-5 to +60 min)
                if self.rng.random() < 0.75:
                    dep_delay = int(self.rng.gauss(3, 8))  # normal distribution around +3m
                else:
                    dep_delay = int(self.rng.lognormvariate(3.0, 0.6))  # tail delays (20-120 min)

                dep_delay = max(-15, min(360, dep_delay))

                # Flight time variance in the air (-10m to +25m depending on winds)
                in_air_variance = int(self.rng.gauss(0, 7))
                arr_delay = max(-25, dep_delay + in_air_variance)

                act_dep = sched_dep + timedelta(minutes=dep_delay)
                act_arr = sched_arr + timedelta(minutes=arr_delay)
                act_dep_str = act_dep.strftime("%Y-%m-%d %H:%M:%S")
                act_arr_str = act_arr.strftime("%Y-%m-%d %H:%M:%S")

            flight_id = f"{al['code']}{flight_seq:05d}"
            callsign = f"{al['code']}{flight_seq}"
            reg = f"{al['code']}-{1000 + (flight_seq % 8000)}"

            schedule_record = FlightSchedule(
                flight_id=flight_id,
                callsign=callsign,
                airline=al["name"],
                origin=orig.code,
                destination=dest.code,
                scheduled_departure=sched_dep.strftime("%Y-%m-%d %H:%M:%S"),
                actual_departure=act_dep_str,
                scheduled_arrival=sched_arr.strftime("%Y-%m-%d %H:%M:%S"),
                actual_arrival=act_arr_str,
                status=status,
                route_distance_km=dist_km,
                aircraft_type=aircraft_type,
                aircraft_registration=reg,
                departure_delay_minutes=dep_delay,
                arrival_delay_minutes=arr_delay,
                weather_condition=weather_cond,
                cancellation_reason=cancel_reason
            )

            batch.append(schedule_record)
            flight_seq += 1

            if len(batch) >= batch_size:
                records_emitted += len(batch)
                yield batch
                batch = []

        if batch:
            records_emitted += len(batch)
            yield batch
