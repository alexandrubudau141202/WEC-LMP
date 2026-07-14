"""
WEC LMP Diagnostic Assistant - Stint Simulator
===============================================

Generates synthetic stint telemetry (CSV, same schema as the files in
telemetry/) for a chosen track, car and setup.

Each track's lap-1 rows from telemetry/<track>.csv act as the speed-profile
template; the simulator perturbs that template with the setup (wing drag vs
downforce, brake bias, tire pressures), the conditions (fuel load, track
temp) and stint evolution (fuel burn, tire warm-up and degradation, noise),
then emits one CSV row per template sample per lap.

The lap-time model mirrors the frontend's laptimeModel.js: quadratic
penalties around track-dependent optima. It predicts trends, not reality.

Author: Alexandru
"""

import csv
import io
import math
import random
from pathlib import Path

from models import Setup, TrackConditions, CarClass

TELEMETRY_DIR = Path(__file__).parent.parent / "telemetry"

# Track metadata; the id must match the CSV filename in telemetry/.
TRACKS: dict[str, dict] = {
    "monza":     {"name": "Monza",                       "country": "Italy",   "length_km": 5.793,  "track_type": "high_speed"},
    "spa":       {"name": "Spa-Francorchamps",           "country": "Belgium", "length_km": 7.004,  "track_type": "high_speed"},
    "le_mans":   {"name": "Circuit de la Sarthe",        "country": "France",  "length_km": 13.626, "track_type": "high_speed"},
    "cota":      {"name": "Circuit of the Americas",     "country": "USA",     "length_km": 5.513,  "track_type": "technical"},
    "fuji":      {"name": "Fuji Speedway",               "country": "Japan",   "length_km": 4.563,  "track_type": "mixed"},
    "sao_paulo": {"name": "Interlagos (São Paulo)",      "country": "Brazil",  "length_km": 4.309,  "track_type": "mixed"},
}

# Pace/top-speed scaling relative to the template files (hypercar-level pace)
CLASS_PACE_FACTOR = {"hypercar": 1.0, "lmp2": 1.045, "gt3": 1.13}
CLASS_SPEED_FACTOR = {"hypercar": 1.0, "lmp2": 0.96, "gt3": 0.86}
CLASS_FUEL_BURN_KG_LAP = {"hypercar": 1.8, "lmp2": 1.5, "gt3": 2.0}

# Optimal combined wing (front + rear, deg) per track character — mirrors
# laptimeModel.js so the on-screen prediction and the simulation agree.
WING_TARGET = {"high_speed": 18, "mixed": 23, "technical": 28}

CSV_HEADER = [
    "Lap", "Distance", "Speed", "Throttle", "Brake", "Gear", "RPM",
    "TireTemp_FL", "TireTemp_FR", "TireTemp_RL", "TireTemp_RR",
    "FuelRemaining", "LapTime",
]


class SimulatorError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


def list_tracks() -> list[dict]:
    """Tracks that both exist in the registry and have a template CSV."""
    tracks = []
    for track_id, meta in TRACKS.items():
        path = TELEMETRY_DIR / f"{track_id}.csv"
        if not path.exists():
            continue
        template = _load_template(track_id)
        tracks.append({
            "id": track_id,
            **meta,
            "base_lap_s": template["base_lap_s"],
        })
    return tracks


def _load_template(track_id: str) -> dict:
    """Lap-1 sample rows + reference pace from the track's telemetry CSV."""
    path = TELEMETRY_DIR / f"{track_id}.csv"
    if not path.exists():
        raise SimulatorError(404, f"Unknown track '{track_id}'")

    with path.open(newline="") as f:
        rows = list(csv.DictReader(f))

    samples = [r for r in rows if r["Lap"] == "1"]
    lap_times = [float(r["LapTime"]) for r in rows if (r.get("LapTime") or "").strip()]
    if not samples or not lap_times:
        raise SimulatorError(500, f"Template telemetry for '{track_id}' is malformed")

    return {"samples": samples, "base_lap_s": min(lap_times)}


def _setup_lap_delta(setup: Setup, conditions: TrackConditions, character: str) -> float:
    """Lap-time cost (s) of the setup vs the track's optimum. Positive = slower."""
    total_wing = setup.front_wing_angle_deg + setup.rear_wing_angle_deg
    target = WING_TARGET.get(character, 23)
    balance = setup.front_wing_angle_deg / max(total_wing, 1)
    delta = 0.004 * (total_wing - target) ** 2 + 60 * (balance - 0.335) ** 2

    delta += 0.012 * (setup.brake_bias_percent - 53) ** 2

    rake = setup.rear_ride_height_mm - setup.front_ride_height_mm
    delta += 0.01 * (rake - 7) ** 2

    p_opt = 1.80 if conditions.track_temp_c > 40 else 1.85
    tp = setup.tire_pressure
    delta += 3.5 * sum((p - p_opt) ** 2 for p in (tp.fl, tp.fr, tp.rl, tp.rr))

    return delta


def _hybrid_delta(setup: Setup, car_class: str) -> float:
    if car_class != "hypercar":
        return 0.0
    return {1: 0.2, 2: 0.0, 3: -0.15}.get(setup.hybrid_deployment_map, 0.0)


def simulate_stint(
    track_id: str,
    car_class: CarClass,
    car_name: str | None,
    setup: Setup,
    conditions: TrackConditions,
    laps: int = 15,
) -> dict:
    """Run one stint and return the CSV text plus per-lap summary."""
    if track_id not in TRACKS:
        raise SimulatorError(404, f"Unknown track '{track_id}'")

    template = _load_template(track_id)
    samples = template["samples"]
    meta = TRACKS[track_id]
    character = meta["track_type"]
    rng = random.Random()

    pace = CLASS_PACE_FACTOR.get(car_class, 1.0)
    speed_factor = CLASS_SPEED_FACTOR.get(car_class, 1.0)
    fuel_burn = CLASS_FUEL_BURN_KG_LAP.get(car_class, 1.8)

    base_lap = template["base_lap_s"] * pace
    setup_delta = _setup_lap_delta(setup, conditions, character) + _hybrid_delta(setup, car_class)

    # Wing drag trims top speed; downforce buys a little corner speed
    total_wing = setup.front_wing_angle_deg + setup.rear_wing_angle_deg
    vmax_scale = max(0.9, min(1.06, 1.0 - 0.0045 * (setup.rear_wing_angle_deg - 15)))
    corner_gain = 0.002 * (total_wing - 23)

    v_template_max = max(float(s["Speed"]) for s in samples)

    # Tire thermal model: warm-up toward an equilibrium set by pressures/temp
    temp_cold = conditions.track_temp_c + 35.0
    eq_temps = {}
    for corner, key in (("fl", "TireTemp_FL"), ("fr", "TireTemp_FR"),
                        ("rl", "TireTemp_RL"), ("rr", "TireTemp_RR")):
        pressure = getattr(setup.tire_pressure, corner)
        pressure_offset = max(-8.0, min(8.0, (1.85 - pressure) * 30.0))
        eq_temps[key] = 96.0 + (conditions.track_temp_c - 35.0) * 0.6 + pressure_offset + rng.uniform(-1, 1)

    fuel = float(conditions.fuel_load_kg)
    out = io.StringIO()
    # \n endings to match the hand-written files in telemetry/
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(CSV_HEADER)

    lap_summaries = []
    for lap in range(1, laps + 1):
        # Cold tires on the first laps, degradation later in the stint
        warmup = 0.8 * math.exp(-(lap - 1) / 1.2)
        degradation = 0.05 * max(0, lap - 5)
        fuel_effect = 0.032 * (fuel - 20.0)
        lap_time = base_lap + setup_delta + warmup + degradation + fuel_effect + rng.gauss(0, 0.12)

        grip = 1.0 - warmup * 0.004 - degradation * 0.003
        lap_speeds = []
        n = len(samples)
        for i, s in enumerate(samples):
            v = float(s["Speed"])
            v_frac = v / v_template_max
            # Straights feel the drag change, corners the downforce change
            v_sim = v * speed_factor * grip * (1 + (vmax_scale - 1) * v_frac + corner_gain * (1 - v_frac))
            v_sim *= 1 + rng.gauss(0, 0.004)
            lap_speeds.append(v_sim)

            throttle = float(s["Throttle"])
            brake = float(s["Brake"])
            if throttle > 0:
                throttle = max(0.0, min(100.0, throttle + rng.gauss(0, 1.5)))
            if brake > 0:
                brake = max(0.0, min(100.0, brake + rng.gauss(0, 1.5)))

            rpm = float(s["RPM"]) * (0.94 + 0.06 * speed_factor) * (1 + rng.gauss(0, 0.005))

            fuel_in_lap = max(2.0, fuel - fuel_burn * (i + 1) / n)

            row_temps = []
            for key in ("TireTemp_FL", "TireTemp_FR", "TireTemp_RL", "TireTemp_RR"):
                # Approach equilibrium over ~3 laps, drift up late in the stint
                t = eq_temps[key] - (eq_temps[key] - temp_cold) * math.exp(-lap / 1.8)
                t += 0.3 * max(0, lap - 8)
                t += (float(samples[i][key]) - float(samples[0][key])) * 0.25  # in-lap build
                row_temps.append(round(t + rng.uniform(-0.4, 0.4), 1))

            writer.writerow([
                lap,
                s["Distance"],
                round(v_sim, 1),
                round(throttle, 1),
                round(brake, 1),
                s["Gear"],
                int(rpm),
                *row_temps,
                round(fuel_in_lap, 1),
                round(lap_time, 2) if i == n - 1 else "",
            ])

        fuel = max(2.0, fuel - fuel_burn)
        lap_summaries.append({
            "lap": lap,
            "lap_time_s": round(lap_time, 2),
            "avg_speed_kmh": round(sum(lap_speeds) / len(lap_speeds), 1),
            "max_speed_kmh": round(max(lap_speeds), 1),
            "fuel_remaining_kg": round(fuel, 1),
        })

    car_slug = (car_name or car_class).lower().replace(" ", "_").replace(".", "")
    return {
        "track_id": track_id,
        "track_name": meta["name"],
        "car_class": car_class,
        "car_name": car_name,
        "laps": lap_summaries,
        "best_lap_s": min(l["lap_time_s"] for l in lap_summaries),
        "csv": out.getvalue(),
        "filename": f"{track_id}_{car_slug}_stint.csv",
    }
