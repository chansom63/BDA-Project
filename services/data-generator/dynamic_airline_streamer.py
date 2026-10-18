"""
Dynamic Airline Streaming Engine & Network Operations Simulator.
Simulates a live 24/7 Airline Network Operations Center (NOC) by streaming
dynamic multi-source events into ClickHouse OLAP and Apache Kafka in real-time.

Simulated Streams:
1. Live Kinematic Flight Telemetry (positions, altitudes, speeds, fuel flow)
2. Dynamic Flight Schedules (Boarding, Departures, En-Route, Delays, Landings)
3. Live Financial Transactions (Ticket revenues, ancillary, cargo, fuel burn costs)
4. Dynamic Passenger Bookings (Live searches, seat reservations, cabin load factor)
5. Real-Time Airport Weather Observations (METAR temps, wind shear, delay risks)
6. Predictive Aircraft Fleet Maintenance (Accumulating flight hours & engine cycles)
7. Operational Anomaly Injections (Turbulence, engine overheats, squawk alerts)
"""

import os
import sys
import time
import json
import random
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

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
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from kafka import KafkaProducer
    HAS_KAFKA = True
except ImportError:
    HAS_KAFKA = False


class DynamicAirlineStreamer:
    def __init__(
        self,
        ch_host: str = "localhost",
        ch_port: int = 8123,
        ch_user: str = "ch_user",
        ch_password: str = "ch_password",
        ch_db: str = "default",
        kafka_brokers: Optional[str] = "localhost:9093",
        fleet_size: int = 60,
        interval_sec: float = 2.0,
        seed: int = 42
    ):
        self.ch_host = ch_host
        self.ch_port = ch_port
        self.ch_user = ch_user
        self.ch_password = ch_password
        self.ch_db = ch_db
        self.kafka_brokers = kafka_brokers
        self.fleet_size = fleet_size
        self.interval_sec = interval_sec
        self.rng = random.Random(seed)
        self.is_running = False

        self.producer = None
        self.aircraft_keys = list(AIRCRAFT_PROFILES.keys())
        self.airports = GLOBAL_AIRPORTS

        # Fleet state
        self.fleet: List[Dict[str, Any]] = []
        self._init_fleet()

        # Cumulative metrics for NOC HUD
        self.total_events_emitted = 0
        self.total_revenue_acc = 0.0
        self.total_cost_acc = 0.0
        self.total_co2_kg = 0.0
        self.anomalies_count = 0

    def _init_fleet(self):
        """Initialize active aircraft across global routes."""
        for i in range(self.fleet_size):
            al = self.rng.choice(AIRLINES_CATALOG)
            orig = self.rng.choice(self.airports)
            dest = self.rng.choice(self.airports)
            while dest.code == orig.code:
                dest = self.rng.choice(self.airports)

            aircraft_type = self.rng.choice(self.aircraft_keys)
            profile = AIRCRAFT_PROFILES[aircraft_type]
            dist_km = haversine_distance_km(orig.lat, orig.lon, dest.lat, dest.lon)
            flight_id = f"{al['code']}{2000 + i}"
            callsign = f"{al['code']}{2000 + i}"
            reg = f"{al['code']}-{4000 + i}"

            progress = self.rng.uniform(0.05, 0.95)
            scheduled_dep = datetime.utcnow() - timedelta(minutes=int(progress * 180))

            self.fleet.append({
                "flight_id": flight_id,
                "callsign": callsign,
                "airline": al["name"],
                "airline_code": al["code"],
                "aircraft_type": aircraft_type,
                "registration": reg,
                "profile": profile,
                "origin": orig,
                "destination": dest,
                "distance_km": dist_km,
                "speed_kts": profile.cruise_speed_knots,
                "cruise_alt": profile.cruise_altitude_ft,
                "fuel_burn_base": profile.fuel_burn_cruise_kgh,
                "seat_capacity": profile.seat_capacity,
                "progress": progress,
                "scheduled_dep": scheduled_dep,
                "delay_minutes": self.rng.choice([0, 0, 2, 5, 12, 28, 45]),
                "status": "In-Flight",
                "accumulated_hours": self.rng.uniform(1200.0, 18000.0),
                "accumulated_cycles": self.rng.randint(600, 9500),
                "is_emergency": (i % 25 == 0),
                "anomaly_type": "ENGINE_OVERHEAT" if (i % 25 == 0) else "NORMAL"
            })

    def connect_kafka(self) -> bool:
        if not HAS_KAFKA or not self.kafka_brokers:
            return False
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=self.kafka_brokers.split(","),
                key_serializer=lambda k: k.encode("utf-8") if isinstance(k, str) else k,
                value_serializer=lambda v: json.dumps(v).encode("utf-8") if isinstance(v, (dict, list)) else v,
                acks=1,
                request_timeout_ms=5000
            )
            print(f"✅ Dynamic Streamer connected to Kafka: {self.kafka_brokers}")
            return True
        except Exception as e:
            print(f"⚠️  Kafka direct connection skipped ({e}). Streaming directly to ClickHouse.")
            return False

    def insert_tsv_to_clickhouse(self, table: str, tsv_data: str) -> bool:
        if not HAS_REQUESTS or not tsv_data:
            return False
        url = f"http://{self.ch_host}:{self.ch_port}/?query=INSERT+INTO+{self.ch_db}.{table}+FORMAT+TabSeparated"
        auth = (self.ch_user, self.ch_password) if self.ch_user else None
        try:
            resp = requests.post(
                url,
                data=tsv_data.encode("utf-8"),
                auth=auth,
                timeout=10,
                headers={"Content-Type": "text/tab-separated-values"}
            )
            return resp.status_code == 200
        except Exception as e:
            return False

    def step_simulation(self):
        """Advance time and generate multi-source dynamic records."""
        now_dt = datetime.utcnow()
        now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")

        telemetry_batch: List[TelemetryEvent] = []
        schedule_batch: List[FlightSchedule] = []
        financial_batch: List[FinancialRecord] = []
        booking_batch: List[PassengerBooking] = []
        weather_batch: List[WeatherObservation] = []
        fleet_batch: List[FleetMaintenanceRecord] = []
        anomaly_batch: List[Dict[str, Any]] = []

        for f in self.fleet:
            # Advance progress along flight path (speed in km/h = knots * 1.852)
            speed_kmh = f["speed_kts"] * 1.852
            dist_traveled_km = (speed_kmh / 3600.0) * self.interval_sec
            f["progress"] += (dist_traveled_km / max(1.0, f["distance_km"]))

            # Turnaround when flight reaches destination
            if f["progress"] >= 1.0:
                f["progress"] = 0.02
                f["origin"], f["destination"] = f["destination"], f["origin"]
                f["scheduled_dep"] = now_dt
                f["delay_minutes"] = self.rng.choice([0, 0, 1, 4, 15, 35])
                f["accumulated_cycles"] += 1

            p = f["progress"]
            orig = f["origin"]
            dest = f["destination"]

            # Kinematics
            lat, lon = intermediate_point(orig.lat, orig.lon, dest.lat, dest.lon, p)
            heading = int(calculate_bearing(lat, lon, dest.lat, dest.lon))
            noise = (self.rng.random() - 0.5) * 1.5
            kin = compute_flight_kinematics(
                fraction=p,
                cruise_alt_ft=f["cruise_alt"],
                cruise_speed_kts=f["speed_kts"],
                base_fuel_burn_kgh=f["fuel_burn_base"],
                anomaly_type=f["anomaly_type"] if f["is_emergency"] else "NORMAL",
                noise_factor=noise
            )

            # 1. Telemetry Event
            telem_ev = TelemetryEvent(
                event_id=f"EV-{f['flight_id']}-{int(time.time()*1000)%1000000}",
                timestamp=now_str,
                flight_id=f["flight_id"],
                callsign=f["callsign"],
                airline=f["airline"],
                aircraft_type=f["aircraft_type"],
                aircraft_registration=f["registration"],
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
            telemetry_batch.append(telem_ev)

            # 2. Financial Ledger Increments
            # Incremental fuel cost & ancillary/ticket revenue accrued this tick
            fuel_burn_step_kg = (kin["fuel_flow_kgh"] / 3600.0) * self.interval_sec
            fuel_cost_step = fuel_burn_step_kg * 0.85  # ~$0.85/kg jet fuel
            ticket_rev_step = self.rng.uniform(150.0, 950.0)
            ancillary_rev_step = self.rng.uniform(25.0, 180.0)
            cargo_rev_step = self.rng.uniform(30.0, 220.0)
            operating_cost_step = fuel_cost_step + self.rng.uniform(40.0, 220.0)
            profit_step = (ticket_rev_step + ancillary_rev_step + cargo_rev_step) - operating_cost_step
            margin_step = (profit_step / max(1.0, ticket_rev_step + ancillary_rev_step + cargo_rev_step)) * 100.0

            fin_rec = FinancialRecord(
                transaction_id=f"TX-{f['flight_id']}-{int(time.time()*100)%100000}",
                flight_id=f["flight_id"],
                airline=f["airline"],
                route=f"{orig.code} ➔ {dest.code}",
                timestamp=now_str,
                ticket_revenue=ticket_rev_step,
                ancillary_revenue=ancillary_rev_step,
                cargo_revenue=cargo_rev_step,
                fuel_cost=fuel_cost_step,
                airport_fees=self.rng.uniform(15.0, 65.0),
                navigation_charges=self.rng.uniform(10.0, 45.0),
                crew_cost=self.rng.uniform(25.0, 80.0),
                maintenance_cost=self.rng.uniform(12.0, 50.0),
                total_revenue=ticket_rev_step + ancillary_rev_step + cargo_rev_step,
                total_operating_cost=operating_cost_step,
                operating_profit=profit_step,
                operating_margin_pct=margin_step
            )
            financial_batch.append(fin_rec)

            self.total_revenue_acc += fin_rec.total_revenue
            self.total_cost_acc += fin_rec.total_operating_cost
            self.total_co2_kg += (kin["co2_emission_rate_kgs"] * self.interval_sec)

            # 3. Flight Schedule Update
            status = "LANDED" if p > 0.95 else ("BOARDING" if p < 0.08 else ("CLIMB" if p < 0.25 else "CRUISE"))
            sched_rec = FlightSchedule(
                flight_id=f["flight_id"],
                callsign=f["callsign"],
                airline=f["airline"],
                origin=orig.code,
                destination=dest.code,
                scheduled_departure=f["scheduled_dep"].strftime("%Y-%m-%d %H:%M:%S"),
                actual_departure=(f["scheduled_dep"] + timedelta(minutes=f["delay_minutes"])).strftime("%Y-%m-%d %H:%M:%S"),
                scheduled_arrival=(f["scheduled_dep"] + timedelta(minutes=180)).strftime("%Y-%m-%d %H:%M:%S"),
                actual_arrival=(f["scheduled_dep"] + timedelta(minutes=180 + f["delay_minutes"])).strftime("%Y-%m-%d %H:%M:%S"),
                status=status,
                route_distance_km=f["distance_km"],
                aircraft_type=f["aircraft_type"],
                aircraft_registration=f["registration"],
                departure_delay_minutes=f["delay_minutes"],
                arrival_delay_minutes=f["delay_minutes"],
                weather_condition="VMC Clear" if f["delay_minutes"] < 15 else "IMC Rain / Thunderstorm",
                cancellation_reason=""
            )
            schedule_batch.append(sched_rec)

            # 4. Live Passenger Bookings
            if self.rng.random() < 0.25:
                cabin = self.rng.choices(["Economy", "Premium Economy", "Business", "First"], weights=[70, 15, 10, 5])[0]
                booked = self.rng.randint(1, 4)
                price = {"Economy": 280, "Premium Economy": 550, "Business": 1600, "First": 3400}[cabin]
                booking_rec = PassengerBooking(
                    booking_id=f"BK-{int(time.time()*1000)%10000000}",
                    flight_id=f["flight_id"],
                    cabin_class=cabin,
                    booked_seats=booked,
                    check_in_count=booked,
                    boarded_count=booked if p > 0.1 else 0,
                    no_show_count=0,
                    cancelled_count=0,
                    ticket_revenue_usd=booked * price,
                    ancillary_revenue_usd=booked * self.rng.uniform(35.0, 95.0),
                    booking_timestamp=now_str
                )
                booking_batch.append(booking_rec)

            # 5. Aircraft Maintenance
            f["accumulated_hours"] += (self.interval_sec / 3600.0)
            if self.rng.random() < 0.15:
                risk_score = 0.85 if kin["engine_temperature"] > 780 else round(self.rng.uniform(0.05, 0.35), 2)
                maint_rec = FleetMaintenanceRecord(
                    maintenance_id=f"MNT-{f['registration']}-{int(time.time())%100000}",
                    aircraft_registration=f["registration"],
                    aircraft_type=f["aircraft_type"],
                    airline=f["airline"],
                    timestamp=now_str,
                    flight_hours_total=f["accumulated_hours"],
                    flight_cycles_total=f["accumulated_cycles"],
                    engine_vibration_avg=kin["vibration_mm_s"],
                    last_maintenance_date=(now_dt - timedelta(days=self.rng.randint(5, 45))).strftime("%Y-%m-%d"),
                    next_scheduled_check="A-Check (350h remaining)",
                    component_status="SERVICABLE" if risk_score < 0.7 else "INSPECT_REQUIRED",
                    maintenance_downtime_hours=0.0,
                    maintenance_cost_usd=0.0,
                    failure_risk_score=risk_score
                )
                fleet_batch.append(maint_rec)

            # 6. Operational Anomalies
            if kin["anomaly_label"] != "NORMAL":
                self.anomalies_count += 1
                anom_data = {
                    "anomalyId": f"ANOM-{f['flight_id']}-{int(time.time())%10000}",
                    "timestamp": now_str,
                    "flightId": f["flight_id"],
                    "callsign": f["callsign"],
                    "anomalyType": kin["anomaly_label"],
                    "severity": "CRITICAL" if "EMERGENCY" in kin["anomaly_label"] else "WARNING",
                    "details": f"Sensor threshold divergence: Temp {kin['engine_temperature']}°C, Vib {kin['vibration_mm_s']} mm/s",
                    "altitudeFt": kin["altitude_ft"],
                    "speedKnots": kin["speed_knots"],
                    "engineTemperature": kin["engine_temperature"],
                    "squawk": kin["squawk"]
                }
                anomaly_batch.append(anom_data)

        # 7. Weather Observations (at active origins & destinations)
        active_apts = {apt.code: apt for apt in ([f["origin"] for f in self.fleet[:12]] + [f["destination"] for f in self.fleet[:12]])}.values()
        for apt in active_apts:
            w_rec = WeatherObservation(
                observation_id=f"METAR-{apt.code}-{int(time.time())%100000}",
                airport_code=apt.code,
                timestamp=now_str,
                temperature_c=round(self.rng.uniform(8.0, 32.0), 1),
                wind_speed_kts=round(self.rng.uniform(3.0, 32.0), 1),
                wind_direction_deg=self.rng.randint(10, 360),
                visibility_km=round(self.rng.uniform(4.0, 15.0), 1),
                precipitation_mm=round(self.rng.choice([0.0, 0.0, 0.0, 1.2, 5.5]), 1),
                condition_category="VMC" if self.rng.random() > 0.15 else "IMC",
                weather_delay_risk="LOW" if self.rng.random() > 0.2 else "HIGH"
            )
            weather_batch.append(w_rec)

        # --- STREAM TO CLICKHOUSE ---
        self.insert_tsv_to_clickhouse("flight_telemetry", "".join(e.to_tsv() for e in telemetry_batch))
        self.insert_tsv_to_clickhouse("flight_financials", "".join(e.to_tsv() for e in financial_batch))
        self.insert_tsv_to_clickhouse("flight_schedules", "".join(e.to_tsv() for e in schedule_batch))
        if booking_batch:
            self.insert_tsv_to_clickhouse("flight_bookings", "".join(e.to_tsv() for e in booking_batch))
        if weather_batch:
            self.insert_tsv_to_clickhouse("weather_observations", "".join(e.to_tsv() for e in weather_batch))
        if fleet_batch:
            self.insert_tsv_to_clickhouse("fleet_maintenance", "".join(e.to_tsv() for e in fleet_batch))
        if anomaly_batch:
            tsv_anom = "".join(
                f"{a['anomalyId']}\t{a['timestamp']}\t{a['flightId']}\t{a['callsign']}\t"
                f"{a['anomalyType']}\t{a['severity']}\t{a['details']}\t{a['altitudeFt']}\t"
                f"{a['speedKnots']}\t{a['engineTemperature']}\t{a['squawk']}\n"
                for a in anomaly_batch
            )
            self.insert_tsv_to_clickhouse("flight_anomalies", tsv_anom)

        # --- STREAM TO KAFKA (if available) ---
        if self.producer:
            for ev in telemetry_batch:
                self.producer.send("flight-telemetry", key=ev.flight_id, value=ev.to_dict())
            for anom in anomaly_batch:
                self.producer.send("anomalies", key=anom["flightId"], value=anom)

        total_step_events = (
            len(telemetry_batch) + len(financial_batch) + len(schedule_batch) +
            len(booking_batch) + len(weather_batch) + len(fleet_batch) + len(anomaly_batch)
        )
        self.total_events_emitted += total_step_events
        return total_step_events

    def run(self, duration_sec: int = 0):
        """Run the live streaming engine."""
        print("=" * 76)
        print("✈️  GAGAN AIRLINE NETWORK OPERATIONS CENTER (NOC) STREAMING ENGINE")
        print(f"📡 ClickHouse Target: http://{self.ch_host}:{self.ch_port} (DB: {self.ch_db})")
        print(f"📡 Kafka Target:      {self.kafka_brokers}")
        print(f"✈️  Active Fleet:      {self.fleet_size} airborne aircraft")
        print(f"⏱️  Stream Interval:   Every {self.interval_sec:.1f}s")
        print(f"⏳ Mode:              {'Endless Continuous Stream' if duration_sec == 0 else f'{duration_sec}s Execution'}")
        print("=" * 76)

        self.connect_kafka()
        self.is_running = True
        start_time = time.time()
        tick = 0

        try:
            while self.is_running:
                step_start = time.time()
                tick += 1
                events_in_tick = self.step_simulation()
                elapsed = max(0.001, time.time() - start_time)
                current_rate = events_in_tick / max(0.001, time.time() - step_start)

                margin_pct = (
                    ((self.total_revenue_acc - self.total_cost_acc) / max(1.0, self.total_revenue_acc)) * 100.0
                )

                print(
                    f"⏱️ [Tick #{tick:04d} | {elapsed:4.0f}s] "
                    f"Emitted: {events_in_tick:3d} events ({current_rate:4.0f} ev/s) | "
                    f"Total Ingested: {self.total_events_emitted:6,} | "
                    f"Live Rev: ${self.total_revenue_acc/1000:6.1f}k | "
                    f"Margin: {margin_pct:4.1f}% | "
                    f"Alerts: {self.anomalies_count}"
                )

                if duration_sec > 0 and (time.time() - start_time) >= duration_sec:
                    break

                sleep_time = max(0.1, self.interval_sec - (time.time() - step_start))
                time.sleep(sleep_time)

        except KeyboardInterrupt:
            print("\n🛑 Streamer stopped by operator.")
        finally:
            if self.producer:
                self.producer.flush()
                self.producer.close()
            print("=" * 76)
            print(f"✅ STREAMING COMPLETED | Total Events Streamed: {self.total_events_emitted:,}")
            print("=" * 76)


def main():
    parser = argparse.ArgumentParser(description="Live Airline Multi-Source Dynamic Streamer")
    parser.add_argument("--ch-host", type=str, default="localhost", help="ClickHouse host")
    parser.add_argument("--ch-port", type=int, default=8123, help="ClickHouse HTTP port")
    parser.add_argument("--ch-user", type=str, default="ch_user", help="ClickHouse user")
    parser.add_argument("--ch-password", type=str, default="ch_password", help="ClickHouse password")
    parser.add_argument("--kafka", type=str, default="localhost:9093", help="Kafka broker address")
    parser.add_argument("--fleet-size", type=int, default=60, help="Number of simulated live flights")
    parser.add_argument("--interval", type=float, default=2.0, help="Streaming interval in seconds")
    parser.add_argument("--duration", type=int, default=0, help="Duration in seconds (0 for endless)")
    args = parser.parse_args()

    streamer = DynamicAirlineStreamer(
        ch_host=args.ch_host,
        ch_port=args.ch_port,
        ch_user=args.ch_user,
        ch_password=args.ch_password,
        kafka_brokers=args.kafka,
        fleet_size=args.fleet_size,
        interval_sec=args.interval
    )
    streamer.run(duration_sec=args.duration)


if __name__ == "__main__":
    main()
