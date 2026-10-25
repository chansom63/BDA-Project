"""
Streamlit Real-Time Centralized Analytics Dashboard.
Features 20+ rich interactive Plotly and Streamlit visualizations querying live MongoDB
operational collections: flight telemetry radar, A-CDM turnarounds, engine diagnostics,
passenger boarding analytics, crew clearance, and ingestion data quality.
"""

import os
import time
from datetime import datetime, timezone
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pymongo import MongoClient
import pymongo
from streamlit_autorefresh import st_autorefresh

# --- Configuration ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "flight_analytics")

st.set_page_config(
    page_title="FlightOps Global Operations Cockpit",
    page_icon="✈️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Dark Theme CSS
st.markdown("""
<style>
    .main { background-color: #0b0f19; }
    .stMetric {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid #334155;
        padding: 12px 18px;
        border-radius: 10px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    .live-pulse {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        background-color: #064e3b;
        color: #34d399;
        font-weight: 700;
        font-size: 0.85rem;
        border: 1px solid #059669;
    }
</style>
""", unsafe_allow_html=True)


@st.cache_resource
def get_db():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    return client[MONGO_DB_NAME]


def load_collection_data(coll_name: str, limit: int = 500):
    try:
        db = get_db()
        coll = db[coll_name]
        data = list(coll.find().sort("event_time_utc", pymongo.DESCENDING).limit(limit))
        return data
    except Exception as e:
        st.warning(f"Unable to query collection '{coll_name}': {e}")
        return []


def get_collection_counts():
    try:
        db = get_db()
        return {coll: db[coll].count_documents({}) for coll in db.list_collection_names()}
    except Exception:
        return {}


# --- Sidebar ---
st.sidebar.title("✈️ FlightOps Cockpit")
st.sidebar.markdown(f"**Cluster DB:** `{MONGO_DB_NAME}`")

# Auto-Refresh Control
refresh_sec = st.sidebar.slider("⏱️ Refresh Interval (seconds)", min_value=1, max_value=10, value=3, step=1)
auto_refresh_enabled = st.sidebar.checkbox("Continuous Auto-Refresh", value=True)

if auto_refresh_enabled:
    refresh_counter = st_autorefresh(interval=refresh_sec * 1000, limit=None, key="flightops_refresh_counter")

now_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
st.sidebar.markdown(f"<div class='live-pulse'>● LIVE STREAMING</div><br/><small>Updated: <code>{now_str}</code></small>", unsafe_allow_html=True)

view = st.sidebar.radio(
    "Analytics Navigation",
    [
        "🎛️ Executive Operations Overview",
        "🌐 Real-Time Flight Radar & Telemetry",
        "⏱️ A-CDM Airport Turnaround Operations",
        "⚙️ Engine ACARS & Predictive Maintenance",
        "👥 Passenger DCS & Boarding Analytics",
        "📋 Cockpit Crew Duty & MRO Technical Clearance",
        "🚨 Ingestion Data Quality & Quarantine Monitor",
    ]
)

counts = get_collection_counts()

# ==============================================================================
# VIEW 1: EXECUTIVE OPERATIONS OVERVIEW
# ==============================================================================
if view == "🎛️ Executive Operations Overview":
    st.title("🎛️ Real-Time Global Flight Operations Cockpit")
    st.markdown("Distributed streaming pipeline: **Simulators → Kafka → Spark Structured Streaming → MongoDB → Streamlit**")

    # Global KPI Row
    total_docs = sum(counts.values())
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric("Total Events Ingested", f"{total_docs:,}")
    c2.metric("Flight Telemetry", f"{counts.get('flight_events', 0):,}")
    c3.metric("A-CDM Turnarounds", f"{counts.get('turnaround_events', 0):,}")
    c4.metric("Engine Health Logs", f"{counts.get('engine_health_events', 0):,}")
    c5.metric("Passenger DCS Feeds", f"{counts.get('passenger_dcs_events', 0):,}")
    c6.metric("Quarantined Packets", counts.get("ingestion_quarantine", 0), delta_color="inverse")

    st.markdown("---")

    flight_records = load_collection_data("flight_events", limit=200)
    turnaround_records = load_collection_data("turnaround_events", limit=150)
    engine_records = load_collection_data("engine_health_events", limit=150)
    pax_records = load_collection_data("passenger_dcs_events", limit=150)

    # Row 1: Flight Radar Map & Altitude vs Velocity Scatter
    col_map, col_scatter = st.columns([1.2, 1])

    with col_map:
        st.subheader("🗺️ Live Geographic Aircraft Radar (OpenSky ADS-B)")
        if flight_records:
            f_df = pd.DataFrame(flight_records)
            if "latitude" in f_df and "longitude" in f_df:
                map_df = f_df.dropna(subset=["latitude", "longitude"]).drop_duplicates("callsign")
                fig_map = px.scatter_geo(
                    map_df,
                    lat="latitude",
                    lon="longitude",
                    hover_name="callsign",
                    color="baro_altitude",
                    size="velocity",
                    color_continuous_scale="Turbo",
                    projection="natural earth",
                    title="Active Flights Position & Altitude Envelope",
                )
                fig_map.update_geos(
                    center=dict(lat=21.0, lon=78.0),
                    lataxis_range=[6, 38],
                    lonaxis_range=[66, 98],
                    showcountries=True,
                    countrycolor="#475569",
                    showocean=True,
                    oceancolor="#0f172a",
                    landcolor="#1e293b",
                    showlakes=False,
                )
                fig_map.update_layout(template="plotly_dark", height=420, margin=dict(l=0, r=0, t=30, b=0))
                st.plotly_chart(fig_map, width='stretch')
        else:
            st.info("Awaiting telemetry stream...")

    with col_scatter:
        st.subheader("🛫 Fleet Flight Envelope (Altitude vs Ground Speed)")
        if flight_records:
            f_df = pd.DataFrame(flight_records).dropna(subset=["velocity", "baro_altitude"])
            fig_env = px.scatter(
                f_df,
                x="velocity",
                y="baro_altitude",
                color="squawk",
                hover_data=["callsign", "icao24"],
                labels={"velocity": "Velocity (m/s)", "baro_altitude": "Baro Altitude (m)", "squawk": "Transponder"},
                title="Altitude vs Speed Distribution by Squawk Code",
                color_discrete_map={"7000": "#3b82f6", "7700": "#ef4444", "7600": "#f59e0b", "2000": "#10b981", "1200": "#8b5cf6"},
            )
            fig_env.update_layout(template="plotly_dark", height=420, margin=dict(l=20, r=20, t=30, b=20))
            st.plotly_chart(fig_env, width='stretch')

    # Row 2: Turnarounds & Delay Causes
    st.markdown("---")
    col_tbt, col_delay = st.columns([1, 1])

    with col_tbt:
        st.subheader("⏱️ A-CDM TOBT Schedule Variance by Airport")
        if turnaround_records:
            t_df = pd.DataFrame(turnaround_records).dropna(subset=["origin_airport", "tobt_variance_minutes"])
            fig_tbt = px.box(
                t_df,
                x="origin_airport",
                y="tobt_variance_minutes",
                color="origin_airport",
                points="all",
                title="Target Off-Block Time (TOBT) Variance Distribution (Minutes)",
                labels={"origin_airport": "Station", "tobt_variance_minutes": "Variance (Min)"},
            )
            fig_tbt.update_layout(template="plotly_dark", height=350, showlegend=False)
            st.plotly_chart(fig_tbt, width='stretch')

    with col_delay:
        st.subheader("🍩 IATA Root Cause Delay Distribution")
        if turnaround_records:
            t_df = pd.DataFrame(turnaround_records)
            delay_labels = {
                "00": "On-Time / No Delay",
                "35": "Weather / Atmospheric",
                "41": "Baggage / Ramp Hold",
                "89": "ATC Restriction",
                "93": "Reactionary / Late Inbound",
                "11": "Passenger & Baggage Check-in",
            }
            if "iata_delay_code" in t_df:
                delay_counts = t_df["iata_delay_code"].map(delay_labels).fillna("Other").value_counts().reset_index()
                delay_counts.columns = ["Reason", "Count"]
                fig_donut = px.pie(
                    delay_counts,
                    names="Reason",
                    values="Count",
                    hole=0.45,
                    title="Departure Delay Breakdown by IATA Classification",
                    color_discrete_sequence=px.colors.sequential.RdBu,
                )
                fig_donut.update_layout(template="plotly_dark", height=350)
                st.plotly_chart(fig_donut, width='stretch')

    # Row 3: Engine RUL & Passenger Load
    st.markdown("---")
    col_eng, col_pax = st.columns([1, 1])

    with col_eng:
        st.subheader("⚙️ Fleet Engine Remaining Useful Life (RUL Cycles)")
        if engine_records:
            rul_data = []
            for r in engine_records:
                rul_data.append({
                    "Tail": r.get("tail_number"),
                    "Model": r.get("aircraft_model"),
                    "Engine 1": (r.get("engine_1") or {}).get("remaining_useful_life_cycles", 0),
                    "Engine 2": (r.get("engine_2") or {}).get("remaining_useful_life_cycles", 0),
                })
            rul_df = pd.DataFrame(rul_data).drop_duplicates("Tail")
            fig_rul = px.bar(
                rul_df,
                x="Tail",
                y=["Engine 1", "Engine 2"],
                barmode="group",
                title="Twin-Engine Remaining Useful Life Cycles (Warning threshold < 1,000)",
                labels={"value": "RUL Cycles", "variable": "Engine"},
                color_discrete_sequence=["#10b981", "#6366f1"],
            )
            fig_rul.add_hline(y=1000, line_dash="dash", line_color="#ef4444", annotation_text="Maintenance Limit")
            fig_rul.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_rul, width='stretch')

    with col_pax:
        st.subheader("👥 Passenger Load Factor & DigiYatra Biometric Adoption")
        if pax_records:
            p_df = pd.DataFrame(pax_records).dropna(subset=["flight_number", "computed_load_factor_pct", "digiyatra_adoption_pct"])
            p_summary = p_df.groupby("flight_number")[["computed_load_factor_pct", "digiyatra_adoption_pct"]].mean().reset_index()
            fig_pax = px.bar(
                p_summary,
                x="flight_number",
                y=["computed_load_factor_pct", "digiyatra_adoption_pct"],
                barmode="group",
                title="Load Factor % vs DigiYatra Biometric Boarding Adoption %",
                labels={"value": "Percentage (%)", "variable": "Metric"},
                color_discrete_sequence=["#f59e0b", "#10b981"],
            )
            fig_pax.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_pax, width='stretch')


# ==============================================================================
# VIEW 2: REAL-TIME FLIGHT RADAR & TELEMETRY
# ==============================================================================
elif view == "🌐 Real-Time Flight Radar & Telemetry":
    st.title("🌐 Real-Time Flight Radar & Telemetry Analytics (ADS-B)")
    records = load_collection_data("flight_events", limit=400)

    if records:
        df = pd.DataFrame(records)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Active Aircraft Monitored", len(df["icao24"].unique()))
        c2.metric("Mean Fleet Altitude", f"{round(df['baro_altitude'].mean(), 1)} m")
        c3.metric("Mean Ground Speed", f"{round(df['velocity'].mean(), 1)} m/s")
        squawk_alerts = len(df[df["squawk"].isin(["7700", "7600"])])
        c4.metric("Special Squawk Alerts", squawk_alerts, delta="Emergency/Fail" if squawk_alerts > 0 else "Normal", delta_color="inverse")

        st.markdown("---")
        t_col1, t_col2 = st.columns(2)

        with t_col1:
            st.subheader("📊 Fleet Altitude Distribution Profile")
            fig_alt = px.histogram(
                df,
                x="baro_altitude",
                nbins=30,
                color="on_ground",
                title="Barometric Altitude Distribution (Airborne vs On-Ground)",
                labels={"baro_altitude": "Altitude (meters)", "on_ground": "On Ground"},
                color_discrete_map={True: "#ef4444", False: "#3b82f6"},
            )
            fig_alt.update_layout(template="plotly_dark", height=340)
            st.plotly_chart(fig_alt, width='stretch')

        with t_col2:
            st.subheader("🧭 Aircraft True Track Heading Polar Distribution")
            fig_track = px.histogram(
                df,
                x="true_track",
                nbins=24,
                title="Flight Heading Angle Frequency (0° to 360°)",
                labels={"true_track": "Track Heading (°)"},
                color_discrete_sequence=["#8b5cf6"],
            )
            fig_track.update_layout(template="plotly_dark", height=340)
            st.plotly_chart(fig_track, width='stretch')

        st.markdown("---")
        v_col1, v_col2 = st.columns(2)

        with v_col1:
            st.subheader("⚡ Vertical Rate Climb & Descent (m/s)")
            fig_vrate = px.box(
                df,
                y="vertical_rate",
                title="Vertical Speed Rate Distribution (-Climb / +Descent)",
                labels={"vertical_rate": "Vertical Rate (m/s)"},
                color_discrete_sequence=["#06b6d4"],
            )
            fig_vrate.update_layout(template="plotly_dark", height=340)
            st.plotly_chart(fig_vrate, width='stretch')

        with v_col2:
            st.subheader("🚨 Transponder Squawk Distribution")
            fig_sqk = px.pie(
                df,
                names="squawk",
                title="Squawk Codes (7000 Standard, 7700 Emergency, 7600 Comms)",
                color_discrete_sequence=px.colors.qualitative.Pastel,
            )
            fig_sqk.update_layout(template="plotly_dark", height=340)
            st.plotly_chart(fig_sqk, width='stretch')

        st.subheader("Live Telemetry Data Grid")
        st.dataframe(df[["callsign", "icao24", "latitude", "longitude", "baro_altitude", "velocity", "true_track", "vertical_rate", "squawk", "event_time_utc"]], use_container_width=True)
    else:
        st.info("No flight telemetry data available.")


# ==============================================================================
# VIEW 3: A-CDM AIRPORT TURNAROUND OPERATIONS
# ==============================================================================
elif view == "⏱️ A-CDM Airport Turnaround Operations":
    st.title("⏱️ Airport Collaborative Decision Making (A-CDM) Operations")
    records = load_collection_data("turnaround_events", limit=400)

    if records:
        df = pd.DataFrame(records)
        c1, c2, c3 = st.columns(3)
        c1.metric("Turnarounds Monitored", len(df))
        c2.metric("Mean TOBT Variance", f"{round(df['tobt_variance_minutes'].mean(), 1)} min")
        c3.metric("Avg Turnaround Progress", f"{round(df['turnaround_progress_pct'].mean(), 1)}%")

        st.markdown("---")
        col_box, col_bar = st.columns(2)

        with col_box:
            st.subheader("📊 TOBT Variance by Station (Minutes)")
            fig_tobt = px.bar(
                df.groupby("origin_airport")["tobt_variance_minutes"].mean().reset_index(),
                x="origin_airport",
                y="tobt_variance_minutes",
                title="Average TOBT Schedule Variance by Departure Station",
                color="tobt_variance_minutes",
                color_continuous_scale="Reds",
            )
            fig_tobt.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_tobt, width='stretch')

        with col_bar:
            st.subheader("🧩 Ramp Services Progress Breakdown")
            ramp_list = []
            for r in records:
                rs = r.get("ramp_services", {}) or {}
                ramp_list.append({
                    "Deboarding": 100 if rs.get("deboarding_completed") else 0,
                    "Cleaning": 100 if rs.get("cleaning_completed") else 0,
                    "Catering": 100 if rs.get("catering_completed") else 0,
                    "Fueling": 100 if rs.get("fueling_completed") else 0,
                    "Baggage Pct": rs.get("baggage_loading_pct", 0),
                    "Boarding Pct": rs.get("boarding_pct", 0),
                })
            ramp_df = pd.DataFrame(ramp_list).mean().reset_index()
            ramp_df.columns = ["Service", "Completion Rate %"]
            fig_ramp = px.bar(
                ramp_df,
                x="Service",
                y="Completion Rate %",
                color="Completion Rate %",
                color_continuous_scale="Blues",
                title="Average Ramp Milestones Completion %",
            )
            fig_ramp.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_ramp, width='stretch')

        st.markdown("---")
        f_col1, f_col2 = st.columns(2)

        with f_col1:
            st.subheader("⛽ Fuel Uplift Distribution (Liters)")
            fuel_uplifts = [r.get("ramp_services", {}).get("fueling_liters_uplifted") for r in records if r.get("ramp_services", {}).get("fueling_liters_uplifted")]
            fig_fuel = px.histogram(
                x=fuel_uplifts,
                nbins=25,
                title="Distribution of Uplifted Fuel (Liters) Across Turnarounds",
                labels={"x": "Fuel Uplifted (Liters)"},
                color_discrete_sequence=["#10b981"],
            )
            fig_fuel.update_layout(template="plotly_dark", height=340)
            st.plotly_chart(fig_fuel, width='stretch')

        with f_col2:
            st.subheader("📈 Overall Turnaround Progress Distribution")
            fig_prog = px.histogram(
                df,
                x="turnaround_progress_pct",
                nbins=20,
                title="Turnaround Completion Percentages (%)",
                color_discrete_sequence=["#f59e0b"],
            )
            fig_prog.update_layout(template="plotly_dark", height=340)
            st.plotly_chart(fig_prog, width='stretch')

        st.subheader("Turnaround Milestones Audit Table")
        st.dataframe(df[["flight_number", "tail_number", "origin_airport", "stand_gate", "milestone_sobt", "milestone_tobt", "tobt_variance_minutes", "turnaround_progress_pct", "iata_delay_code"]], use_container_width=True)
    else:
        st.info("No turnaround events found.")


# ==============================================================================
# VIEW 4: ENGINE ACARS & PREDICTIVE MAINTENANCE
# ==============================================================================
elif view == "⚙️ Engine ACARS & Predictive Maintenance":
    st.title("⚙️ Engine FADEC/ACARS Telemetry & Predictive Maintenance")
    records = load_collection_data("engine_health_events", limit=400)

    if records:
        rows = []
        for r in records:
            e1 = r.get("engine_1", {}) or {}
            e2 = r.get("engine_2", {}) or {}
            rows.append({
                "packet_id": r.get("packet_id"),
                "tail_number": r.get("tail_number"),
                "aircraft_model": r.get("aircraft_model"),
                "engine_model": r.get("engine_model"),
                "eng1_egt_c": e1.get("egt_margin_c"),
                "eng1_vib1": e1.get("vibration_n1"),
                "eng1_vib2": e1.get("vibration_n2"),
                "eng1_oil_psi": e1.get("oil_pressure_psi"),
                "eng1_oil_c": e1.get("oil_temperature_c"),
                "eng1_sfc": e1.get("sfc_drift_pct"),
                "eng1_rul": e1.get("remaining_useful_life_cycles"),
                "eng2_egt_c": e2.get("egt_margin_c"),
                "eng2_vib1": e2.get("vibration_n1"),
                "eng2_vib2": e2.get("vibration_n2"),
                "eng2_oil_psi": e2.get("oil_pressure_psi"),
                "eng2_oil_c": e2.get("oil_temperature_c"),
                "eng2_sfc": e2.get("sfc_drift_pct"),
                "eng2_rul": e2.get("remaining_useful_life_cycles"),
                "apu_hours": r.get("apu_hours"),
                "apu_bleed": r.get("apu_bleed_status"),
                "event_time_utc": r.get("event_time_utc"),
            })
        eng_df = pd.DataFrame(rows)

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Active Engines", len(eng_df) * 2)
        c2.metric("Min Fleet RUL", f"{min(eng_df['eng1_rul'].min(), eng_df['eng2_rul'].min())} cycles")
        c3.metric("Avg Oil Temp", f"{round(eng_df['eng1_oil_c'].mean(), 1)} °C")
        c4.metric("Avg EGT Margin", f"{round(eng_df['eng1_egt_c'].mean(), 1)} °C")

        st.markdown("---")
        col_egt, col_vib = st.columns(2)

        with col_egt:
            st.subheader("🌡️ EGT Margin vs Oil Temperature Correlation")
            fig_scatter = px.scatter(
                eng_df,
                x="eng1_oil_c",
                y="eng1_egt_c",
                color="engine_model",
                hover_data=["tail_number", "aircraft_model"],
                title="Engine 1: Oil Temperature (°C) vs EGT Margin (°C)",
                labels={"eng1_oil_c": "Oil Temperature (°C)", "eng1_egt_c": "EGT Margin (°C)"},
            )
            fig_scatter.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_scatter, width='stretch')

        with col_vib:
            st.subheader("📳 Spool Vibration Analysis (N1 vs N2)")
            fig_vib = px.scatter(
                eng_df,
                x="eng1_vib1",
                y="eng1_vib2",
                color="aircraft_model",
                title="N1 Spool vs N2 Spool Vibration (Severity zones)",
                labels={"eng1_vib1": "N1 Vibration", "eng1_vib2": "N2 Vibration"},
            )
            fig_vib.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_vib, width='stretch')

        st.markdown("---")
        col_sfc, col_apu = st.columns(2)

        with col_sfc:
            st.subheader("⛽ Specific Fuel Consumption (SFC) Drift %")
            fig_sfc = px.box(
                eng_df,
                x="engine_model",
                y="eng1_sfc",
                color="engine_model",
                title="SFC Drift Percentage Distribution by Engine Family",
                labels={"eng1_sfc": "SFC Drift %"},
            )
            fig_sfc.update_layout(template="plotly_dark", height=350, showlegend=False)
            st.plotly_chart(fig_sfc, width='stretch')

        with col_apu:
            st.subheader("⏱️ Auxiliary Power Unit (APU) Operating Hours")
            fig_apu = px.histogram(
                eng_df,
                x="apu_hours",
                color="apu_bleed",
                title="APU Cumulative Flight Hours and Bleed Air Status",
                labels={"apu_hours": "APU Hours", "apu_bleed": "Bleed Status"},
                color_discrete_map={"NORMAL": "#10b981", "DEGRADED": "#ef4444"},
            )
            fig_apu.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_apu, width='stretch')

        st.subheader("Critical Engine RUL Watchlist (Lowest Remaining Cycles)")
        st.dataframe(eng_df.sort_values("eng1_rul")[["tail_number", "aircraft_model", "engine_model", "eng1_rul", "eng2_rul", "eng1_egt_c", "eng1_oil_psi", "apu_hours"]].head(25), use_container_width=True)
    else:
        st.info("No engine ACARS diagnostic records available.")


# ==============================================================================
# VIEW 5: PASSENGER DCS & BOARDING ANALYTICS
# ==============================================================================
elif view == "👥 Passenger DCS & Boarding Analytics":
    st.title("👥 Departure Control System (DCS) & Load Factor Analytics")
    records = load_collection_data("passenger_dcs_events", limit=400)

    if records:
        df = pd.DataFrame(records)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Flights Tracked", len(df["flight_number"].unique()))
        c2.metric("Total Boarded", f"{int(df['boarded_passengers'].sum()):,}")
        c3.metric("Avg Load Factor", f"{round(df['computed_load_factor_pct'].mean(), 1)}%")
        c4.metric("Avg DigiYatra Adoption", f"{round(df['digiyatra_adoption_pct'].mean(), 1)}%")

        st.markdown("---")
        col_class, col_ssr = st.columns(2)

        with col_class:
            st.subheader("💺 Cabin Class Boarding Split")
            class_data = []
            for r in records:
                cs = r.get("class_split", {}) or {}
                class_data.append({
                    "SpicePlus": cs.get("spiceplus_boarded", 0),
                    "SpiceFlex": cs.get("spiceflex_boarded", 0),
                    "Economy": cs.get("economy_boarded", 0),
                })
            cs_df = pd.DataFrame(class_data).sum().reset_index()
            cs_df.columns = ["Class", "Boarded Passengers"]
            fig_cs = px.pie(
                cs_df,
                names="Class",
                values="Boarded Passengers",
                title="Overall Cabin Class Passenger Distribution",
                color_discrete_sequence=["#6366f1", "#3b82f6", "#94a3b8"],
                hole=0.4,
            )
            fig_cs.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_cs, width='stretch')

        with col_ssr:
            st.subheader("♿ Special Service Requests (SSR)")
            ssr_data = []
            for r in records:
                ssr = r.get("special_service_requests", {}) or {}
                ssr_data.append({
                    "Wheelchair (WCHR)": ssr.get("wchr_wheelchair", 0),
                    "Infants": ssr.get("infants_onboard", 0),
                    "Pre-ordered Meals": ssr.get("preordered_meals", 0),
                })
            ssr_df = pd.DataFrame(ssr_data).sum().reset_index()
            ssr_df.columns = ["Request Type", "Count"]
            fig_ssr = px.bar(
                ssr_df,
                x="Request Type",
                y="Count",
                color="Request Type",
                title="Special Service Requests Across Operating Fleet",
                color_discrete_sequence=["#f59e0b", "#ec4899", "#10b981"],
            )
            fig_ssr.update_layout(template="plotly_dark", height=350, showlegend=False)
            st.plotly_chart(fig_ssr, width='stretch')

        st.markdown("---")
        col_rt, col_dy = st.columns(2)

        with col_rt:
            st.subheader("🛫 Route Load Factor Distribution")
            df["route"] = df["origin_iata"] + " ➔ " + df["destination_iata"]
            fig_route = px.bar(
                df.groupby("route")["computed_load_factor_pct"].mean().reset_index(),
                x="route",
                y="computed_load_factor_pct",
                color="computed_load_factor_pct",
                title="Average Load Factor % by Operating Sector",
                color_continuous_scale="Viridis",
            )
            fig_route.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_route, width='stretch')

        with col_dy:
            st.subheader("📱 DigiYatra Biometric Adoption % by Station")
            fig_dy = px.box(
                df,
                x="origin_iata",
                y="digiyatra_adoption_pct",
                color="origin_iata",
                title="DigiYatra Biometric Gate Adoption % by Origin Hub",
                labels={"origin_iata": "Hub Airport", "digiyatra_adoption_pct": "Adoption %"},
            )
            fig_dy.update_layout(template="plotly_dark", height=350, showlegend=False)
            st.plotly_chart(fig_dy, width='stretch')

        st.subheader("Passenger Boarding Manifest Log")
        st.dataframe(df[["flight_number", "tail_number", "origin_iata", "destination_iata", "total_seating_capacity", "booked_passengers", "boarded_passengers", "computed_load_factor_pct", "digiyatra_adoption_pct"]], use_container_width=True)
    else:
        st.info("No passenger DCS records available.")


# ==============================================================================
# VIEW 6: COCKPIT CREW DUTY & MRO TECHNICAL CLEARANCE
# ==============================================================================
elif view == "📋 Cockpit Crew Duty & MRO Technical Clearance":
    st.title("📋 Aircraft Maintenance Release (CRS) & Cockpit Crew Duty (FDTL)")
    records = load_collection_data("crew_clearance_events", limit=400)

    if records:
        rows = []
        for r in records:
            fdtl = r.get("cockpit_crew_fdtl", {}) or {}
            rows.append({
                "flight_number": r.get("flight_number"),
                "tail_number": r.get("tail_number"),
                "origin_iata": r.get("origin_iata"),
                "crs_release_number": r.get("crs_release_number"),
                "certifying_ame_license": r.get("certifying_ame_license"),
                "pre_flight_inspection": r.get("pre_flight_inspection"),
                "engine_oil_uplift_qts": r.get("engine_oil_uplift_qts"),
                "logbook_signed": r.get("tlb_technical_logbook_signed"),
                "captain_hours_28d": fdtl.get("captain_hours_28d"),
                "fo_hours_28d": fdtl.get("first_officer_hours_28d"),
                "rest_compliant": fdtl.get("mandatory_rest_compliant"),
                "fdp_valid": fdtl.get("fdp_within_limits"),
                "event_time_utc": r.get("event_time_utc"),
            })
        crew_df = pd.DataFrame(rows)

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Clearances Tracked", len(crew_df))
        pass_rate = round((len(crew_df[crew_df['pre_flight_inspection'] == 'PASSED']) / len(crew_df)) * 100, 1)
        c2.metric("Pre-flight Pass Rate", f"{pass_rate}%")
        c3.metric("Avg Captain 28d Hours", f"{round(crew_df['captain_hours_28d'].mean(), 1)} h")
        c4.metric("Avg FO 28d Hours", f"{round(crew_df['fo_hours_28d'].mean(), 1)} h")

        st.markdown("---")
        col_insp, col_hrs = st.columns(2)

        with col_insp:
            st.subheader("🛡️ Pre-Flight Technical Inspection Outcome")
            fig_insp = px.pie(
                crew_df,
                names="pre_flight_inspection",
                title="Inspection Results (PASSED vs PENDING vs FAILED)",
                color="pre_flight_inspection",
                color_discrete_map={"PASSED": "#10b981", "PENDING": "#f59e0b", "FAILED": "#ef4444"},
                hole=0.45,
            )
            fig_insp.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_insp, width='stretch')

        with col_hrs:
            st.subheader("👨‍✈️ 28-Day Duty Flight Hours Distribution")
            fig_duty = px.histogram(
                crew_df,
                x=["captain_hours_28d", "fo_hours_28d"],
                barmode="overlay",
                title="Captain vs First Officer 28-Day Cumulative Duty Hours (Max 100h)",
                labels={"value": "Hours in 28 Days", "variable": "Role"},
                color_discrete_sequence=["#3b82f6", "#a855f7"],
            )
            fig_duty.add_vline(x=85, line_dash="dash", line_color="#ef4444", annotation_text="Duty Cap Warning")
            fig_duty.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_duty, width='stretch')

        st.markdown("---")
        col_oil, col_sta = st.columns(2)

        with col_oil:
            st.subheader("🛢️ Pre-Flight Engine Oil Uplift (Quarts)")
            fig_oil = px.box(
                crew_df,
                y="engine_oil_uplift_qts",
                color="pre_flight_inspection",
                title="Engine Oil Replenished (Quarts) by Clearance Status",
                labels={"engine_oil_uplift_qts": "Oil Uplift (Qts)"},
            )
            fig_oil.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_oil, width='stretch')

        with col_sta:
            st.subheader("📍 Release Certificates by Origin Station")
            fig_sta = px.histogram(
                crew_df,
                x="origin_iata",
                color="pre_flight_inspection",
                title="Certificates of Release to Service (CRS) Issued by Station",
                color_discrete_map={"PASSED": "#10b981", "PENDING": "#f59e0b", "FAILED": "#ef4444"},
            )
            fig_sta.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_sta, width='stretch')

        st.subheader("Technical Logbook & CRS Release Registry")
        st.dataframe(crew_df[["flight_number", "tail_number", "origin_iata", "crs_release_number", "certifying_ame_license", "pre_flight_inspection", "logbook_signed", "captain_hours_28d", "fo_hours_28d", "rest_compliant"]], use_container_width=True)
    else:
        st.info("No crew clearance records available.")


# ==============================================================================
# VIEW 7: INGESTION DATA QUALITY & QUARANTINE MONITOR
# ==============================================================================
elif view == "🚨 Ingestion Data Quality & Quarantine Monitor":
    st.title("🚨 Ingestion Data Quality & Quarantine Audit Monitor")
    q_records = load_collection_data("ingestion_quarantine", limit=200)

    c1, c2, c3 = st.columns(3)
    c1.metric("Quarantined Packets", len(q_records), delta_color="inverse")
    c2.metric("Total Processed Collections", len(counts))
    c3.metric("Data Quality Reliability", f"{round((1 - (len(q_records) / max(1, sum(counts.values())))) * 100, 2)}%")

    st.markdown("---")
    col_q1, col_q2 = st.columns(2)

    if q_records:
        q_df = pd.DataFrame(q_records)
        with col_q1:
            st.subheader("🚨 Quarantine Incidents by Ingestion Topic")
            fig_qtop = px.pie(
                q_df,
                names="source_topic",
                title="Quarantined Records by Producing Kafka Topic",
                color_discrete_sequence=px.colors.sequential.Sunset,
            )
            fig_qtop.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_qtop, width='stretch')

        with col_q2:
            st.subheader("🔍 Breakdown of Data Quality Violations")
            fig_qreas = px.bar(
                q_df["quarantine_reason"].value_counts().reset_index(),
                x="count",
                y="quarantine_reason",
                orientation="h",
                title="Quarantine Diagnostic Reasons & Parse Failures",
                labels={"count": "Violations", "quarantine_reason": "Reason"},
                color="count",
                color_continuous_scale="Reds",
            )
            fig_qreas.update_layout(template="plotly_dark", height=350)
            st.plotly_chart(fig_qreas, width='stretch')

        st.subheader("Live Quarantine Event Audit Log")
        st.dataframe(q_df[["source_topic", "quarantine_reason", "received_at_utc", "kafka_topic", "kafka_partition", "kafka_offset", "raw_payload"]], use_container_width=True)
    else:
        st.success("🎉 All ingested Kafka messages are passing schema validation!")
