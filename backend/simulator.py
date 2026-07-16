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
    "nurburgring_gp":  {"name": "Nurburgring GP",        "country": "Germany", "length_km": 5.148,  "track_type": "technical"},
    "nurburgring_24h": {"name": "Nurburgring 24h",       "country": "Germany", "length_km": 25.378, "track_type": "technical"},
    "silverstone":     {"name": "Silverstone",           "country": "UK",      "length_km": 5.891,  "track_type": "high_speed"},
    "laguna_seca":     {"name": "Laguna Seca",           "country": "USA",     "length_km": 3.602,  "track_type": "technical"},
}

# Pace/top-speed scaling relative to the template files (hypercar-level pace)
CLASS_PACE_FACTOR = {"hypercar": 1.0, "lmp2": 1.045, "gt3": 1.13}
CLASS_SPEED_FACTOR = {"hypercar": 1.0, "lmp2": 0.96, "gt3": 0.86}
CLASS_FUEL_BURN_KG_LAP = {"hypercar": 1.8, "lmp2": 1.5, "gt3": 2.0}

# Optimal combined wing (front + rear, deg) per track character — mirrors
# laptimeModel.js so the on-screen prediction and the simulation agree.
WING_TARGET = {"high_speed": 18, "mixed": 23, "technical": 28}

# Optimal rear wing clicks (0-8) per track character — GT3 (mirrors laptimeModel.js)
GT3_WING_TARGET = {"high_speed": 3, "mixed": 5, "technical": 7}

# ECU map: lap-time cost vs map 2 in the dry, and fuel-burn multiplier
# (1 aggressive … 5 pace car, 6-8 rain maps)
ECU_MAP_DELTA = {1: -0.1, 2: 0.0, 3: 0.05, 4: 0.35, 5: 0.35, 6: 0.9, 7: 1.1, 8: 1.2}
ECU_MAP_BURN = {1: 1.06, 2: 1.0, 3: 0.97, 4: 0.9, 5: 0.9, 6: 1.12, 7: 1.02, 8: 0.95}

# Pad compound cost in the dry (1 sprint, 2 endurance, 3 wet, 4 qualifying)
BRAKE_COMPOUND_DELTA = {1: 0.0, 2: 0.08, 3: 0.9, 4: -0.12}

# Per-car setup profiles — mirrors frontend/src/carProfiles.js (keep in sync).
# Distilled from real setup guidance (parameters.txt). Missing keys fall back
# to the class defaults in _setup_lap_delta.
CAR_PROFILES: dict[str, dict] = {
    # 992 GT3 R: rear-weight bias, soft platform, Map 8 = max linear power
    "porsche_992_gt3r": {
        "bias_opt": 57.5, "pressure_opt_bar": 1.90, "wing_target_offset": 1,
        "wheel_rate_opt": (110, 95), "ride_height_opt": (53, 61),
        "tc_opt": 3, "abs_opt": 3,
        "ecu_map_delta": {1: 0.05, 2: 0.08, 3: 0.12, 4: 0.2, 5: 0.35, 6: 0.6, 7: 0.3, 8: -0.1},
    },
    # 911 RSR: rake + rear wing to tame snap oversteer
    "porsche_911_rsr": {
        "bias_opt": 57.5, "pressure_opt_bar": 1.90, "wing_target_offset": 1,
        "wheel_rate_opt": (110, 95), "ride_height_opt": (52, 62),
        "tc_opt": 2, "abs_opt": 3,
    },
    # M4 GT3: understeer-prone — max wing/camber/caster, min preload
    "bmw_m4_gt3": {
        "bias_opt": 58.0, "pressure_opt_bar": 1.90,
        "front_camber_opt": -4.0, "rear_camber_opt": -3.8, "caster_opt": 13.5,
        "wing_target_offset": 1, "ride_height_opt": (50, 58),
        "wheel_rate_opt": (110, 95), "preload_opt": 20,
        "tc_opt": 3, "abs_opt": 2,
    },
    # 296 GT3: high TC, ABS 2, Map 2 linear, maxed camber/caster, 58.4% bias
    "ferrari_296_gt3": {
        "bias_opt": 58.4, "pressure_opt_bar": 1.84,
        "front_camber_opt": -4.0, "rear_camber_opt": -3.5, "caster_opt": 13.5,
        "ride_height_opt": (60, 58), "steering_ratio_opt": 14,
        "tc_opt": 5, "abs_opt": 2,
        "ecu_map_delta": {1: 0.05, 2: -0.05, 3: 0.1, 4: 0.35, 5: 0.35, 6: 0.9, 7: 1.1, 8: 1.2},
    },
    # R8 LMS: forward-heavy — rearward bias, mid wing, stiff front/soft rear ARB
    "audi_r8_lms": {
        "bias_opt": 58.6, "wing_target_offset": -1,
        "arb_opt": (3, 1), "tc_opt": 4, "abs_opt": 4,
    },
}

# Optimal final drive per track character (mirrors laptimeModel.js)
FINAL_DRIVE_TARGET = {"high_speed": 3.2, "mixed": 3.6, "technical": 4.1}

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


def _setup_lap_delta(setup: Setup, conditions: TrackConditions, character: str,
                     car_class: str, profile: dict) -> float:
    """Lap-time cost (s) of the setup vs the track's optimum. Positive = slower.

    Mirrors the GROUPS penalties in frontend/src/laptimeModel.js, with the
    per-car optima from CAR_PROFILES layered on top.
    """
    # Aero
    if car_class == "gt3":
        target = GT3_WING_TARGET.get(character, 5) + profile.get("wing_target_offset", 0)
        delta = 0.06 * (setup.rear_wing_angle_deg - target) ** 2
        delta += 0.05 * (setup.front_splitter - min(3, target / 2)) ** 2
    else:
        total_wing = setup.front_wing_angle_deg + setup.rear_wing_angle_deg
        target = WING_TARGET.get(character, 23)
        balance = setup.front_wing_angle_deg / max(total_wing, 1)
        delta = 0.004 * (total_wing - target) ** 2 + 60 * (balance - 0.335) ** 2

    # Ride height (GT3 sits far higher than a prototype)
    hotlap = conditions.session_type == "hotlap"
    front_opt = (52 if hotlap else 55) if car_class == "gt3" else (40 if hotlap else 43)
    rear_opt = front_opt + (8 if car_class == "gt3" else 7)
    if "ride_height_opt" in profile:
        front_opt, rear_opt = profile["ride_height_opt"]
    delta += 0.003 * (setup.front_ride_height_mm - front_opt) ** 2
    delta += 0.002 * (setup.rear_ride_height_mm - rear_opt) ** 2

    # Brakes
    bias_opt = profile.get("bias_opt", 58 if car_class == "gt3" else 53)
    delta += 0.012 * (setup.brake_bias_percent - bias_opt) ** 2
    delta += 0.01 * (100 - setup.brake_power_percent)
    delta += BRAKE_COMPOUND_DELTA.get(setup.brake_compound, 0.0)

    # Tires
    p_opt = profile.get("pressure_opt_bar", 1.85) - (0.05 if conditions.track_temp_c > 40 else 0)
    tp = setup.tire_pressure
    delta += 3.5 * sum((p - p_opt) ** 2 for p in (tp.fl, tp.fr, tp.rl, tp.rr))

    # Electronics (some assist is faster than none; too much chokes the car)
    delta += 0.02 * (setup.traction_control - profile.get("tc_opt", 3)) ** 2
    delta += 0.015 * (setup.abs_level - profile.get("abs_opt", 3)) ** 2
    delta += profile.get("ecu_map_delta", ECU_MAP_DELTA).get(setup.ecu_map, 0.0)

    # Alignment
    delta += 4 * (setup.front_toe_deg - 0.0) ** 2
    delta += 3 * (setup.rear_toe_deg - 0.12) ** 2
    delta += 0.12 * (setup.front_camber_deg - profile.get("front_camber_opt", -3.2)) ** 2
    delta += 0.01 * (setup.caster_deg - profile.get("caster_opt", 11)) ** 2
    delta += 0.15 * (setup.rear_camber_deg - profile.get("rear_camber_opt", -3.5)) ** 2

    # Drivetrain
    delta += 0.0002 * (setup.coast_diff_percent - 40) ** 2
    delta += 0.000004 * (setup.diff_preload_nm - profile.get("preload_opt", 120)) ** 2
    delta += 0.9 * (setup.final_drive_ratio - FINAL_DRIVE_TARGET.get(character, 3.6)) ** 2

    # Springs, ARBs, dampers, bumpstops
    fr_opt, rr_opt = profile.get("wheel_rate_opt", (165, 150) if hotlap else (135, 120))
    arb_opt = 6 if hotlap else 4
    arb_f, arb_r = profile.get("arb_opt", (arb_opt, arb_opt))
    delta += 0.0001 * (setup.front_wheel_rate_nmm - fr_opt) ** 2
    delta += 0.0001 * (setup.rear_wheel_rate_nmm - rr_opt) ** 2
    delta += 0.01 * (setup.front_antiroll_bar - arb_f) ** 2
    delta += 0.01 * (setup.rear_antiroll_bar - arb_r) ** 2
    delta += 0.01 * (setup.steering_ratio - profile.get("steering_ratio_opt", 13)) ** 2
    delta += 0.0008 * ((setup.bump_damping - 20) ** 2 + (setup.rebound_damping - 20) ** 2)
    delta += 0.0005 * ((setup.fast_bump_damping - 24) ** 2 + (setup.fast_rebound_damping - 24) ** 2)
    delta += 0.0000004 * (setup.bumpstop_rate_n - 1000) ** 2
    delta += 0.0006 * (setup.front_bumpstop_range_mm - 10) ** 2
    delta += 0.0003 * (setup.rear_bumpstop_range_mm - 20) ** 2

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
    car_id: str | None = None,
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
    # ECU map scales consumption (aggressive burns more, lean maps save)
    fuel_burn = CLASS_FUEL_BURN_KG_LAP.get(car_class, 1.8) * ECU_MAP_BURN.get(setup.ecu_map, 1.0)

    base_lap = template["base_lap_s"] * pace
    profile = CAR_PROFILES.get(car_id or "", {})
    setup_delta = _setup_lap_delta(setup, conditions, character, car_class, profile) + _hybrid_delta(setup, car_class)

    # Wing drag trims top speed; downforce buys a little corner speed.
    # GT3 wings are clicks 0-8 around a mid setting; prototypes are degrees.
    if car_class == "gt3":
        vmax_scale = max(0.9, min(1.06, 1.0 - 0.008 * (setup.rear_wing_angle_deg - 4)))
        corner_gain = 0.004 * (setup.rear_wing_angle_deg - 4)
    else:
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
        # Closed brake ducts push heat into the tires on that axle
        ducts = setup.front_brake_ducts if corner in ("fl", "fr") else setup.rear_brake_ducts
        duct_offset = (3 - ducts) * 1.2
        eq_temps[key] = (96.0 + (conditions.track_temp_c - 35.0) * 0.6
                         + pressure_offset + duct_offset + rng.uniform(-1, 1))

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
        # Fuel mass costs straight-line speed (~0.9% at 90 kg) and the car
        # frees up as the tank drains over the stint
        fuel_drag = 1.0 - 0.00012 * (fuel - 20.0)
        lap_speeds = []
        n = len(samples)
        for i, s in enumerate(samples):
            v = float(s["Speed"])
            v_frac = v / v_template_max
            # Straights feel the drag change, corners the downforce change
            v_sim = v * speed_factor * grip * fuel_drag * (1 + (vmax_scale - 1) * v_frac + corner_gain * (1 - v_frac))
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
