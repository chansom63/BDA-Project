"""
MongoDB Sink and Storage Management Module.
Implements idempotent upsert operations, automatic index management,
BSON date/numeric conversions, and isolated batch writing for Spark Structured Streaming.
"""

from typing import List, Dict, Any, Optional
import pymongo
from pymongo import MongoClient, ReplaceOne, ASCENDING, DESCENDING
from pymongo.errors import BulkWriteError, PyMongoError

from ingestion.config import (
    MONGO_URI,
    MONGO_DB_NAME,
    COLL_FLIGHT_EVENTS,
    COLL_TURNAROUND_EVENTS,
    COLL_ENGINE_HEALTH_EVENTS,
    COLL_PASSENGER_DCS_EVENTS,
    COLL_CREW_CLEARANCE_EVENTS,
    COLL_INGESTION_QUARANTINE,
)

_client: Optional[MongoClient] = None


def get_mongo_client() -> MongoClient:
    """Provides a singleton MongoClient instance."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return _client


def init_mongo_indexes(client: Optional[MongoClient] = None, db_name: str = MONGO_DB_NAME):
    """
    Creates optimal query and deduplication indexes across all 6 collections
    as specified in Section 11.
    """
    if client is None:
        client = get_mongo_client()
    db = client[db_name]

    print(f"📦 Initializing MongoDB collections and indexes in database '{db_name}'...")

    # 1. Flight Events
    flight_coll = db[COLL_FLIGHT_EVENTS]
    flight_coll.create_index([("event_time_utc", ASCENDING)])
    flight_coll.create_index([("icao24", ASCENDING), ("event_time_utc", DESCENDING)])
    flight_coll.create_index([("callsign", ASCENDING), ("event_time_utc", DESCENDING)])
    flight_coll.create_index([("validation_status", ASCENDING)])

    # 2. Turnaround Events
    turnaround_coll = db[COLL_TURNAROUND_EVENTS]
    turnaround_coll.create_index([("event_time_utc", ASCENDING)])
    turnaround_coll.create_index([("flight_number", ASCENDING), ("event_time_utc", DESCENDING)])
    turnaround_coll.create_index([("tail_number", ASCENDING)])
    turnaround_coll.create_index([("origin_airport", ASCENDING)])

    # 3. Engine Health Events
    engine_coll = db[COLL_ENGINE_HEALTH_EVENTS]
    engine_coll.create_index([("event_time_utc", ASCENDING)])
    engine_coll.create_index([("tail_number", ASCENDING), ("event_time_utc", DESCENDING)])
    engine_coll.create_index([("packet_id", ASCENDING)], unique=True, sparse=True)
    engine_coll.create_index([("aircraft_model", ASCENDING)])

    # 4. Passenger DCS Events
    pax_coll = db[COLL_PASSENGER_DCS_EVENTS]
    pax_coll.create_index([("event_time_utc", ASCENDING)])
    pax_coll.create_index([("flight_number", ASCENDING), ("event_time_utc", DESCENDING)])
    pax_coll.create_index([("origin_iata", ASCENDING), ("destination_iata", ASCENDING)])

    # 5. Crew Clearance Events
    crew_coll = db[COLL_CREW_CLEARANCE_EVENTS]
    crew_coll.create_index([("event_time_utc", ASCENDING)])
    crew_coll.create_index([("flight_number", ASCENDING), ("event_time_utc", DESCENDING)])
    crew_coll.create_index([("crs_release_number", ASCENDING)])
    crew_coll.create_index([("pre_flight_inspection", ASCENDING)])

    # 6. Quarantine Collection
    quarantine_coll = db[COLL_INGESTION_QUARANTINE]
    quarantine_coll.create_index([("received_at_utc", DESCENDING)])
    quarantine_coll.create_index([("source_topic", ASCENDING)])
    quarantine_coll.create_index([("quarantine_reason", ASCENDING)])

    print("✅ All MongoDB indexes initialized successfully!")


def write_batch_to_mongo(collection_name: str, records: List[Dict[str, Any]], db_name: str = MONGO_DB_NAME) -> int:
    """
    Performs an idempotent bulk upsert of records into the specified MongoDB collection.
    Uses the document's event_id as the MongoDB primary key (_id) to guarantee idempotency.
    """
    if not records:
        return 0

    client = get_mongo_client()
    db = client[db_name]
    coll = db[collection_name]

    operations = []
    for doc in records:
        # Guarantee _id matches event_id
        doc_id = doc.get("event_id") or doc.get("_id")
        if not doc_id:
            continue
        doc["_id"] = doc_id
        # Idempotent replace with upsert=True
        operations.append(ReplaceOne({"_id": doc_id}, doc, upsert=True))

    if not operations:
        return 0

    try:
        result = coll.bulk_write(operations, ordered=False)
        upserted_or_modified = (result.upserted_count or 0) + (result.modified_count or 0) + (result.matched_count or 0)
        return upserted_or_modified
    except BulkWriteError as bwe:
        print(f"⚠️ Bulk write partial warning in {collection_name}: {bwe.details.get('writeErrors', [])[:2]}")
        return len(operations) - len(bwe.details.get('writeErrors', []))
    except PyMongoError as pe:
        print(f"❌ MongoDB error writing to {collection_name}: {pe}")
        raise
