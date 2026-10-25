FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir kafka-python-ng python-dotenv

COPY simulators /app/simulators
COPY ingestion /app/ingestion

ENV PYTHONPATH=/app
ENV KAFKA_BOOTSTRAP_SERVERS=kafka:29092

CMD ["python", "simulators/unified_simulator.py"]
