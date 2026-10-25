"""
Pytest configuration and shared fixtures for PySpark and sample test events.
"""

import os
import json
import pytest
from pyspark.sql import SparkSession


@pytest.fixture(scope="session")
def spark():
    """Provides a lightweight shared local SparkSession for tests."""
    spark_session = (
        SparkSession.builder
        .appName("FlightIngestionUnitTests")
        .master("local[2]")
        .config("spark.ui.enabled", "false")
        .config("spark.driver.memory", "512m")
        .config("spark.sql.shuffle.partitions", "2")
        .getOrCreate()
    )
    spark_session.sparkContext.setLogLevel("ERROR")
    yield spark_session
    spark_session.stop()


@pytest.fixture
def sample_flight_data():
    with open("samples/flight_events_sample.json", "r") as f:
        return json.load(f)


@pytest.fixture
def sample_turnaround_data():
    with open("samples/turnaround_events_sample.json", "r") as f:
        return json.load(f)


@pytest.fixture
def sample_engine_data():
    with open("samples/engine_acars_events_sample.json", "r") as f:
        return json.load(f)


@pytest.fixture
def sample_passenger_data():
    with open("samples/passenger_dcs_events_sample.json", "r") as f:
        return json.load(f)


@pytest.fixture
def sample_crew_data():
    with open("samples/crew_clearance_events_sample.json", "r") as f:
        return json.load(f)
