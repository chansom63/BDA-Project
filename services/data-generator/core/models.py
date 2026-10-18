"""
Core Data Models for High-Volume Airline Analytics & Telemetry Platform.
Defines schemas for Telemetry, Schedules, Bookings, Financials, Weather, and Maintenance.
Designed with slots=True for minimal memory overhead and high serialization performance.
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
import json


@dataclass(slots=True)
class AirportReference:
    code: str
    city: str
    country: str
    lat: float
    lon: float
    timezone_offset_hrs: float = 0.0


@dataclass(slots=True)
class AircraftProfile:
    aircraft_type: str
    manufacturer: str
    engine_model: str
    max_range_km: float
    cruise_speed_knots: float
    cruise_altitude_ft: int
    fuel_burn_cruise_kgh: float
    seat_capacity: int
    first_class_seats: int
    business_class_seats: int
    premium_economy_seats: int
    economy_seats: int
    mtow_kg: float


@dataclass(slots=True)
class TelemetryEvent:
    event_id: str
    timestamp: str  # YYYY-MM-DD HH:MM:SS
    flight_id: str
    callsign: str
    airline: str
    aircraft_type: str
    aircraft_registration: str
    latitude: float
    longitude: float
    altitude_ft: int
    speed_knots: int
    heading_deg: int
    vertical_rate_fpm: int
    squawk: str
    flight_phase: str  # TAXI_OUT, TAKEOFF, CLIMB, CRUISE, DESCENT, APPROACH, LANDING, TAXI_IN
    engine_temperature: int  # °C
    fuel_flow_kgh: float     # kg/h
    vibration_mm_s: float    # mm/s
    co2_emission_rate_kgs: float  # kg/s
    sensor_quality: float    # 0.0 - 1.0 (quality indicator)
    anomaly_label: str       # NORMAL, ENGINE_OVERHEAT, HIGH_VIBRATION, FUEL_DIVERGENCE, EMERGENCY_SQUAWK, RAPID_DESCENT
    route: str
    origin: str
    destination: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "eventId": self.event_id,
            "timestamp": self.timestamp,
            "flightId": self.flight_id,
            "callsign": self.callsign,
            "airline": self.airline,
            "aircraftType": self.aircraft_type,
            "aircraftRegistration": self.aircraft_registration,
            "latitude": round(self.latitude, 5),
            "longitude": round(self.longitude, 5),
            "altitudeFt": self.altitude_ft,
            "speedKnots": self.speed_knots,
            "headingDeg": self.heading_deg,
            "verticalRateFpm": self.vertical_rate_fpm,
            "squawk": self.squawk,
            "flightPhase": self.flight_phase,
            "engineTemperature": self.engine_temperature,
            "fuelFlowKgh": round(self.fuel_flow_kgh, 2),
            "vibrationMmS": round(self.vibration_mm_s, 2),
            "co2EmissionRateKgs": round(self.co2_emission_rate_kgs, 4),
            "sensorQuality": round(self.sensor_quality, 2),
            "anomalyLabel": self.anomaly_label,
            "route": self.route,
            "origin": self.origin,
            "destination": self.destination,
        }

    def to_tsv(self) -> str:
        return (
            f"{self.event_id}\t{self.timestamp}\t{self.flight_id}\t{self.callsign}\t{self.airline}\t"
            f"{self.aircraft_type}\t{self.aircraft_registration}\t{self.latitude:.5f}\t{self.longitude:.5f}\t"
            f"{self.altitude_ft}\t{self.speed_knots}\t{self.heading_deg}\t{self.vertical_rate_fpm}\t{self.squawk}\t"
            f"{self.flight_phase}\t{self.engine_temperature}\t{self.fuel_flow_kgh:.2f}\t{self.vibration_mm_s:.2f}\t"
            f"{self.co2_emission_rate_kgs:.4f}\t{self.sensor_quality:.2f}\t{self.anomaly_label}\t{self.route}\t"
            f"{self.origin}\t{self.destination}\n"
        )


@dataclass(slots=True)
class FlightSchedule:
    flight_id: str
    callsign: str
    airline: str
    origin: str
    destination: str
    scheduled_departure: str
    actual_departure: str
    scheduled_arrival: str
    actual_arrival: str
    status: str  # SCHEDULED, BOARDING, DEPARTED, AIRBORNE, LANDED, ARRIVED, CANCELLED, DIVERTED
    route_distance_km: float
    aircraft_type: str
    aircraft_registration: str
    departure_delay_minutes: int
    arrival_delay_minutes: int
    weather_condition: str
    cancellation_reason: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "flightId": self.flight_id,
            "callsign": self.callsign,
            "airline": self.airline,
            "origin": self.origin,
            "destination": self.destination,
            "scheduledDeparture": self.scheduled_departure,
            "actualDeparture": self.actual_departure,
            "scheduledArrival": self.scheduled_arrival,
            "actualArrival": self.actual_arrival,
            "status": self.status,
            "routeDistanceKm": round(self.route_distance_km, 1),
            "aircraftType": self.aircraft_type,
            "aircraftRegistration": self.aircraft_registration,
            "departureDelayMinutes": self.departure_delay_minutes,
            "arrivalDelayMinutes": self.arrival_delay_minutes,
            "weatherCondition": self.weather_condition,
            "cancellationReason": self.cancellation_reason,
        }

    def to_tsv(self) -> str:
        return (
            f"{self.flight_id}\t{self.callsign}\t{self.airline}\t{self.origin}\t{self.destination}\t"
            f"{self.scheduled_departure}\t{self.actual_departure}\t{self.scheduled_arrival}\t{self.actual_arrival}\t"
            f"{self.status}\t{self.route_distance_km:.1f}\t{self.aircraft_type}\t{self.aircraft_registration}\t"
            f"{self.departure_delay_minutes}\t{self.arrival_delay_minutes}\t{self.weather_condition}\t{self.cancellation_reason}\n"
        )


@dataclass(slots=True)
class PassengerBooking:
    booking_id: str
    flight_id: str
    cabin_class: str  # First, Business, Premium Economy, Economy
    booked_seats: int
    check_in_count: int
    boarded_count: int
    no_show_count: int
    cancelled_count: int
    ticket_revenue_usd: float
    ancillary_revenue_usd: float
    booking_timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bookingId": self.booking_id,
            "flightId": self.flight_id,
            "cabinClass": self.cabin_class,
            "bookedSeats": self.booked_seats,
            "checkInCount": self.check_in_count,
            "boardedCount": self.boarded_count,
            "noShowCount": self.no_show_count,
            "cancelledCount": self.cancelled_count,
            "ticketRevenueUsd": round(self.ticket_revenue_usd, 2),
            "ancillaryRevenueUsd": round(self.ancillary_revenue_usd, 2),
            "bookingTimestamp": self.booking_timestamp,
        }

    def to_tsv(self) -> str:
        return (
            f"{self.booking_id}\t{self.flight_id}\t{self.cabin_class}\t{self.booked_seats}\t"
            f"{self.check_in_count}\t{self.boarded_count}\t{self.no_show_count}\t{self.cancelled_count}\t"
            f"{self.ticket_revenue_usd:.2f}\t{self.ancillary_revenue_usd:.2f}\t{self.booking_timestamp}\n"
        )


@dataclass(slots=True)
class FinancialRecord:
    transaction_id: str
    flight_id: str
    airline: str
    route: str
    timestamp: str
    ticket_revenue: float
    ancillary_revenue: float
    cargo_revenue: float
    fuel_cost: float
    airport_fees: float
    navigation_charges: float
    crew_cost: float
    maintenance_cost: float
    total_revenue: float
    total_operating_cost: float
    operating_profit: float
    operating_margin_pct: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "transactionId": self.transaction_id,
            "flightId": self.flight_id,
            "airline": self.airline,
            "route": self.route,
            "timestamp": self.timestamp,
            "ticketRevenue": round(self.ticket_revenue, 2),
            "ancillaryRevenue": round(self.ancillary_revenue, 2),
            "cargoRevenue": round(self.cargo_revenue, 2),
            "fuelCost": round(self.fuel_cost, 2),
            "airportFees": round(self.airport_fees, 2),
            "navigationCharges": round(self.navigation_charges, 2),
            "crewCost": round(self.crew_cost, 2),
            "maintenanceCost": round(self.maintenance_cost, 2),
            "totalRevenue": round(self.total_revenue, 2),
            "totalOperatingCost": round(self.total_operating_cost, 2),
            "operatingProfit": round(self.operating_profit, 2),
            "operatingMarginPct": round(self.operating_margin_pct, 2),
        }

    def to_tsv(self) -> str:
        return (
            f"{self.transaction_id}\t{self.flight_id}\t{self.airline}\t{self.route}\t{self.timestamp}\t"
            f"{self.ticket_revenue:.2f}\t{self.ancillary_revenue:.2f}\t{self.cargo_revenue:.2f}\t"
            f"{self.fuel_cost:.2f}\t{self.airport_fees:.2f}\t{self.navigation_charges:.2f}\t"
            f"{self.crew_cost:.2f}\t{self.maintenance_cost:.2f}\t{self.total_revenue:.2f}\t"
            f"{self.total_operating_cost:.2f}\t{self.operating_profit:.2f}\t{self.operating_margin_pct:.2f}\n"
        )


@dataclass(slots=True)
class WeatherObservation:
    observation_id: str
    airport_code: str
    timestamp: str
    temperature_c: float
    wind_speed_kts: float
    wind_direction_deg: int
    visibility_km: float
    precipitation_mm: float
    condition_category: str  # VFR, MVFR, IFR, CONVECTIVE, SNOW_ICE
    weather_delay_risk: str  # LOW, MODERATE, HIGH, SEVERE

    def to_dict(self) -> Dict[str, Any]:
        return {
            "observationId": self.observation_id,
            "airportCode": self.airport_code,
            "timestamp": self.timestamp,
            "temperatureC": round(self.temperature_c, 1),
            "windSpeedKts": round(self.wind_speed_kts, 1),
            "windDirectionDeg": self.wind_direction_deg,
            "visibilityKm": round(self.visibility_km, 1),
            "precipitationMm": round(self.precipitation_mm, 1),
            "conditionCategory": self.condition_category,
            "weatherDelayRisk": self.weather_delay_risk,
        }

    def to_tsv(self) -> str:
        return (
            f"{self.observation_id}\t{self.airport_code}\t{self.timestamp}\t{self.temperature_c:.1f}\t"
            f"{self.wind_speed_kts:.1f}\t{self.wind_direction_deg}\t{self.visibility_km:.1f}\t"
            f"{self.precipitation_mm:.1f}\t{self.condition_category}\t{self.weather_delay_risk}\n"
        )


@dataclass(slots=True)
class FleetMaintenanceRecord:
    maintenance_id: str
    aircraft_registration: str
    aircraft_type: str
    airline: str
    timestamp: str
    flight_hours_total: float
    flight_cycles_total: int
    engine_vibration_avg: float
    last_maintenance_date: str
    next_scheduled_check: str  # CHECK_A, CHECK_B, CHECK_C, CHECK_D
    component_status: str      # OPTIMAL, SERVICED, MONITOR_REQUIRED, CRITICAL
    maintenance_downtime_hours: float
    maintenance_cost_usd: float
    failure_risk_score: float  # 0.0 - 1.0 (calibrated statistical score)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "maintenanceId": self.maintenance_id,
            "aircraftRegistration": self.aircraft_registration,
            "aircraftType": self.aircraft_type,
            "airline": self.airline,
            "timestamp": self.timestamp,
            "flightHoursTotal": round(self.flight_hours_total, 1),
            "flightCyclesTotal": self.flight_cycles_total,
            "engineVibrationAvg": round(self.engine_vibration_avg, 2),
            "lastMaintenanceDate": self.last_maintenance_date,
            "nextScheduledCheck": self.next_scheduled_check,
            "componentStatus": self.component_status,
            "maintenanceDowntimeHours": round(self.maintenance_downtime_hours, 1),
            "maintenanceCostUsd": round(self.maintenance_cost_usd, 2),
            "failureRiskScore": round(self.failure_risk_score, 4),
        }

    def to_tsv(self) -> str:
        return (
            f"{self.maintenance_id}\t{self.aircraft_registration}\t{self.aircraft_type}\t{self.airline}\t"
            f"{self.timestamp}\t{self.flight_hours_total:.1f}\t{self.flight_cycles_total}\t"
            f"{self.engine_vibration_avg:.2f}\t{self.last_maintenance_date}\t{self.next_scheduled_check}\t"
            f"{self.component_status}\t{self.maintenance_downtime_hours:.1f}\t{self.maintenance_cost_usd:.2f}\t"
            f"{self.failure_risk_score:.4f}\n"
        )
