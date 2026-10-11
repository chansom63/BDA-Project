#!/usr/bin/env python3
"""
Hadoop Streaming MapReduce Mapper
Extracts airline, altitude, speed, and engine temperature from telemetry JSON.
"""

import sys
import json

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        data = json.loads(line)
        airline = data.get("airline", "Unknown Airline")
        altitude = data.get("altitudeFt", 0)
        speed = data.get("speedKnots", 0)
        temp = data.get("engineTemperature", 700)
        print(f"{airline}\t{altitude},{speed},{temp}")
    except Exception:
        continue
