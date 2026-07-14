import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TRACK_REGISTRY, TRACK_TYPE_LABELS, getTrack } from '../tracks';

// Track picker card. Prefers the backend's GET /tracks (which knows the
// reference pace per track); falls back to the static registry offline.
export default function TrackSelector({ trackId, onChange, apiUrl }) {
  const [tracks, setTracks] = useState(TRACK_REGISTRY);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${apiUrl}/tracks`)
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setTracks(data.map((t) => ({
          id: t.id,
          name: t.name,
          country: t.country,
          lengthKm: t.length_km,
          trackType: t.track_type,
          baseLapS: t.base_lap_s,
        })));
      })
      .catch(() => {}); // offline: static registry already in place
    return () => { cancelled = true; };
  }, [apiUrl]);

  const track = tracks.find((t) => t.id === trackId) ?? getTrack(trackId);

  return (
    <section className="input-section track-picker">
      <div className="car-picker-header">
        <h2 className="section-title">
          <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Track
        </h2>
        <span className={`track-type-badge type-${track.trackType}`}>
          {TRACK_TYPE_LABELS[track.trackType] ?? track.trackType}
        </span>
      </div>

      <select
        className="input-select"
        value={track.id}
        onChange={(e) => onChange(tracks.find((t) => t.id === e.target.value))}
      >
        {tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} — {t.country}
          </option>
        ))}
      </select>

      <div className="track-meta">
        <span>{track.lengthKm.toFixed(3)} km</span>
        {track.baseLapS && (
          <span>
            ref. lap {Math.floor(track.baseLapS / 60)}:
            {(track.baseLapS % 60).toFixed(2).padStart(5, '0')}
          </span>
        )}
      </div>
    </section>
  );
}
