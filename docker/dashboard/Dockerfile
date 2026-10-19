FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    streamlit==1.42.0 \
    pandas \
    numpy \
    plotly \
    pymongo \
    streamlit-autorefresh \
    python-dotenv

COPY dashboard /app/dashboard
COPY ingestion /app/ingestion

EXPOSE 8501

ENV PYTHONPATH=/app
ENV MONGO_URI=mongodb://mongodb:27017
ENV MONGO_DB_NAME=flight_analytics

CMD ["streamlit", "run", "dashboard/app.py", "--server.port=8501", "--server.address=0.0.0.0", "--server.headless=true"]
