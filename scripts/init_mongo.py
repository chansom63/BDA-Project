"""
MongoDB Collections and Index Initialization Script.
Can be executed standalone to set up all 6 required collections and indexes.
"""

from ingestion.mongo_sink import init_mongo_indexes, get_mongo_client
from ingestion.config import MONGO_URI, MONGO_DB_NAME

if __name__ == "__main__":
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = get_mongo_client()
    init_mongo_indexes(client, MONGO_DB_NAME)
    print("Done!")
