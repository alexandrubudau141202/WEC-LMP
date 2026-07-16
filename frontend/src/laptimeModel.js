// Client-side lap time prediction. A deliberately simple quadratic-penalty
// model: each setup group has a track/session-dependent optimum, and deviation
// from it costs time. Deltas are reported against the app's baseline setup so
// the charts show what the *driver's changes* cost or gain, live.
//
// This mirrors backend/simulator.py (shared constants: CLASS_PACE_FACTOR,
// WING_TARGET, GT3_WING_TARGET, the penalty structure) and layers per-car
// optima from carProfiles.js on top — keep all three in sync.
// It predicts trends, not absolute reality.

// Class pace relative to the hypercar-level reference lap of each track.
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
    brake_bias_percent: 55,
    hybrid_deployment_map: 1,
    tire_pressure: { fl: 1.9, fr: 1.9, rl: 1.9, rr: 1.9 },
    coast_diff_percent: 40,
    rear_camber_deg: -3.0,
    front_wheel_rate_nmm: 150,
    rear_wheel_rate_nmm: 135,
    final_drive_ratio: 3.6,
    // Alignment
    front_toe_deg: 0.0,
    rear_toe_deg: 0.1,
    front_camber_deg: -2.8,
    caster_deg: 10.0,
    // Electronics
    traction_control: 3,
    abs_level: 3,
    ecu_map: 2,
    // Brakes
    brake_compound: 2,
    brake_power_percent: 100,
    // Mechanical grip
    front_antiroll_bar: 4,
    rear_antiroll_bar: 4,
    steering_ratio: 13.0,
    bumpstop_rate_n: 1000,
    front_bumpstop_range_mm: 10,
    rear_bumpstop_range_mm: 20,
    diff_preload_nm: 120,
    // Dampers
    bump_damping: 20,
    rebound_damping: 20,
    fast_bump_damping: 24,
    fast_rebound_damping: 24,
    // Aero extras
    front_splitter: 1,
    front_brake_ducts: 3,
    rear_brake_ducts: 3,
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

// Optimal combined wing (front + rear, deg) per track character — prototypes.
const WING_TARGET = { high_speed: 18, mixed: 23, technical: 28 };

// Optimal rear wing clicks (0-8) per track character — GT3.
const GT3_WING_TARGET = { high_speed: 3, mixed: 5, technical: 7 };

// Optimal final drive per track character (long gearing for straights).
const FINAL_DRIVE_TARGET = { high_speed: 3.2, mixed: 3.6, technical: 4.1 };

// ECU map cost vs map 2 in the dry (1 aggressive … 5 pace car, 6-8 rain maps).
const ECU_MAP_DELTA = { 1: -0.1, 2: 0, 3: 0.05, 4: 0.35, 5: 0.35, 6: 0.9, 7: 1.1, 8: 1.2 };

// Pad compound cost in the dry (1 sprint, 2 endurance, 3 wet, 4 qualifying).
const BRAKE_COMPOUND_DELTA = { 1: 0, 2: 0.08, 3: 0.9, 4: -0.12 };

const sq = (x) => x * x;

// Each group is a pure function of (setup, conditions, carClass) → delta
// seconds (positive = slower). Groups stay separable so per-group
// contributions are just f(current) − f(baseline).
const GROUPS = [
  {
    key: 'aero',
    label: 'Aero',
    fn(setup, cond, cls, profile) {
      if (cls === 'gt3') {
        // Wing-dominant aero in clicks; splitter balances the front.
        // Cars that crave rear downforce (911s, M4) shift the target up.
        const target = (GT3_WING_TARGET[cond.track_type] ?? GT3_WING_TARGET.mixed)
          + (profile.wingTargetOffset ?? 0);
        return (
          0.06 * sq(setup.rear_wing_angle_deg - target) +
          0.05 * sq(setup.front_splitter - Math.min(3, target / 2))
        );
      }
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
    fn(setup, cond, cls, profile) {
      // Hotlap runs lower; race needs margin for fuel/kerbs.
      // GT3 sits far higher (50-70 / 50-80 mm) than a prototype; some cars
      // have their own platform sweet spot (296: 60/58, M4: low nose + rake).
      let frontOpt =
        cls === 'gt3'
          ? (cond.session_type === 'hotlap' ? 52 : 55)
          : (cond.session_type === 'hotlap' ? 40 : 43);
      let rearOpt = frontOpt + (cls === 'gt3' ? 8 : 7);
      if (profile.rideHeightOpt) {
        frontOpt = profile.rideHeightOpt.front;
        rearOpt = profile.rideHeightOpt.rear;
      }
      return (
        0.003 * sq(setup.front_ride_height_mm - frontOpt) +
        0.002 * sq(setup.rear_ride_height_mm - rearOpt)
      );
    },
  },
  {
    key: 'brakes',
    label: 'Brakes',
    fn(setup, cond, cls, profile) {
      const biasOpt = profile.biasOpt ?? (cls === 'gt3' ? 58 : 53);
      return (
        0.012 * sq(setup.brake_bias_percent - biasOpt) +
        0.01 * (100 - setup.brake_power_percent) +
        (BRAKE_COMPOUND_DELTA[setup.brake_compound] ?? 0)
      );
    },
  },
  {
    key: 'tires',
    label: 'Tire pressure',
    fn(setup, cond, cls, profile) {
      // Hot track wants a touch less static pressure
      const opt = (profile.pressureOptBar ?? 1.85) - (cond.track_temp_c > 40 ? 0.05 : 0);
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
    key: 'electronics',
    label: 'Electronics',
    fn(setup, cond, cls, profile) {
      // Some assist is faster than none; too much chokes exits/braking.
      // TC/ABS sweet spots and map semantics are per car.
      const ecuDelta = profile.ecuMapDelta ?? ECU_MAP_DELTA;
      return (
        0.02 * sq(setup.traction_control - (profile.tcOpt ?? 3)) +
        0.015 * sq(setup.abs_level - (profile.absOpt ?? 3)) +
        (ecuDelta[setup.ecu_map] ?? 0)
      );
    },
  },
  {
    key: 'alignment',
    label: 'Alignment',
    fn(setup, cond, cls, profile) {
      return (
        4 * sq(setup.front_toe_deg - 0.0) +
        3 * sq(setup.rear_toe_deg - 0.12) +
        0.12 * sq(setup.front_camber_deg - (profile.frontCamberOpt ?? -3.2)) +
        0.01 * sq(setup.caster_deg - (profile.casterOpt ?? 11)) +
        0.15 * sq(setup.rear_camber_deg - (profile.rearCamberOpt ?? -3.5))
      );
    },
  },
  {
    key: 'drivetrain',
    label: 'Diff & gearing',
    fn(setup, cond, cls, profile) {
      const fdTarget = FINAL_DRIVE_TARGET[cond.track_type] ?? 3.6;
      return (
        0.0002 * sq(setup.coast_diff_percent - 40) +
        0.000004 * sq(setup.diff_preload_nm - (profile.preloadOpt ?? 120)) +
        0.9 * sq(setup.final_drive_ratio - fdTarget)
      );
    },
  },
  {
    key: 'suspension',
    label: 'Springs & dampers',
    fn(setup, cond, cls, profile) {
      // Hotlap rewards a stiff platform; race stints reward compliance.
      // "Full soft springs" cars (911s, M4) carry their own targets.
      const frontOpt = profile.wheelRateOpt?.front ?? (cond.session_type === 'hotlap' ? 165 : 135);
      const rearOpt = profile.wheelRateOpt?.rear ?? (frontOpt - 15);
      const arbOpt = cond.session_type === 'hotlap' ? 6 : 4;
      return (
        0.0001 * sq(setup.front_wheel_rate_nmm - frontOpt) +
        0.0001 * sq(setup.rear_wheel_rate_nmm - rearOpt) +
        0.01 * sq(setup.front_antiroll_bar - (profile.arbOpt?.front ?? arbOpt)) +
        0.01 * sq(setup.rear_antiroll_bar - (profile.arbOpt?.rear ?? arbOpt)) +
        0.01 * sq(setup.steering_ratio - (profile.steeringRatioOpt ?? 13)) +
        0.0008 * (sq(setup.bump_damping - 20) + sq(setup.rebound_damping - 20)) +
        0.0005 * (sq(setup.fast_bump_damping - 24) + sq(setup.fast_rebound_damping - 24)) +
        0.0000004 * sq(setup.bumpstop_rate_n - 1000) +
        0.0006 * sq(setup.front_bumpstop_range_mm - 10) +
        0.0003 * sq(setup.rear_bumpstop_range_mm - 20)
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

export function predictLapTime(carClass, setup, conditions, baseLapS = null, profile = {}) {
  const base =
    (baseLapS ?? FALLBACK_BASE_LAP_S) * (CLASS_PACE_FACTOR[carClass] ?? 1.0);
  const groups = GROUPS.filter((g) => !g.hybridOnly || carClass === 'hypercar');

  let total = base;
  const contributions = groups.map((g) => {
    const current = g.fn(setup, conditions, carClass, profile);
    const baseline = g.fn(BASELINE.setup, BASELINE.conditions, carClass, profile);
    total += current;
    return { key: g.key, label: g.label, delta: current - baseline };
  });

  const deltaVsBaseline = contributions.reduce((sum, c) => sum + c.delta, 0);
  return { totalSeconds: total, deltaVsBaseline, contributions };
}

// Predicted lap across the rear wing range, everything else held at the
// current setup — the sensitivity curve for the chart. GT3 sweeps wing
// clicks 0-8; prototypes sweep degrees 10-25.
export function rearWingSweep(carClass, setup, conditions, baseLapS = null, profile = {}) {
  const [min, max, step] = carClass === 'gt3' ? [0, 8, 0.5] : [10, 25, 0.5];
  const points = [];
  for (let wing = min; wing <= max + 1e-9; wing += step) {
    const { totalSeconds } = predictLapTime(
      carClass,
      { ...setup, rear_wing_angle_deg: wing },
      conditions,
      baseLapS,
      profile
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
