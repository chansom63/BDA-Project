FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY services/data-generator/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY services/data-generator /app/services/data-generator

WORKDIR /app/services/data-generator

ENV PYTHONUNBUFFERED=1

CMD ["python", "live_simulator.py", "--brokers", "kafka:29092", "--rate", "5000"]
