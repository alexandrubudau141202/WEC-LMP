// Client-side lap time prediction. A deliberately simple quadratic-penalty
// model: each setup group has a track/session-dependent optimum, and deviation
// from it costs time. Deltas are reported against the app's baseline setup so
// the charts show what the *driver's changes* cost or gain, live.
//
// This mirrors the tendencies of the backend rule engine (diagnostic_engine.py)
// but is intentionally coarse — it predicts trends, not absolute reality.

// Class pace relative to the hypercar-level reference lap of each track
// (mirrors CLASS_PACE_FACTOR in backend/simulator.py).
const CLASS_PACE_FACTOR = { hypercar: 1.0, lmp2: 1.045, gt3: 1.13 };

// Fallback reference lap when no track is supplied (~5 km circuit).
const FALLBACK_BASE_LAP_S = 125.0;

// Baseline setup/conditions the deltas are measured against.
// Mirrors DEFAULT_SETUP / DEFAULT_CONDITIONS in App.jsx.
export const BASELINE = {
  setup: {
    front_ride_height_mm: 45,
    rear_ride_height_mm: 50,
    front_wing_angle_deg: 8,
    rear_wing_angle_deg: 15,
    brake_bias_percent: 52,
    hybrid_deployment_map: 1,
    tire_pressure: { fl: 1.9, fr: 1.9, rl: 1.9, rr: 1.9 },
    coast_diff_percent: 40,
    rear_camber_deg: -3.0,
    front_wheel_rate_nmm: 200,
    rear_wheel_rate_nmm: 180,
    final_drive_ratio: 3.6,
  },
  conditions: {
    track_temp_c: 35,
    fuel_load_kg: 60,
    stint_lap: 15,
    time_of_day: 'day',
    track_type: 'mixed',
    session_type: 'race',
  },
};

// Optimal combined wing (front + rear, deg) per track character.
const WING_TARGET = { high_speed: 18, mixed: 23, technical: 28 };

// Optimal final drive per track character (long gearing for straights).
const FINAL_DRIVE_TARGET = { high_speed: 3.2, mixed: 3.6, technical: 4.1 };

const sq = (x) => x * x;

// Each group is a pure function of (setup, conditions) → delta seconds
// (positive = slower). Groups stay separable so per-group contributions
// are just f(current) − f(baseline).
const GROUPS = [
  {
    key: 'aero',
    label: 'Aero',
    fn(setup, cond) {
      const total = setup.front_wing_angle_deg + setup.rear_wing_angle_deg;
      const target = WING_TARGET[cond.track_type] ?? WING_TARGET.mixed;
      const balance = setup.front_wing_angle_deg / Math.max(total, 1);
      // Drag/downforce mismatch + aero balance away from ~33% front
      return 0.004 * sq(total - target) + 60 * sq(balance - 0.335);
    },
  },
  {
    key: 'ride_height',
    label: 'Ride height',
    fn(setup, cond) {
      // Hotlap runs lower; race needs margin for fuel/kerbs
      const frontOpt = cond.session_type === 'hotlap' ? 40 : 43;
      const rearOpt = frontOpt + 7;
      return (
        0.003 * sq(setup.front_ride_height_mm - frontOpt) +
        0.002 * sq(setup.rear_ride_height_mm - rearOpt)
      );
    },
  },
  {
    key: 'brakes',
    label: 'Brake bias',
    fn(setup) {
      return 0.012 * sq(setup.brake_bias_percent - 53);
    },
  },
  {
    key: 'tires',
    label: 'Tire pressure',
    fn(setup, cond) {
      // Hot track wants a touch less static pressure
      const opt = cond.track_temp_c > 40 ? 1.8 : 1.85;
      const p = setup.tire_pressure;
      return 3.5 * (sq(p.fl - opt) + sq(p.fr - opt) + sq(p.rl - opt) + sq(p.rr - opt));
    },
  },
  {
    key: 'hybrid',
    label: 'Hybrid deploy',
    hybridOnly: true,
    fn(setup) {
      // Aggressive deployment buys lap time (at battery/tire cost)
      return { 1: 0.2, 2: 0, 3: -0.15 }[setup.hybrid_deployment_map] ?? 0;
    },
  },
  {
    key: 'drivetrain',
    label: 'Diff & gearing',
    fn(setup, cond) {
      const fdTarget = FINAL_DRIVE_TARGET[cond.track_type] ?? 3.6;
      return (
        0.0002 * sq(setup.coast_diff_percent - 40) +
        0.15 * sq(setup.rear_camber_deg + 3.5) +
        0.9 * sq(setup.final_drive_ratio - fdTarget)
      );
    },
  },
  {
    key: 'springs',
    label: 'Wheel rates',
    fn(setup, cond) {
      // Hotlap rewards a stiff platform; race stints reward compliance
      const frontOpt = cond.session_type === 'hotlap' ? 280 : 220;
      const rearOpt = frontOpt - 20;
      return (
        0.000012 * sq(setup.front_wheel_rate_nmm - frontOpt) +
        0.000012 * sq(setup.rear_wheel_rate_nmm - rearOpt)
      );
    },
  },
  {
    key: 'fuel',
    label: 'Fuel & stint',
    fn(setup, cond) {
      const fuel = 0.032 * (cond.fuel_load_kg - 20); // ~0.03 s/kg
      const wear = cond.session_type === 'race' ? 0.012 * Math.max(0, cond.stint_lap - 3) : 0;
      const temp = 0.0025 * sq(cond.track_temp_c - 32);
      const air = { night: -0.2, dawn: -0.1, dusk: -0.1, day: 0 }[cond.time_of_day] ?? 0;
      return fuel + wear + temp + air;
    },
  },
];

export function predictLapTime(carClass, setup, conditions, baseLapS = null) {
  const base =
    (baseLapS ?? FALLBACK_BASE_LAP_S) * (CLASS_PACE_FACTOR[carClass] ?? 1.0);
  const groups = GROUPS.filter((g) => !g.hybridOnly || carClass === 'hypercar');

  let total = base;
  const contributions = groups.map((g) => {
    const current = g.fn(setup, conditions);
    const baseline = g.fn(BASELINE.setup, BASELINE.conditions);
    total += current;
    return { key: g.key, label: g.label, delta: current - baseline };
  });

  const deltaVsBaseline = contributions.reduce((sum, c) => sum + c.delta, 0);
  return { totalSeconds: total, deltaVsBaseline, contributions };
}

// Predicted lap across the rear wing range, everything else held at the
// current setup — the sensitivity curve for the chart.
export function rearWingSweep(carClass, setup, conditions, baseLapS = null, min = 10, max = 25, step = 0.5) {
  const points = [];
  for (let wing = min; wing <= max + 1e-9; wing += step) {
    const { totalSeconds } = predictLapTime(
      carClass,
      { ...setup, rear_wing_angle_deg: wing },
      conditions,
      baseLapS
    );
    points.push({ wing: Math.round(wing * 10) / 10, seconds: totalSeconds });
  }
  return points;
}

export function formatLapTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
