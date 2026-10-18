"""
Aviation reference catalog: Global airports, airlines, aircraft performance specifications,
and conversion constants based on ICAO/IATA standards.
"""

from typing import Dict, List
from .models import AirportReference, AircraftProfile

# Aviation Conversion Constants
JET_A1_DENSITY_KG_L = 0.804           # Jet A-1 fuel density: ~0.804 kg/L
CO2_KG_PER_KG_FUEL = 3.157            # ICAO standard: 3.157 kg CO2 per kg aviation fuel burned
NOX_G_PER_KG_FUEL = 14.2              # Standard cruise NOx emission index: 14.2 g/kg fuel
JET_A_PRICE_PER_KG_USD = 0.88         # Simulated commercial fuel price: $0.88/kg (~$2.70/gal)
NAUTICAL_MILE_KM = 1.852

GLOBAL_AIRPORTS: List[AirportReference] = [
    AirportReference(code="JFK", city="New York", country="USA", lat=40.6413, lon=-73.7781, timezone_offset_hrs=-5.0),
    AirportReference(code="LAX", city="Los Angeles", country="USA", lat=33.9416, lon=-118.4085, timezone_offset_hrs=-8.0),
    AirportReference(code="ORD", city="Chicago", country="USA", lat=41.9742, lon=-87.9073, timezone_offset_hrs=-6.0),
    AirportReference(code="DFW", city="Dallas", country="USA", lat=32.8998, lon=-97.0403, timezone_offset_hrs=-6.0),
    AirportReference(code="ATL", city="Atlanta", country="USA", lat=33.6407, lon=-84.4277, timezone_offset_hrs=-5.0),
    AirportReference(code="SFO", city="San Francisco", country="USA", lat=37.6213, lon=-122.3790, timezone_offset_hrs=-8.0),
    AirportReference(code="LHR", city="London", country="UK", lat=51.4700, lon=-0.4543, timezone_offset_hrs=0.0),
    AirportReference(code="CDG", city="Paris", country="France", lat=49.0097, lon=2.5479, timezone_offset_hrs=1.0),
    AirportReference(code="FRA", city="Frankfurt", country="Germany", lat=50.0379, lon=8.5622, timezone_offset_hrs=1.0),
    AirportReference(code="AMS", city="Amsterdam", country="Netherlands", lat=52.3105, lon=4.7683, timezone_offset_hrs=1.0),
    AirportReference(code="DXB", city="Dubai", country="UAE", lat=25.2532, lon=55.3657, timezone_offset_hrs=4.0),
    AirportReference(code="DOH", city="Doha", country="Qatar", lat=25.2611, lon=51.5651, timezone_offset_hrs=3.0),
    AirportReference(code="HND", city="Tokyo", country="Japan", lat=35.5494, lon=139.7798, timezone_offset_hrs=9.0),
    AirportReference(code="SIN", city="Singapore", country="Singapore", lat=1.3644, lon=103.9915, timezone_offset_hrs=8.0),
    AirportReference(code="HKG", city="Hong Kong", country="China", lat=22.3080, lon=113.9185, timezone_offset_hrs=8.0),
    AirportReference(code="SYD", city="Sydney", country="Australia", lat=-33.9399, lon=151.1753, timezone_offset_hrs=10.0),
    AirportReference(code="DEL", city="Delhi", country="India", lat=28.5562, lon=77.1000, timezone_offset_hrs=5.5),
    AirportReference(code="BOM", city="Mumbai", country="India", lat=19.0896, lon=72.8656, timezone_offset_hrs=5.5),
    AirportReference(code="BLR", city="Bangalore", country="India", lat=13.1986, lon=77.7066, timezone_offset_hrs=5.5),
    AirportReference(code="ICN", city="Seoul", country="South Korea", lat=37.4602, lon=126.4407, timezone_offset_hrs=9.0),
    AirportReference(code="YYZ", city="Toronto", country="Canada", lat=43.6777, lon=-79.6248, timezone_offset_hrs=-5.0),
    AirportReference(code="GRU", city="Sao Paulo", country="Brazil", lat=-23.4356, lon=-46.4731, timezone_offset_hrs=-3.0),
    AirportReference(code="JNB", city="Johannesburg", country="South Africa", lat=-26.1367, lon=28.2411, timezone_offset_hrs=2.0),
    AirportReference(code="IST", city="Istanbul", country="Turkey", lat=41.2753, lon=28.7519, timezone_offset_hrs=3.0),
    AirportReference(code="MAD", city="Madrid", country="Spain", lat=40.4839, lon=-3.5680, timezone_offset_hrs=1.0),
    AirportReference(code="FCO", city="Rome", country="Italy", lat=41.8003, lon=12.2389, timezone_offset_hrs=1.0),
    AirportReference(code="MUC", city="Munich", country="Germany", lat=48.3537, lon=11.7750, timezone_offset_hrs=1.0),
    AirportReference(code="ZRH", city="Zurich", country="Switzerland", lat=47.4582, lon=8.5555, timezone_offset_hrs=1.0),
    AirportReference(code="BKK", city="Bangkok", country="Thailand", lat=13.6900, lon=100.7501, timezone_offset_hrs=7.0),
    AirportReference(code="PVG", city="Shanghai", country="China", lat=31.1443, lon=121.8083, timezone_offset_hrs=8.0),
]

AIRPORT_LOOKUP: Dict[str, AirportReference] = {a.code: a for a in GLOBAL_AIRPORTS}

AIRLINES_CATALOG = [
    {"name": "American Airlines", "code": "AAL", "country": "USA", "hub": "DFW"},
    {"name": "Delta Air Lines", "code": "DAL", "country": "USA", "hub": "ATL"},
    {"name": "United Airlines", "code": "UAL", "country": "USA", "hub": "ORD"},
    {"name": "British Airways", "code": "BAW", "country": "UK", "hub": "LHR"},
    {"name": "Lufthansa", "code": "DLH", "country": "Germany", "hub": "FRA"},
    {"name": "Air France", "code": "AFR", "country": "France", "hub": "CDG"},
    {"name": "Emirates", "code": "UAE", "country": "UAE", "hub": "DXB"},
    {"name": "Qatar Airways", "code": "QTR", "country": "Qatar", "hub": "DOH"},
    {"name": "Singapore Airlines", "code": "SIA", "country": "Singapore", "hub": "SIN"},
    {"name": "Air India", "code": "AIC", "country": "India", "hub": "DEL"},
    {"name": "All Nippon Airways", "code": "ANA", "country": "Japan", "hub": "HND"},
    {"name": "Cathay Pacific", "code": "CPA", "country": "Hong Kong", "hub": "HKG"},
    {"name": "Qantas", "code": "QFA", "country": "Australia", "hub": "SYD"},
    {"name": "KLM Royal Dutch", "code": "KLM", "country": "Netherlands", "hub": "AMS"},
    {"name": "Turkish Airlines", "code": "THY", "country": "Turkey", "hub": "IST"},
]

AIRCRAFT_PROFILES: Dict[str, AircraftProfile] = {
    "Airbus A320neo": AircraftProfile(
        aircraft_type="Airbus A320neo", manufacturer="Airbus", engine_model="CFM LEAP-1A",
        max_range_km=6300, cruise_speed_knots=450, cruise_altitude_ft=36000,
        fuel_burn_cruise_kgh=2150.0, seat_capacity=180,
        first_class_seats=0, business_class_seats=12, premium_economy_seats=24, economy_seats=144,
        mtow_kg=79000
    ),
    "Airbus A321neo": AircraftProfile(
        aircraft_type="Airbus A321neo", manufacturer="Airbus", engine_model="Pratt & Whitney PW1100G",
        max_range_km=7400, cruise_speed_knots=455, cruise_altitude_ft=35000,
        fuel_burn_cruise_kgh=2400.0, seat_capacity=220,
        first_class_seats=0, business_class_seats=16, premium_economy_seats=32, economy_seats=172,
        mtow_kg=97000
    ),
    "Boeing 737-800": AircraftProfile(
        aircraft_type="Boeing 737-800", manufacturer="Boeing", engine_model="CFM56-7B",
        max_range_km=5436, cruise_speed_knots=453, cruise_altitude_ft=35000,
        fuel_burn_cruise_kgh=2500.0, seat_capacity=162,
        first_class_seats=0, business_class_seats=16, premium_economy_seats=24, economy_seats=122,
        mtow_kg=79010
    ),
    "Boeing 737 MAX 8": AircraftProfile(
        aircraft_type="Boeing 737 MAX 8", manufacturer="Boeing", engine_model="CFM LEAP-1B",
        max_range_km=6570, cruise_speed_knots=453, cruise_altitude_ft=37000,
        fuel_burn_cruise_kgh=2180.0, seat_capacity=178,
        first_class_seats=0, business_class_seats=16, premium_economy_seats=28, economy_seats=134,
        mtow_kg=82190
    ),
    "Boeing 777-300ER": AircraftProfile(
        aircraft_type="Boeing 777-300ER", manufacturer="Boeing", engine_model="GE90-115B",
        max_range_km=13650, cruise_speed_knots=490, cruise_altitude_ft=37000,
        fuel_burn_cruise_kgh=6850.0, seat_capacity=365,
        first_class_seats=8, business_class_seats=52, premium_economy_seats=48, economy_seats=257,
        mtow_kg=351534
    ),
    "Boeing 787-9 Dreamliner": AircraftProfile(
        aircraft_type="Boeing 787-9 Dreamliner", manufacturer="Boeing", engine_model="GEnx-1B",
        max_range_km=14140, cruise_speed_knots=488, cruise_altitude_ft=39000,
        fuel_burn_cruise_kgh=4900.0, seat_capacity=290,
        first_class_seats=0, business_class_seats=42, premium_economy_seats=36, economy_seats=212,
        mtow_kg=254000
    ),
    "Airbus A350-900": AircraftProfile(
        aircraft_type="Airbus A350-900", manufacturer="Airbus", engine_model="Rolls-Royce Trent XWB",
        max_range_km=15000, cruise_speed_knots=488, cruise_altitude_ft=39000,
        fuel_burn_cruise_kgh=5100.0, seat_capacity=325,
        first_class_seats=0, business_class_seats=48, premium_economy_seats=36, economy_seats=241,
        mtow_kg=280000
    ),
    "Airbus A380-800": AircraftProfile(
        aircraft_type="Airbus A380-800", manufacturer="Airbus", engine_model="Engine Alliance GP7200",
        max_range_km=14800, cruise_speed_knots=490, cruise_altitude_ft=38000,
        fuel_burn_cruise_kgh=11400.0, seat_capacity=516,
        first_class_seats=14, business_class_seats=76, premium_economy_seats=56, economy_seats=370,
        mtow_kg=575000
    ),
}
