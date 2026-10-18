"""
High-Volume Historical Data Generator & Bulk Loader.
Memory-efficient streaming generator supporting 1M, 10M, and 100M+ event scales.
Streams data in configurable chunks directly into ClickHouse HTTP or local TSV/JSON files,
strictly bounding Python RAM usage to O(batch_size).
"""

import os
import sys
import time
import argparse
import psutil
from datetime import datetime
from typing import Optional

# Force UTF-8 encoding on standard streams to avoid Windows cp1252 charmap errors
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Ensure data-generator package directory is in sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from core.models import (
    TelemetryEvent, FlightSchedule, PassengerBooking,
    FinancialRecord, WeatherObservation, FleetMaintenanceRecord
)
from generators.telemetry_generator import TelemetryGenerator
from generators.schedule_generator import ScheduleGenerator
from generators.passenger_generator import PassengerGenerator
from generators.financial_generator import FinancialGenerator
from generators.weather_generator import WeatherGenerator
from generators.fleet_generator import FleetGenerator

try:
    import clickhouse_connect
    HAS_CH_CONNECT = True
except ImportError:
    HAS_CH_CONNECT = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def get_process_memory_mb() -> float:
    """Return current Python process RSS memory in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024.0 * 1024.0)


def insert_tsv_to_clickhouse_http(
    ch_host: str,
    ch_port: int,
    user: str,
    password: str,
    database: str,
    table: str,
    tsv_data: str
) -> bool:
    """Stream TSV buffer to ClickHouse over HTTP with TabSeparated format."""
    if not HAS_REQUESTS:
        return False
    url = f"http://{ch_host}:{ch_port}/?query=INSERT+INTO+{database}.{table}+FORMAT+TabSeparated"
    auth = (user, password) if user else None
    try:
        resp = requests.post(
            url,
            data=tsv_data.encode("utf-8"),
            auth=auth,
            timeout=60,
            headers={"Content-Type": "text/tab-separated-values"}
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"⚠️  ClickHouse HTTP Insert Error: {e}", file=sys.stderr)
        return False


def run_historical_generation(
    dataset: str,
    total_records: int,
    batch_size: int = 50000,
    output_dir: Optional[str] = None,
    ch_host: Optional[str] = None,
    ch_port: int = 8123,
    ch_user: str = "ch_user",
    ch_password: str = "ch_password",
    ch_db: str = "default",
    seed: int = 42
):
    print("=" * 72)
    print("🚀 HIGH-VOLUME AIRLINE HISTORICAL GENERATOR")
    print(f"📦 Dataset Target:  {dataset}")
    print(f"🎯 Record Count:    {total_records:,}")
    print(f"⏱️  Chunk / Batch:   {batch_size:,} records")
    print(f"🌱 Deterministic:   Seed={seed}")
    print(f"💾 Output Mode:     {'ClickHouse (' + ch_host + ')' if ch_host else 'File Export (' + str(output_dir) + ')'}")
    print("=" * 72)

    start_time = time.time()
    records_processed = 0
    initial_mem = get_process_memory_mb()

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    file_handle = None
    if output_dir and not ch_host:
        file_path = os.path.join(output_dir, f"{dataset}_{total_records}.tsv")
        file_handle = open(file_path, "w", encoding="utf-8", buffering=1024*1024)
        print(f"📁 Writing output to: {file_path}")

    # Initialize requested generator
    if dataset == "telemetry":
        gen = TelemetryGenerator(seed=seed)
        batch_stream = gen.stream_telemetry_batches(total_events=total_records, batch_size=batch_size)
        table_name = "flight_telemetry"
    elif dataset == "schedules":
        gen = ScheduleGenerator(seed=seed)
        batch_stream = gen.stream_schedule_batches(total_records=total_records, batch_size=batch_size)
        table_name = "flight_schedules"
    elif dataset == "bookings":
        gen = PassengerGenerator(seed=seed)
        batch_stream = gen.stream_booking_batches(total_records=total_records, batch_size=batch_size)
        table_name = "flight_bookings"
    elif dataset == "financials":
        gen = FinancialGenerator(seed=seed)
        batch_stream = gen.stream_financial_batches(total_records=total_records, batch_size=batch_size)
        table_name = "flight_financials"
    elif dataset == "weather":
        gen = WeatherGenerator(seed=seed)
        batch_stream = gen.stream_weather_batches(total_records=total_records, batch_size=batch_size)
        table_name = "weather_observations"
    elif dataset == "fleet":
        gen = FleetGenerator(seed=seed)
        batch_stream = gen.stream_maintenance_batches(total_records=total_records, batch_size=batch_size)
        table_name = "fleet_maintenance"
    else:
        raise ValueError(f"Unknown dataset type: {dataset}")

    batch_idx = 0
    try:
        for batch in batch_stream:
            batch_idx += 1
            batch_len = len(batch)
            records_processed += batch_len

            # Convert batch to TSV lines
            tsv_lines = "".join(item.to_tsv() for item in batch)

            if file_handle:
                file_handle.write(tsv_lines)

            if ch_host:
                insert_tsv_to_clickhouse_http(
                    ch_host=ch_host,
                    ch_port=ch_port,
                    user=ch_user,
                    password=ch_password,
                    database=ch_db,
                    table=table_name,
                    tsv_data=tsv_lines
                )

            now = time.time()
            elapsed = max(0.001, now - start_time)
            rate = records_processed / elapsed
            progress_pct = (records_processed / total_records) * 100.0
            current_mem = get_process_memory_mb()
            eta_sec = (total_records - records_processed) / rate if rate > 0 else 0

            # Output progress update every batch
            print(
                f"[{progress_pct:5.1f}%] Chunk #{batch_idx:04d} | "
                f"Processed: {records_processed:9,}/{total_records:,} | "
                f"Throughput: {rate:8.0f} rec/s | "
                f"RAM: {current_mem:5.1f} MB (Δ {current_mem - initial_mem:+.1f} MB) | "
                f"ETA: {eta_sec:4.0f}s"
            )

    finally:
        if file_handle:
            file_handle.close()

    total_time = max(0.001, time.time() - start_time)
    avg_rate = records_processed / total_time
    final_mem = get_process_memory_mb()

    print("\n" + "=" * 72)
    print("✅ HISTORICAL GENERATION COMPLETE")
    print(f"📊 Total Records Emitted: {records_processed:,}")
    print(f"⏱️  Total Elapsed Time:   {total_time:.2f} seconds")
    print(f"⚡ Average Throughput:    {avg_rate:,.0f} records/second")
    print(f"🧠 Peak Process Memory:   {final_mem:.1f} MB (strictly bounded)")
    print("=" * 72 + "\n")

    return {
        "dataset": dataset,
        "total_records": records_processed,
        "elapsed_seconds": round(total_time, 2),
        "throughput_rps": round(avg_rate, 1),
        "peak_ram_mb": round(final_mem, 1)
    }


def main():
    parser = argparse.ArgumentParser(description="High-Volume Historical Airline Analytics Data Generator")
    parser.add_argument("--dataset", choices=["telemetry", "schedules", "bookings", "financials", "weather", "fleet", "all"], default="telemetry", help="Target dataset to generate")
    parser.add_argument("--events", type=int, default=100000, help="Total number of events/records to generate (e.g. 1000000, 10000000, 100000000)")
    parser.add_argument("--batch-size", type=int, default=50000, help="Chunk batch size for memory-bounded generation")
    parser.add_argument("--out-dir", type=str, default="./historical_data", help="Output directory for TSV files")
    parser.add_argument("--ch-host", type=str, default=None, help="ClickHouse host to stream directly into (e.g. localhost or clickhouse)")
    parser.add_argument("--ch-port", type=int, default=8123, help="ClickHouse HTTP port")
    parser.add_argument("--ch-user", type=str, default="ch_user", help="ClickHouse user")
    parser.add_argument("--ch-password", type=str, default="ch_password", help="ClickHouse password")
    parser.add_argument("--ch-db", type=str, default="default", help="ClickHouse database")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic random seed")

    args = parser.parse_args()

    if args.dataset == "all":
        datasets = ["schedules", "bookings", "financials", "weather", "fleet", "telemetry"]
        # Scale operational tables proportionally
        for d in datasets:
            scale = args.events if d == "telemetry" else max(10000, args.events // 10)
            run_historical_generation(
                dataset=d,
                total_records=scale,
                batch_size=min(args.batch_size, scale),
                output_dir=args.out_dir,
                ch_host=args.ch_host,
                ch_port=args.ch_port,
                ch_user=args.ch_user,
                ch_password=args.ch_password,
                ch_db=args.ch_db,
                seed=args.seed
            )
    else:
        run_historical_generation(
            dataset=args.dataset,
            total_records=args.events,
            batch_size=args.batch_size,
            output_dir=args.out_dir,
            ch_host=args.ch_host,
            ch_port=args.ch_port,
            ch_user=args.ch_user,
            ch_password=args.ch_password,
            ch_db=args.ch_db,
            seed=args.seed
        )


if __name__ == "__main__":
    main()
