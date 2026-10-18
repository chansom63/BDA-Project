"""
Fleet Reference and Predictive Maintenance Events Generator.
Generates airframe operational history, engine vibration metrics,
scheduled check intervals (A/B/C/D checks), downtime, and failure risk models.
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

from core.models import FleetMaintenanceRecord
from core.catalog import AIRCRAFT_PROFILES, AIRLINES_CATALOG


class FleetGenerator:
    def __init__(self, seed: Optional[int] = 42):
        self.rng = random.Random(seed)
        self.aircraft_keys = list(AIRCRAFT_PROFILES.keys())

    def stream_maintenance_batches(
        self,
        total_records: int,
        batch_size: int = 10000,
        start_date: datetime = datetime(2026, 1, 1, 0, 0, 0)
    ) -> Generator[List[FleetMaintenanceRecord], None, None]:
        """
        Yields batches of FleetMaintenanceRecord items.
        """
        records_emitted = 0
        seq = 1
        batch: List[FleetMaintenanceRecord] = []

        checks = ["CHECK_A", "CHECK_B", "CHECK_C", "CHECK_D"]
        statuses = ["OPTIMAL", "OPTIMAL", "SERVICED", "MONITOR_REQUIRED", "CRITICAL"]

        while records_emitted < total_records:
            al = self.rng.choice(AIRLINES_CATALOG)
            aircraft_type = self.rng.choice(self.aircraft_keys)
            reg = f"{al['code']}-{1000 + (seq % 8000)}"

            # Accumulated flight hours and cycles
            total_hours = self.rng.uniform(1200.0, 48000.0)
            avg_flight_len = self.rng.uniform(2.5, 6.0)
            total_cycles = int(total_hours / avg_flight_len)

            vibe_avg = self.rng.uniform(0.9, 3.8)
            check_type = self.rng.choice(checks)
            status = self.rng.choice(statuses)

            # Failure risk score derived through a logistic risk function
            # influenced by vibration, cycle ratio, and maintenance urgency
            risk_raw = (vibe_avg / 4.0) * 0.4 + (total_hours / 50000.0) * 0.3 + (0.3 if status == "MONITOR_REQUIRED" else 0.05)
            failure_risk = min(0.999, max(0.001, risk_raw + self.rng.gauss(0, 0.03)))

            # Downtime and cost
            if check_type == "CHECK_A":
                downtime = self.rng.uniform(8.0, 24.0)
                cost = self.rng.uniform(4000.0, 15000.0)
            elif check_type == "CHECK_B":
                downtime = self.rng.uniform(24.0, 72.0)
                cost = self.rng.uniform(18000.0, 45000.0)
            elif check_type == "CHECK_C":
                downtime = self.rng.uniform(120.0, 360.0)
                cost = self.rng.uniform(120000.0, 350000.0)
            else:  # CHECK_D (Heavy maintenance overhaul)
                downtime = self.rng.uniform(720.0, 1440.0)
                cost = self.rng.uniform(1500000.0, 4000000.0)

            rec_date = start_date + timedelta(days=(seq % 365), hours=(seq % 24))
            last_date = rec_date - timedelta(days=self.rng.randint(15, 120))

            record = FleetMaintenanceRecord(
                maintenance_id=f"MNT-{al['code']}-{seq:06d}",
                aircraft_registration=reg,
                aircraft_type=aircraft_type,
                airline=al["name"],
                timestamp=rec_date.strftime("%Y-%m-%d %H:%M:%S"),
                flight_hours_total=total_hours,
                flight_cycles_total=total_cycles,
                engine_vibration_avg=vibe_avg,
                last_maintenance_date=last_date.strftime("%Y-%m-%d"),
                next_scheduled_check=check_type,
                component_status=status,
                maintenance_downtime_hours=downtime,
                maintenance_cost_usd=cost,
                failure_risk_score=failure_risk
            )

            batch.append(record)
            seq += 1

            if len(batch) >= batch_size:
                records_emitted += len(batch)
                yield batch
                batch = []

        if batch:
            records_emitted += len(batch)
            yield batch
