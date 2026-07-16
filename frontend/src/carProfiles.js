// Per-car setup profiles — distilled from real setup guidance (parameters.txt).
// Each field overrides a class-level optimum in laptimeModel.js; anything
// omitted falls back to the class default. Mirrored in backend/simulator.py
// (CAR_PROFILES) — keep them in sync.
//
// Fields:
//   biasOpt          — brake bias sweet spot (% front)
//   pressureOptBar   — dry tire pressure target (ACC PSI → bar: 27.5≈1.90, 26.7≈1.84)
//   frontCamberOpt / rearCamberOpt / casterOpt
//   wingTargetOffset — clicks added to the GT3 wing target (+ = wants more wing)
//   rideHeightOpt    — {front, rear} mm
//   wheelRateOpt     — {front, rear} N/mm ("full soft springs" cars sit low)
//   arbOpt           — {front, rear}
//   preloadOpt       — diff preload Nm
//   steeringRatioOpt
//   tcOpt / absOpt
//   ecuMapDelta      — per-map lap-time cost (s) vs the car's best dry map
//   ecuMapLabels     — what each map means on THIS car

// Generic GT3 ECU semantics (BMW M4 GT3-style) — the class default.
export const DEFAULT_ECU_LABELS = {
  1: 'Map 1 — Most aggressive',
  2: 'Map 2 — Linear (default dry)',
  3: 'Map 3 — Gradual on throttle',
  4: 'Map 4 — Slowest dry',
  5: 'Map 5 — Pace car',
  6: 'Map 6 — Rain, highest consumption',
  7: 'Map 7 — Rain, critical situations',
  8: 'Map 8 — Rain, critical situations',
};

export const CAR_PROFILES = {
  // 992-generation 911 GT3 R: rear-weight bias, wants rear downforce and a
  // soft platform; Map 8 is the standard max-linear-power dry map.
  porsche_992_gt3r: {
    biasOpt: 57.5,
    pressureOptBar: 1.90,
    wingTargetOffset: 1,
    wheelRateOpt: { front: 110, rear: 95 },
    rideHeightOpt: { front: 53, rear: 61 },
    tcOpt: 3,
    absOpt: 3,
    ecuMapDelta: { 1: 0.05, 2: 0.08, 3: 0.12, 4: 0.2, 5: 0.35, 6: 0.6, 7: 0.3, 8: -0.1 },
    ecuMapLabels: {
      1: 'Map 1 — Default dry',
      2: 'Map 2 — Progressive',
      3: 'Map 3 — Gradual on throttle',
      4: 'Map 4 — Conservative dry',
      5: 'Map 5 — Pace car',
      6: 'Map 6 — Rain, highest consumption',
      7: 'Map 7 — Rain',
      8: 'Map 8 — Max linear power (standard)',
    },
  },

  // 911 RSR: same rear-engined DNA — rake and rear wing stabilize it;
  // snap oversteer mid-to-high speed if the rear is starved of load.
  porsche_911_rsr: {
    biasOpt: 57.5,
    pressureOptBar: 1.90,
    wingTargetOffset: 1,
    wheelRateOpt: { front: 110, rear: 95 },
    rideHeightOpt: { front: 52, rear: 62 },
    tcOpt: 2,
    absOpt: 3,
  },

  // BMW M4 GT3: understeer-prone — max wing, rake, max camber/caster,
  // minimum diff preload. Generic map semantics ARE this car's.
  bmw_m4_gt3: {
    biasOpt: 58.0,
    pressureOptBar: 1.90,
    frontCamberOpt: -4.0,
    rearCamberOpt: -3.8,
    casterOpt: 13.5,
    wingTargetOffset: 1,
    rideHeightOpt: { front: 50, rear: 58 },
    wheelRateOpt: { front: 110, rear: 95 },
    preloadOpt: 20,
    tcOpt: 3,
    absOpt: 2,
  },

  // Ferrari 296 GT3: naturally responsive — high TC for high-speed stability,
  // ABS 2, Map 2 linear preferred, maxed camber/caster, ~58.4% bias,
  // 60/58 mm ride heights, low steering ratio.
  ferrari_296_gt3: {
    biasOpt: 58.4,
    pressureOptBar: 1.84,
    frontCamberOpt: -4.0,
    rearCamberOpt: -3.5,
    casterOpt: 13.5,
    rideHeightOpt: { front: 60, rear: 58 },
    steeringRatioOpt: 14,
    tcOpt: 5,
    absOpt: 2,
    ecuMapDelta: { 1: 0.05, 2: -0.05, 3: 0.1, 4: 0.35, 5: 0.35, 6: 0.9, 7: 1.1, 8: 1.2 },
    ecuMapLabels: {
      1: 'Map 1 — Default (peaky)',
      2: 'Map 2 — Linear throttle (preferred)',
      3: 'Map 3 — Gradual on throttle',
      4: 'Map 4 — Slowest dry',
      5: 'Map 5 — Pace car',
      6: 'Map 6 — Rain, highest consumption',
      7: 'Map 7 — Rain, critical situations',
      8: 'Map 8 — Rain, critical situations',
    },
  },

  // Audi R8 LMS: forward-heavy — rearward bias fights understeer,
  // mid rear wing (4-5), stiff front / soft rear ARBs.
  audi_r8_lms: {
    biasOpt: 58.6,
    wingTargetOffset: -1,
    arbOpt: { front: 3, rear: 1 },
    tcOpt: 4,
    absOpt: 4,
  },
};

export function getCarProfile(carId) {
  return CAR_PROFILES[carId] ?? {};
}
