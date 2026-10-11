#!/usr/bin/env bash
set -e

INPUT_PATH=${1:-"/flight-telemetry/processed"}
OUTPUT_PATH=${2:-"/flight-telemetry/analytics/mapreduce_summary_$(date +%s)"}

echo "============================================================"
echo "🚀 Submitting Hadoop MapReduce Streaming Batch Job to YARN"
echo "📂 Input Path:  ${INPUT_PATH}"
echo "📂 Output Path: ${OUTPUT_PATH}"
echo "============================================================"

# Find hadoop streaming jar inside hadoop installation
STREAMING_JAR=$(find / -name "hadoop-streaming*.jar" ! -name "*-sources.jar" ! -name "*-test*.jar" 2>/dev/null | head -n 1)
if [ -z "$STREAMING_JAR" ]; then
    STREAMING_JAR="/opt/hadoop-3.2.1/share/hadoop/tools/lib/hadoop-streaming-3.2.1.jar"
fi

echo "📦 Using Streaming Jar: ${STREAMING_JAR}"

# Run streaming job on YARN with container memory bounds & combined splits
yarn jar "${STREAMING_JAR}" \
    -D yarn.app.mapreduce.am.resource.mb=512 \
    -D yarn.app.mapreduce.am.command-opts=-Xmx384m \
    -D mapreduce.map.memory.mb=512 \
    -D mapreduce.map.java.opts=-Xmx384m \
    -D mapreduce.reduce.memory.mb=512 \
    -D mapreduce.reduce.java.opts=-Xmx384m \
    -D mapreduce.jobhistory.address=historyserver:10020 \
    -D mapreduce.jobhistory.webapp.address=historyserver:8188 \
    -D mapreduce.job.reduces=1 \
    -D mapreduce.input.fileinputformat.split.maxsize=67108864 \
    -files /opt/hadoop/mapreduce/mapper.pl,/opt/hadoop/mapreduce/reducer.pl \
    -mapper "perl mapper.pl" \
    -reducer "perl reducer.pl" \
    -inputformat org.apache.hadoop.mapred.lib.CombineTextInputFormat \
    -input "${INPUT_PATH}" \
    -output "${OUTPUT_PATH}"

echo "✅ MapReduce job completed successfully on YARN!"
echo "📄 Displaying Output Results from HDFS:"
hdfs dfs -cat "${OUTPUT_PATH}/part-*" | head -n 30
