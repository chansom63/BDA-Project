# Monolithic MERN Architecture on AWS (Data Analytics Project)
## Real-Time Flight Telemetry & Tracking System

An end-to-end, high-performance **Real-Time Flight Telemetry & Tracking System** built using a single deployable **Monolithic MERN Application** (MongoDB/DocumentDB, Express.js, React, Node.js) integrated with simulated **AWS Data Analytics Cloud Pipeline** (Amazon MSK Kafka, Kinesis Data Analytics, S3 Data Lake, AWS Glue ETL, Amazon Redshift Data Warehouse, Amazon SES, Amazon SNS, and Amazon QuickSight BI dashboards).

---

## 🌟 Key Features

1. **Interactive Flight Radar Map (React + Leaflet)**:
   - Live moving aircraft markers automatically rotated to match ground heading angle (`headingDeg`).
   - Altitude-coded color schemes (FL380+ Purple, FL300-370 Cyan, FL200-290 Green, FL100-190 Amber, Emergency Crimson).
   - Dynamic polyline trajectories displaying historical flight paths.
   - Animated radar sweep overlay & emergency clearance radius circles.
2. **Flight Telemetry HUD Inspector (FlightDrawer)**:
   - Real-time altitude, ground speed (knots), vertical rate (fpm), heading, lat/lon coordinates, and route progress bar.
   - Emergency squawk controls (Declare MAYDAY 7700, Radio Loss 7600, Hijack 7500).
3. **Airspace Alert & Proximity Rule Engine**:
   - Automated haversine proximity breach detection (< 10 NM lateral & < 1,000 ft vertical separation).
   - Real-time WebSocket alerts & incident acknowledgement workflow.
   - Simulated **Amazon SES (Email)** and **Amazon SNS (SMS/Push)** dispatch logs.
4. **AWS Data Analytics Pipeline Architecture Visualizer**:
   - Live interactive visual flow matching the system architecture diagram.
   - Metrics display for Amazon MSK, Kinesis, DocumentDB, S3 Raw Data Lake partitions (`year=YYYY/month=MM/day=DD`), AWS Glue ETL Catalog, and Amazon Redshift DW.
   - Manual **Trigger AWS Glue Batch ETL** action button.
5. **Amazon QuickSight BI Analytics Dashboards (Recharts)**:
   - Hourly flight volume & telemetry stream density area charts.
   - Altitude band distribution pie/donut charts.
   - Top international air corridor performance & on-time % bar charts.
   - Flight delay factor analysis.
6. **Admin Panel & RBAC User Management**:
   - System threshold tuning (Proximity distance limit, simulation speed 1x to 10x).
   - Seeded RBAC accounts (`Admin`, `Analyst`, `Dispatcher`, `Viewer`).

---

## 🏗️ System Architecture Overview

```
[ CLIENTS ] (React Single-Page App)
    ├── Web Dashboard (Live Radar Map, Flight List, HUD)
    ├── Mobile Web (PWA)
    ├── Admin Panel (RBAC, Threshold Settings)
    └── QuickSight BI Dashboards (Historical Analytics)
            │
            ▼ (HTTP / WebSockets)
[ AWS ENTRY LAYER ]
    ├── Amazon Route 53 (DNS)
    ├── Amazon CloudFront (CDN)
    └── AWS Application Load Balancer
            │
            ▼
[ MONOLITHIC MERN APPLICATION ] (Deployed on AWS EC2)
    ├── Node.js + Express.js Runtime (REST API + WebSocket Server)
    ├── Telemetry Ingestion (Amazon MSK / Kafka Stream Consumer)
    ├── Flight Tracking & State Engine
    ├── Alert & Proximity Rule Engine
    ├── Notification Service (Amazon SES Email & Amazon SNS SMS)
    ├── Background Jobs (node-cron for Analytics Rollups & Glue Scheduling)
            │
            ▼
[ AWS DATA ANALYTICS LAYER ]
    ├── Real-Time Ingestion: Amazon MSK (Kafka)
    ├── Stream Processing: Amazon Kinesis Data Analytics
    ├── Operational DB: Amazon DocumentDB / MongoDB
    ├── Historical Data Lake: Amazon S3 (YYYY/MM/DD Partitions)
    ├── Batch Processing: AWS Glue ETL & Catalog
    └── Analytics DW: Amazon Redshift (OLAP Database)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ or v24+)
- npm (v9+)

### Installation & Launching

1. **Install All Dependencies**:
   ```bash
   npm run install-all
   ```

2. **Start Monolithic Application (Server + Client)**:
   ```bash
   npm run dev
   ```
   Or start the backend server directly:
   ```bash
   npm start
   ```

3. **Access Application Interfaces**:
   - **Monolithic Web Application**: `http://localhost:5000`
   - **WebSocket Telemetry Stream**: `ws://localhost:5000/ws/telemetry`
   - **REST API Health Check**: `http://localhost:5000/api/health`

---

## 🔑 Default RBAC Credentials

| Role | Username | Password | Email |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | `admin@flightops.aws` |
| **Analyst** | `analyst` | `admin123` | `analyst@flightops.aws` |
| **Dispatcher** | `dispatcher` | `admin123` | `dispatcher@flightops.aws` |

---

## 📁 Repository Structure

```
Project/
├── package.json                   # Root orchestrator
├── README.md                      # Project documentation
├── scripts/
│   └── start-dev.js               # Concurrent dev process runner
├── server/                        # Express + Node.js Monolithic Engine
│   ├── index.js                   # Server entry point & WebSocket attachment
│   ├── config/
│   │   ├── db.js                  # MongoDB / Mongo Memory Server connection
│   │   └── awsConfig.js           # AWS Data Analytics pipeline settings
│   ├── models/                    # Mongoose Data Schemas (Flight, Alert, User, etc.)
│   ├── services/                  # ADSB Simulator, Kinesis Processor, S3 Data Lake, Glue ETL, Redshift DW
│   ├── routes/                    # REST API endpoints (/api/flights, /api/alerts, /api/analytics, etc.)
│   └── middleware/                # JWT Authentication & RBAC middleware
└── client/                        # React + Vite Frontend
    ├── src/
    │   ├── App.jsx                # Main layout & tab routing
    │   ├── index.css              # Dark aviation glassmorphism design system
    │   ├── components/            # MapView, FlightDrawer, FlightList, AlertCenter, AwsPipelineVisualizer, etc.
    │   ├── context/               # SocketContext (WS telemetry) & AuthContext
    │   └── utils/                 # Geo & altitude formatting helpers
```
