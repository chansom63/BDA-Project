"""
Synthetic Airline Financial and Accounting Data Generator.
Derives revenue, operating expenses, profit, and margins deterministically
from underlying flight duration, aircraft MTOW, fuel burn, and seat capacities.
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

from core.models import FinancialRecord
from core.catalog import (
    AIRCRAFT_PROFILES, AIRLINES_CATALOG, GLOBAL_AIRPORTS,
    JET_A_PRICE_PER_KG_USD
)
from core.kinematics import haversine_distance_km


class FinancialGenerator:
    def __init__(self, seed: Optional[int] = 42):
        self.rng = random.Random(seed)
        self.aircraft_keys = list(AIRCRAFT_PROFILES.keys())
        self.airports = GLOBAL_AIRPORTS

    def stream_financial_batches(
        self,
        total_records: int,
        batch_size: int = 10000,
        start_date: datetime = datetime(2026, 1, 1, 0, 0, 0)
    ) -> Generator[List[FinancialRecord], None, None]:
        """
        Yields batches of FinancialRecord items with exact mathematical reconciliation.
        """
        records_emitted = 0
        flight_seq = 1
        batch: List[FinancialRecord] = []

        while records_emitted < total_records:
            al = self.rng.choice(AIRLINES_CATALOG)
            orig = self.rng.choice(self.airports)
            dest = self.rng.choice(self.airports)
            while dest.code == orig.code:
                dest = self.rng.choice(self.airports)

            aircraft_type = self.rng.choice(self.aircraft_keys)
            profile = AIRCRAFT_PROFILES[aircraft_type]
            dist_km = haversine_distance_km(orig.lat, orig.lon, dest.lat, dest.lon)
            duration_hrs = max(0.8, dist_km / (profile.cruise_speed_knots * 1.852))

            flight_id = f"{al['code']}{flight_seq:05d}"
            route_str = f"{orig.code} ➔ {dest.code}"

            timestamp = start_date + timedelta(days=(flight_seq // 400), minutes=(flight_seq * 17 % 1440))
            ts_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")

            # 1. Revenue streams
            avg_fare_per_seat = 280.0 if profile.seat_capacity < 250 else 520.0
            load_factor = self.rng.uniform(0.68, 0.92)
            passengers = int(profile.seat_capacity * load_factor)
            ticket_revenue = passengers * avg_fare_per_seat * self.rng.uniform(0.9, 1.15)
            ancillary_revenue = passengers * self.rng.uniform(28.0, 52.0)
            cargo_revenue = (duration_hrs * 1200.0 * (profile.mtow_kg / 100000.0)) * self.rng.uniform(0.8, 1.4)

            total_revenue = ticket_revenue + ancillary_revenue + cargo_revenue

            # 2. Operating Costs
            fuel_burned_kg = duration_hrs * profile.fuel_burn_cruise_kgh * self.rng.uniform(0.95, 1.05)
            fuel_cost = fuel_burned_kg * JET_A_PRICE_PER_KG_USD

            # Airport handling / landing fee based on MTOW
            airport_fees = (profile.mtow_kg / 1000.0) * self.rng.uniform(18.0, 32.0) + 1200.0

            # Navigation charge (Eurocontrol / FAA unit rate * distance * sqrt(MTOW/50))
            nav_charges = (dist_km / 100.0) * (profile.mtow_kg / 50000.0) ** 0.5 * 45.0

            # Crew costs ($500-$1500/hr)
            crew_cost = duration_hrs * (650.0 + (profile.seat_capacity / 100.0) * 220.0)

            # Maintenance reserve per flight hour
            maint_cost = duration_hrs * (400.0 + (profile.mtow_kg / 100000.0) * 350.0)

            total_operating_cost = fuel_cost + airport_fees + nav_charges + crew_cost + maint_cost

            # 3. Operating Profit & Margin
            operating_profit = total_revenue - total_operating_cost
            operating_margin_pct = (operating_profit / total_revenue) * 100.0 if total_revenue > 0 else 0.0

            record = FinancialRecord(
                transaction_id=f"TX-{flight_id}",
                flight_id=flight_id,
                airline=al["name"],
                route=route_str,
                timestamp=ts_str,
                ticket_revenue=ticket_revenue,
                ancillary_revenue=ancillary_revenue,
                cargo_revenue=cargo_revenue,
                fuel_cost=fuel_cost,
                airport_fees=airport_fees,
                navigation_charges=nav_charges,
                crew_cost=crew_cost,
                maintenance_cost=maint_cost,
                total_revenue=total_revenue,
                total_operating_cost=total_operating_cost,
                operating_profit=operating_profit,
                operating_margin_pct=operating_margin_pct
            )

            batch.append(record)
            flight_seq += 1

            if len(batch) >= batch_size:
                records_emitted += len(batch)
                yield batch
                batch = []

        if batch:
            records_emitted += len(batch)
            yield batch
