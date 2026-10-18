"""
Synthetic Weather and Environmental Observation Generator.
Simulates atmospheric readings at major airport terminals with meteorological consistency.
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

from core.models import WeatherObservation
from core.catalog import GLOBAL_AIRPORTS


class WeatherGenerator:
    def __init__(self, seed: Optional[int] = 42):
        self.rng = random.Random(seed)
        self.airports = GLOBAL_AIRPORTS

    def stream_weather_batches(
        self,
        total_records: int,
        batch_size: int = 10000,
        start_date: datetime = datetime(2026, 1, 1, 0, 0, 0)
    ) -> Generator[List[WeatherObservation], None, None]:
        """
        Yields batches of WeatherObservation records across airports.
        """
        records_emitted = 0
        step_idx = 0
        batch: List[WeatherObservation] = []

        while records_emitted < total_records:
            apt = self.airports[step_idx % len(self.airports)]
            obs_time = start_date + timedelta(hours=(step_idx // len(self.airports)))
            ts_str = obs_time.strftime("%Y-%m-%d %H:%M:%S")

            # Airport latitude affects base temperature
            base_temp = 25.0 - (abs(apt.lat) / 90.0) * 35.0
            temp_c = base_temp + self.rng.gauss(0, 5)

            wind_speed = max(0.0, self.rng.lognormvariate(2.2, 0.5))
            wind_dir = self.rng.randint(0, 359)

            rand_cat = self.rng.random()
            if rand_cat < 0.70:
                cond = "VFR"
                vis_km = min(15.0, 10.0 + self.rng.uniform(0, 5))
                precip = 0.0
                risk = "LOW"
            elif rand_cat < 0.85:
                cond = "MVFR"
                vis_km = self.rng.uniform(5.0, 9.0)
                precip = self.rng.uniform(0.5, 2.5)
                risk = "MODERATE"
            elif rand_cat < 0.94:
                cond = "IFR"
                vis_km = self.rng.uniform(1.0, 4.5)
                precip = self.rng.uniform(2.0, 8.0)
                risk = "HIGH"
            elif rand_cat < 0.98:
                cond = "CONVECTIVE"
                vis_km = self.rng.uniform(0.8, 3.0)
                precip = self.rng.uniform(10.0, 35.0)
                risk = "SEVERE"
            else:
                cond = "SNOW_ICE"
                vis_km = self.rng.uniform(0.4, 2.0)
                precip = self.rng.uniform(3.0, 15.0)
                temp_c = min(-1.0, temp_c)
                risk = "SEVERE"

            obs = WeatherObservation(
                observation_id=f"WX-{apt.code}-{step_idx}",
                airport_code=apt.code,
                timestamp=ts_str,
                temperature_c=temp_c,
                wind_speed_kts=wind_speed,
                wind_direction_deg=wind_dir,
                visibility_km=vis_km,
                precipitation_mm=precip,
                condition_category=cond,
                weather_delay_risk=risk
            )

            batch.append(obs)
            step_idx += 1

            if len(batch) >= batch_size:
                records_emitted += len(batch)
                yield batch
                batch = []

        if batch:
            records_emitted += len(batch)
            yield batch
