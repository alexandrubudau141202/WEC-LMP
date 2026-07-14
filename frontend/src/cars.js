// The garage: every 3D model in frontend/public/ mapped to a real car.
// Add a new car by dropping its .glb into public/ and adding a row here.
// carClass drives the physics profile + AI context on the backend.

// g61Match: substring used to find this car's iRacing equivalent in the
// Garage 61 catalog for the Reference Laps panel (null = no iRacing version,
// e.g. the Valkyrie; the Oreca 07 maps to iRacing's LMP2, the Dallara P217).
export const CAR_REGISTRY = [
  // ── Hypercar (LMH / LMDh) ──────────────────────────────────────────
  { id: 'porsche_963',      name: 'Porsche 963',                  carClass: 'hypercar', model: '/porsche_963.glb',                          g61Match: 'Porsche 963' },
  { id: 'ferrari_499p',     name: 'Ferrari 499P',                 carClass: 'hypercar', model: '/ferrari_499p__www.vecarz.com.glb',         g61Match: 'Ferrari 499P' },
  { id: 'cadillac_vseries', name: 'Cadillac V-Series.R',          carClass: 'hypercar', model: '/cadillac_v_seriesr_2023__www.vecarz.com.glb', g61Match: 'Cadillac V-Series' },
  { id: 'bmw_m_hybrid_v8',  name: 'BMW M Hybrid V8',              carClass: 'hypercar', model: '/bmw_m_hybrid_v8__www.vecarz.com.glb',      g61Match: 'BMW M Hybrid' },
  { id: 'aston_valkyrie',   name: 'Aston Martin Valkyrie AMR-LMH', carClass: 'hypercar', model: '/aston_martin_valkyrie_lm__www.vecarz.com.glb', g61Match: null },

  // ── LMP2 ───────────────────────────────────────────────────────────
  { id: 'lmp2_prototype',   name: 'LMP2 Prototype (Oreca 07 spec)', carClass: 'lmp2',   model: '/krashkatlmp2w_wheels.glb',                 g61Match: 'Dallara P217' },

  // ── GT3 / GTE ──────────────────────────────────────────────────────
  { id: 'porsche_992_gt3r', name: 'Porsche 911 GT3 R (992)',      carClass: 'gt3',      model: '/porsche_992_gt3_r__www.vecarz.com.glb',    g61Match: 'Porsche 911 GT3 R (992)' },
  { id: 'porsche_911_rsr',  name: 'Porsche 911 RSR',              carClass: 'gt3',      model: '/2017_porsche_911_rsr.glb',                 g61Match: 'Porsche 911 RSR' },
  { id: 'bmw_m4_gt3',       name: 'BMW M4 GT3',                   carClass: 'gt3',      model: '/bmw_m4_gt3.glb',                           g61Match: 'BMW M4 GT3' },
  { id: 'ferrari_296_gt3',  name: 'Ferrari 296 GT3',              carClass: 'gt3',      model: '/ferrari_296_gt3__www.vecarz.com.glb',      g61Match: 'Ferrari 296 GT3' },
  { id: 'audi_r8_lms',      name: 'Audi R8 LMS GT3',              carClass: 'gt3',      model: '/2019_audi_r8_lms_gt3.glb',                 g61Match: 'Audi R8 LMS EVO' },
];

export const CLASS_LABELS = {
  hypercar: 'Hypercar',
  lmp2: 'LMP2',
  gt3: 'GT3',
};

export const DEFAULT_CAR_ID = 'porsche_963';

export function getCar(carId) {
  return CAR_REGISTRY.find((c) => c.id === carId) ?? CAR_REGISTRY[0];
}
