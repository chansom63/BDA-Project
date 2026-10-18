"""
Passenger Booking, Ticketing, and Boarding Data Generator.
Ensures strict consistency between aircraft seating capacity, cabin classes,
booking counts, check-ins, boardings, no-shows, and fare revenues.
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

from core.models import PassengerBooking
from core.catalog import AIRCRAFT_PROFILES, AIRLINES_CATALOG


class PassengerGenerator:
    def __init__(self, seed: Optional[int] = 42):
        self.rng = random.Random(seed)
        self.aircraft_keys = list(AIRCRAFT_PROFILES.keys())

    def stream_booking_batches(
        self,
        total_records: int,
        batch_size: int = 10000,
        start_date: datetime = datetime(2026, 1, 1, 0, 0, 0)
    ) -> Generator[List[PassengerBooking], None, None]:
        """
        Yields batches of PassengerBooking records broken down by cabin class.
        Strictly respects aircraft seat capacity limits.
        """
        records_emitted = 0
        flight_seq = 1
        batch: List[PassengerBooking] = []

        cabins = [
            ("First", 3800.0, 95.0),
            ("Business", 1850.0, 65.0),
            ("Premium Economy", 620.0, 45.0),
            ("Economy", 240.0, 32.0),
        ]

        while records_emitted < total_records:
            al = self.rng.choice(AIRLINES_CATALOG)
            aircraft_type = self.rng.choice(self.aircraft_keys)
            profile = AIRCRAFT_PROFILES[aircraft_type]
            flight_id = f"{al['code']}{flight_seq:05d}"

            cabin_capacities = {
                "First": profile.first_class_seats,
                "Business": profile.business_class_seats,
                "Premium Economy": profile.premium_economy_seats,
                "Economy": profile.economy_seats
            }

            # Overall flight load factor target (65% to 94%)
            flight_target_lf = self.rng.uniform(0.65, 0.94)

            dep_time = start_date + timedelta(days=(flight_seq // 400), minutes=(flight_seq * 17 % 1440))
            booking_time = dep_time - timedelta(days=self.rng.randint(7, 45))
            booking_time_str = booking_time.strftime("%Y-%m-%d %H:%M:%S")

            for cabin_name, base_fare, base_ancillary in cabins:
                cap = cabin_capacities[cabin_name]
                if cap <= 0:
                    continue

                # Cabin load factor variation
                cabin_lf = max(0.4, min(1.0, flight_target_lf + self.rng.uniform(-0.08, 0.08)))
                booked = int(cap * cabin_lf)
                cancelled = int(booked * self.rng.uniform(0.01, 0.05))
                checked_in = booked - cancelled
                no_shows = int(checked_in * self.rng.uniform(0.005, 0.03))
                boarded = checked_in - no_shows

                # Revenue calculation
                fare_multiplier = self.rng.uniform(0.85, 1.25)
                ticket_rev = booked * base_fare * fare_multiplier
                ancillary_rev = boarded * base_ancillary * self.rng.uniform(0.9, 1.3)

                booking_record = PassengerBooking(
                    booking_id=f"BK-{flight_id}-{cabin_name[:3].upper()}",
                    flight_id=flight_id,
                    cabin_class=cabin_name,
                    booked_seats=booked,
                    check_in_count=checked_in,
                    boarded_count=boarded,
                    no_show_count=no_shows,
                    cancelled_count=cancelled,
                    ticket_revenue_usd=ticket_rev,
                    ancillary_revenue_usd=ancillary_rev,
                    booking_timestamp=booking_time_str
                )

                batch.append(booking_record)

                if len(batch) >= batch_size:
                    records_emitted += len(batch)
                    yield batch
                    batch = []

                if records_emitted + len(batch) >= total_records:
                    break

            flight_seq += 1

        if batch:
            records_emitted += len(batch)
            yield batch
