#!/bin/bash
# Reducer reads key-value pairs sorted by key
current_key=""
total_count=0
total_delay=0

while read line; do
  key=$(echo "$line" | cut -f1)
  value=$(echo "$line" | cut -f2)
  count=$(echo "$value" | cut -d',' -f1)
  delay=$(echo "$value" | cut -d',' -f2)

  if [ "$key" != "$current_key" ]; then
    if [ -n "$current_key" ]; then
      echo "{\"route\":\"$current_key\", \"flightsCount\":$total_count, \"totalDelay\":$total_delay}"
    fi
    current_key="$key"
    total_count=0
    total_delay=0
  fi
  
  total_count=$((total_count + count))
  total_delay=$((total_delay + delay))
done

if [ -n "$current_key" ]; then
  echo "{\"route\":\"$current_key\", \"flightsCount\":$total_count, \"totalDelay\":$total_delay}"
fi
