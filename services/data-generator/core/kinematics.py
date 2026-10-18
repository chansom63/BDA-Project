"""
Aeronautical Kinematics & Physical Flight Phase Simulation.
Calculates spherical spherical great-circle coordinates, realistic climb/cruise/descent profiles,
instantaneous fuel burn, CO2 emissions, and sensor anomaly injections with ground truth.
"""

import math
from typing import Tuple, Dict, Any
from .catalog import CO2_KG_PER_KG_FUEL, NAUTICAL_MILE_KM


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate Great Circle distance in kilometers between two points."""
    r = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate initial compass bearing (0-360 deg) from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


def intermediate_point(lat1: float, lon1: float, lat2: float, lon2: float, f: float) -> Tuple[float, float]:
    """
    Calculate intermediate lat/lon along great circle path at fraction f (0.0 to 1.0).
    Using spherical trigonometry interpolation.
    """
    f = max(0.0, min(1.0, f))
    if f <= 0.0001:
        return lat1, lon1
    if f >= 0.9999:
        return lat2, lon2

    phi1, lambda1 = math.radians(lat1), math.radians(lon1)
    phi2, lambda2 = math.radians(lat2), math.radians(lon2)

    delta_phi = phi2 - phi1
    delta_lambda = lambda2 - lambda1
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    d = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    if d < 1e-9:
        return lat1, lon1

    sin_d = math.sin(d)
    a_coef = math.sin((1.0 - f) * d) / sin_d
    b_coef = math.sin(f * d) / sin_d

    x = a_coef * math.cos(phi1) * math.cos(lambda1) + b_coef * math.cos(phi2) * math.cos(lambda2)
    y = a_coef * math.cos(phi1) * math.sin(lambda1) + b_coef * math.cos(phi2) * math.sin(lambda2)
    z = a_coef * math.sin(phi1) + b_coef * math.sin(phi2)

    phi_i = math.atan2(z, math.sqrt(x * x + y * y))
    lambda_i = math.atan2(y, x)

    return math.degrees(phi_i), math.degrees(lambda_i)


def compute_flight_kinematics(
    fraction: float,
    cruise_alt_ft: int,
    cruise_speed_kts: float,
    base_fuel_burn_kgh: float,
    anomaly_type: str = "NORMAL",
    noise_factor: float = 0.0
) -> Dict[str, Any]:
    """
    Determine flight phase, altitude, groundspeed, vertical rate, engine temperature,
    fuel flow, vibration, emissions, and anomaly characteristics at flight progress fraction.
    """
    f = max(0.0, min(1.0, fraction))

    # Phase boundaries based on flight fraction
    if f < 0.03:
        phase = "TAXI_OUT"
        alt = 50 + int(noise_factor * 20)
        speed = 20 + int(noise_factor * 5)
        vrate = 0
        fuel_flow = base_fuel_burn_kgh * 0.15
        egt = 580 + int(noise_factor * 10)
        vibe = 0.8 + noise_factor * 0.1
    elif f < 0.08:
        phase = "TAKEOFF"
        p = (f - 0.03) / 0.05
        alt = int(50 + p * 2500)
        speed = int(140 + p * 110)
        vrate = 2200 + int(noise_factor * 200)
        fuel_flow = base_fuel_burn_kgh * 1.55
        egt = 820 + int(noise_factor * 15)
        vibe = 1.9 + noise_factor * 0.2
    elif f < 0.25:
        phase = "CLIMB"
        p = (f - 0.08) / 0.17
        alt = int(2550 + p * (cruise_alt_ft - 2550))
        speed = int(250 + p * (cruise_speed_kts - 250))
        vrate = 1800 - int(p * 800) + int(noise_factor * 100)
        fuel_flow = base_fuel_burn_kgh * (1.35 - p * 0.25)
        egt = 780 + int(noise_factor * 12)
        vibe = 1.4 + noise_factor * 0.15
    elif f < 0.80:
        phase = "CRUISE"
        alt = cruise_alt_ft + int(noise_factor * 150)
        speed = int(cruise_speed_kts + noise_factor * 10)
        vrate = int(noise_factor * 50)
        fuel_flow = base_fuel_burn_kgh * (0.95 + noise_factor * 0.05)
        egt = 710 + int(noise_factor * 15)
        vibe = 1.1 + noise_factor * 0.12
    elif f < 0.93:
        phase = "DESCENT"
        p = (f - 0.80) / 0.13
        alt = int(cruise_alt_ft - p * (cruise_alt_ft - 3000))
        speed = int(cruise_speed_kts - p * (cruise_speed_kts - 210))
        vrate = -1800 - int(noise_factor * 150)
        fuel_flow = base_fuel_burn_kgh * 0.35
        egt = 610 + int(noise_factor * 12)
        vibe = 1.2 + noise_factor * 0.14
    elif f < 0.98:
        phase = "APPROACH"
        p = (f - 0.93) / 0.05
        alt = int(3000 - p * 2800)
        speed = int(210 - p * 70)
        vrate = -750 + int(noise_factor * 80)
        fuel_flow = base_fuel_burn_kgh * 0.50
        egt = 640 + int(noise_factor * 10)
        vibe = 1.3 + noise_factor * 0.15
    else:
        phase = "LANDING"
        alt = 50
        speed = 25
        vrate = 0
        fuel_flow = base_fuel_burn_kgh * 0.15
        egt = 570 + int(noise_factor * 8)
        vibe = 0.9 + noise_factor * 0.1

    # Default values
    squawk = "1200"
    label = "NORMAL"
    sensor_quality = 1.0 - abs(noise_factor) * 0.05

    # Anomaly Injections with ground truth
    if anomaly_type == "ENGINE_OVERHEAT":
        egt = max(egt, 925 + int(noise_factor * 30))
        label = "ENGINE_OVERHEAT"
    elif anomaly_type == "HIGH_VIBRATION":
        vibe = 5.2 + noise_factor * 0.5
        label = "HIGH_VIBRATION"
    elif anomaly_type == "FUEL_DIVERGENCE":
        fuel_flow = fuel_flow * 1.45
        label = "FUEL_DIVERGENCE"
    elif anomaly_type == "EMERGENCY_SQUAWK":
        squawk = "7700"
        label = "EMERGENCY_SQUAWK"
    elif anomaly_type == "RAPID_DESCENT":
        vrate = -3200 + int(noise_factor * 200)
        label = "RAPID_DESCENT"

    # CO2 emission calculation in kg/s
    co2_rate_kgs = (fuel_flow / 3600.0) * CO2_KG_PER_KG_FUEL

    return {
        "flight_phase": phase,
        "altitude_ft": max(0, alt),
        "speed_knots": max(0, speed),
        "vertical_rate_fpm": vrate,
        "engine_temperature": egt,
        "fuel_flow_kgh": max(50.0, fuel_flow),
        "vibration_mm_s": max(0.1, vibe),
        "co2_emission_rate_kgs": max(0.01, co2_rate_kgs),
        "squawk": squawk,
        "sensor_quality": max(0.1, min(1.0, sensor_quality)),
        "anomaly_label": label,
    }
