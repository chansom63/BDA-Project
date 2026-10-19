"""
End-to-End Pipeline Demonstration Script.
Initializes MongoDB collections and indexes, processes synthetic flight batches
through the validation and enrichment engine, inserts into MongoDB,
and prints operational statistics.
"""

import sys
import json
import glob
from datetime import datetime, timezone

from ingestion.pipeline import process_single_message
from ingestion.mongo_sink import init_mongo_indexes, write_batch_to_mongo, get_mongo_client
from ingestion.config import (
    MONGO_URI,
    MONGO_DB_NAME,
    TOPIC_TO_COLLECTION,
    COLL_INGESTION_QUARANTINE,
)
from simulators.unified_simulator import (
    AIRCRAFT_FLEET,
    generate_flight_event,
    generate_turnaround_event,
    generate_engine_event,
    generate_passenger_event,
    generate_crew_event,
)


def run_e2e_demo():
    print("=" * 70)
    print("🚀 FLIGHT TELEMETRY & OPERATIONS PIPELINE E2E DEMO")
    print(f"📡 MongoDB Target: {MONGO_URI} (Database: {MONGO_DB_NAME})")
    print("=" * 70)

    # 1. Initialize MongoDB
    try:
        init_mongo_indexes()
    except Exception as exc:
        print(f"⚠️ Note on MongoDB connection: {exc}")
        print("Continuing with in-memory pipeline processing demo...")

    # 2. Generate and process events for all aircraft
    records_by_coll = {}
    quarantined = []
    total_processed = 0

    print("\n📦 Simulating incoming Kafka streams across all 5 topics...")

    for i, ac in enumerate(AIRCRAFT_FLEET, 1):
        flight_msg = json.dumps(generate_flight_event(ac))
        turnaround_msg = json.dumps(generate_turnaround_event(ac))
        engine_msg = json.dumps(generate_engine_event(ac))
        passenger_msg = json.dumps(generate_passenger_event(ac))
        crew_msg = json.dumps(generate_crew_event(ac))

        stream_items = [
            ("flight-events", flight_msg),
            ("acdm-turnaround-events", turnaround_msg),
            ("engine-acars-events", engine_msg),
            ("passenger-dcs-events", passenger_msg),
            ("crew-clearance-events", crew_msg),
        ]

        for topic, payload in stream_items:
            total_processed += 1
            meta = {"topic": topic, "partition": 0, "offset": total_processed, "timestamp": datetime.now(timezone.utc)}
            coll_name, enriched, qr = process_single_message(topic, payload, meta, batch_id="demo_batch_1")
            if qr:
                quarantined.append(qr)
            if enriched:
                records_by_coll.setdefault(coll_name, []).append(enriched)

    # Add deliberate test edge cases: malformed JSON and data-quality violation
    print("🧪 Injecting edge cases: 1 malformed JSON record + 1 out-of-range record...")
    malformed_meta = {"topic": "flight-events", "partition": 0, "offset": 999, "timestamp": datetime.now(timezone.utc)}
    _, _, qr1 = process_single_message("flight-events", "{malformed_json: bad_value}", malformed_meta, "edge_case_batch")
    if qr1:
        quarantined.append(qr1)
        total_processed += 1

    bad_pax = json.dumps({
        "timestamp_utc": "2026-10-19T12:54:00Z",
        "flight_number": "SG 8181",
        "total_seating_capacity": 150,
        "booked_passengers": 150,
        "boarded_passengers": 220,  # Exceeds capacity
    })
    _, _, qr2 = process_single_message("passenger-dcs-events", bad_pax, malformed_meta, "edge_case_batch")
    if qr2:
        quarantined.append(qr2)
        total_processed += 1

    # 3. Write to MongoDB
    print("\n📥 Sinking processed documents into MongoDB...")
    total_written = 0
    try:
        for coll, recs in records_by_coll.items():
            count = write_batch_to_mongo(coll, recs)
            total_written += count
            print(f"  ✅ Collection '{coll}': {count} documents upserted.")

        if quarantined:
            q_count = write_batch_to_mongo(COLL_INGESTION_QUARANTINE, quarantined)
            print(f"  🚨 Collection '{COLL_INGESTION_QUARANTINE}': {q_count} records quarantined.")
    except Exception as exc:
        print(f"⚠️ MongoDB write note: {exc}")

    print("\n" + "=" * 70)
    print("📊 INGESTION METRICS SUMMARY")
    print(f"  • Total messages consumed: {total_processed}")
    print(f"  • Successfully validated & enriched: {total_written}")
    print(f"  • Quarantined (malformed/invalid): {len(quarantined)}")
    print(f"  • MongoDB collections active: {len(records_by_coll) + (1 if quarantined else 0)}")
    print("=" * 70)
    print("✨ Demo completed successfully!")


if __name__ == "__main__":
    run_e2e_demo()
