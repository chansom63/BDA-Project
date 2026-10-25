"""
Pipeline Configuration Module
Reads environment variables with sensible defaults for Apache Kafka, Spark, and MongoDB.
"""

import os
from typing import List
from dotenv import load_dotenv

# Load optional .env file
load_dotenv()

# --- Kafka Configuration ---
KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

TOPIC_FLIGHT_EVENTS: str = os.getenv("TOPIC_FLIGHT_EVENTS", "flight-events")
TOPIC_TURNAROUND_EVENTS: str = os.getenv("TOPIC_TURNAROUND_EVENTS", "acdm-turnaround-events")
TOPIC_ENGINE_ACARS_EVENTS: str = os.getenv("TOPIC_ENGINE_ACARS_EVENTS", "engine-acars-events")
TOPIC_PASSENGER_DCS_EVENTS: str = os.getenv("TOPIC_PASSENGER_DCS_EVENTS", "passenger-dcs-events")
TOPIC_CREW_CLEARANCE_EVENTS: str = os.getenv("TOPIC_CREW_CLEARANCE_EVENTS", "crew-clearance-events")

ALL_KAFKA_TOPICS: List[str] = [
    TOPIC_FLIGHT_EVENTS,
    TOPIC_TURNAROUND_EVENTS,
    TOPIC_ENGINE_ACARS_EVENTS,
    TOPIC_PASSENGER_DCS_EVENTS,
    TOPIC_CREW_CLEARANCE_EVENTS,
]

# --- MongoDB Configuration ---
MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "flight_analytics")

COLL_FLIGHT_EVENTS: str = os.getenv("COLL_FLIGHT_EVENTS", "flight_events")
COLL_TURNAROUND_EVENTS: str = os.getenv("COLL_TURNAROUND_EVENTS", "turnaround_events")
COLL_ENGINE_HEALTH_EVENTS: str = os.getenv("COLL_ENGINE_HEALTH_EVENTS", "engine_health_events")
COLL_PASSENGER_DCS_EVENTS: str = os.getenv("COLL_PASSENGER_DCS_EVENTS", "passenger_dcs_events")
COLL_CREW_CLEARANCE_EVENTS: str = os.getenv("COLL_CREW_CLEARANCE_EVENTS", "crew_clearance_events")
COLL_INGESTION_QUARANTINE: str = os.getenv("COLL_INGESTION_QUARANTINE", "ingestion_quarantine")

# Map topics to collections
TOPIC_TO_COLLECTION = {
    TOPIC_FLIGHT_EVENTS: COLL_FLIGHT_EVENTS,
    TOPIC_TURNAROUND_EVENTS: COLL_TURNAROUND_EVENTS,
    TOPIC_ENGINE_ACARS_EVENTS: COLL_ENGINE_HEALTH_EVENTS,
    TOPIC_PASSENGER_DCS_EVENTS: COLL_PASSENGER_DCS_EVENTS,
    TOPIC_CREW_CLEARANCE_EVENTS: COLL_CREW_CLEARANCE_EVENTS,
}

# --- Spark Configuration ---
SPARK_APP_NAME: str = os.getenv("SPARK_APP_NAME", "RealTimeFlightDataIngestion")
SPARK_MASTER: str = os.getenv("SPARK_MASTER", "local[*]")
CHECKPOINT_DIR: str = os.getenv("CHECKPOINT_DIR", "/tmp/spark-checkpoints/flight-ingestion")
WATERMARK_DELAY: str = os.getenv("WATERMARK_DELAY", "10 minutes")
STREAMING_TRIGGER_PROCESSING_TIME: str = os.getenv("STREAMING_TRIGGER_PROCESSING_TIME", "5 seconds")

# --- Pipeline Constants ---
SCHEMA_VERSION: str = "1.0.0"
