// Track registry — ids match the telemetry CSV basenames (telemetry/<id>.csv)
// and the backend simulator's registry. The backend's GET /tracks is the
// source of truth at runtime; this static copy keeps the selector working
// when the API is offline.

// baseLapS mirrors the fastest lap in each telemetry CSV (hypercar-level
// reference pace) so predictions, simulation and analysis agree per circuit.
export const TRACK_REGISTRY = [
  { id: 'monza',     name: 'Monza',                   country: 'Italy',   lengthKm: 5.793,  trackType: 'high_speed', baseLapS: 102.57 },
  { id: 'spa',       name: 'Spa-Francorchamps',       country: 'Belgium', lengthKm: 7.004,  trackType: 'high_speed', baseLapS: 129.67 },
  { id: 'le_mans',   name: 'Circuit de la Sarthe',    country: 'France',  lengthKm: 13.626, trackType: 'high_speed', baseLapS: 215.34 },
  { id: 'cota',      name: 'Circuit of the Americas', country: 'USA',     lengthKm: 5.513,  trackType: 'technical',  baseLapS: 128.91 },
  { id: 'fuji',      name: 'Fuji Speedway',           country: 'Japan',   lengthKm: 4.563,  trackType: 'mixed',      baseLapS: 129.81 },
  { id: 'sao_paulo', name: 'Interlagos (São Paulo)',  country: 'Brazil',  lengthKm: 4.309,  trackType: 'mixed',      baseLapS: 125.66 },
];

export const TRACK_TYPE_LABELS = {
  high_speed: 'High speed',
  mixed: 'Mixed',
  technical: 'Technical',
};

export const DEFAULT_TRACK_ID = 'monza';

export function getTrack(trackId) {
  return TRACK_REGISTRY.find((t) => t.id === trackId) ?? TRACK_REGISTRY[0];
}
