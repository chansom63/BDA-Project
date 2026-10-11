#!/bin/bash
# Mapper reads JSON-like logs from stdin and extracts the route (origin -> destination)
# For simplicity, we assume comma-separated or simple text, but we can parse basic text.
while read line; do
  # Extract origin and destination from JSON (very rudimentary bash parsing)
  origin=$(echo "$line" | grep -o '"origin":"[^"]*' | cut -d'"' -f4)
  dest=$(echo "$line" | grep -o '"destination":"[^"]*' | cut -d'"' -f4)
  delay=$(echo "$line" | grep -o '"delayMinutes":[^,}]*' | cut -d':' -f2)

  if [ -n "$origin" ] && [ -n "$dest" ]; then
    delay=${delay:-0}
    echo "$origin-$dest	1,$delay"
  fi
done
