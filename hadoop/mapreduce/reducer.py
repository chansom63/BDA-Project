#!/usr/bin/env python3
"""
Hadoop Streaming MapReduce Reducer
Aggregates telemetry records per airline (record count, avg altitude, max speed, avg temp).
"""

import sys

current_airline = None
count = 0
total_altitude = 0
max_speed = 0
total_temp = 0
max_temp = 0

print("Airline\tTotalEvents\tAvgAltitudeFt\tMaxSpeedKnots\tAvgEngineTempC\tMaxEngineTempC")

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        airline, metrics = line.split("\t", 1)
        alt, spd, tmp = [float(x) for x in metrics.split(",")]
    except ValueError:
        continue

    if current_airline == airline:
        count += 1
        total_altitude += alt
        max_speed = max(max_speed, spd)
        total_temp += tmp
        max_temp = max(max_temp, tmp)
    else:
        if current_airline:
            avg_alt = round(total_altitude / count, 1)
            avg_tmp = round(total_temp / count, 1)
            print(f"{current_airline}\t{count}\t{avg_alt}\t{max_speed}\t{avg_tmp}\t{max_temp}")
        current_airline = airline
        count = 1
        total_altitude = alt
        max_speed = spd
        total_temp = tmp
        max_temp = tmp

if current_airline and count > 0:
    avg_alt = round(total_altitude / count, 1)
    avg_tmp = round(total_temp / count, 1)
    print(f"{current_airline}\t{count}\t{avg_alt}\t{max_speed}\t{avg_tmp}\t{max_temp}")
