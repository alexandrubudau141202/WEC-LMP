import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { getCar } from '../cars';

// Format seconds -> m:ss.mmm; tolerate unknown shapes from the API
function formatLapTime(value) {
  const secs = Number(value);
  if (!Number.isFinite(secs) || secs <= 0) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs - m * 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

function lapDriver(lap) {
  const d = lap.driver ?? lap.user ?? {};
  const name = [d.firstName, d.lastName].filter(Boolean).join(' ');
  return name || d.nickName || d.name || 'Unknown driver';
}

function lapTime(lap) {
  return lap.lapTime ?? lap.time ?? lap.laptime ?? null;
}

function lapDate(lap) {
  const raw = lap.startTime ?? lap.drivenAt ?? lap.createdAt ?? lap.date;
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

// Reference Laps: lap times from Garage 61 (you + your team) for the
// selected car and a chosen track. The backend proxies all calls so the
// API token stays server-side.
export default function ReferenceLaps({ apiUrl, carId }) {
  const car = getCar(carId);

  const [status, setStatus] = useState(null);       // /garage61/status payload
  const [g61Cars, setG61Cars] = useState([]);
  const [g61Tracks, setG61Tracks] = useState([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [laps, setLaps] = useState(null);           // null = not fetched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load status + catalogs once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, c, t] = await Promise.all([
          axios.get(`${apiUrl}/garage61/status`),
          axios.get(`${apiUrl}/garage61/cars`),
          axios.get(`${apiUrl}/garage61/tracks`),
        ]);
        if (cancelled) return;
        setStatus(s.data);
        setG61Cars(c.data.items ?? []);
        setG61Tracks(t.data.items ?? []);
      } catch (err) {
        if (!cancelled) {
          setStatus({
            connected: false,
            detail: err.response?.data?.detail || 'Backend unreachable',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);

  // Auto-select the Garage 61 car matching the app's selected car
  useEffect(() => {
    if (!g61Cars.length || !car.g61Match) return;
    const match = g61Cars.find((c) =>
      c.name.toLowerCase().includes(car.g61Match.toLowerCase())
    );
    if (match) setSelectedCarId(String(match.id));
  }, [g61Cars, car.g61Match]);

  const sortedTracks = useMemo(
    () => [...g61Tracks].sort((a, b) =>
      `${a.name} ${a.variant}`.localeCompare(`${b.name} ${b.variant}`)
    ),
    [g61Tracks]
  );

  const fetchLaps = async () => {
    if (!selectedCarId || !selectedTrackId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${apiUrl}/garage61/laps`, {
        params: { cars: selectedCarId, tracks: selectedTrackId, limit: 25 },
      });
      setLaps(data.items ?? []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch laps');
      setLaps(null);
    } finally {
      setLoading(false);
    }
  };

  if (status && !status.connected) {
    return (
      <div className="reference-laps">
        <div className="empty-state">
          <p>Garage 61 is not connected.</p>
          <p className="reference-hint">{status.detail}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reference-laps">
      <section className="input-section">
        <div className="reference-header">
          <h2 className="section-title">Reference Laps — Garage 61</h2>
          {status?.connected && (
            <span className="reference-account">
              {status.name}{status.teams?.length ? ` · ${status.teams.join(', ')}` : ''}
            </span>
          )}
        </div>

        <div className="reference-controls">
          <div className="select-row">
            <label className="input-label">Car (iRacing equivalent)</label>
            <select
              className="input-select"
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
            >
              <option value="">Select a car…</option>
              {g61Cars.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="select-row">
            <label className="input-label">Track</label>
            <select
              className="input-select"
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
            >
              <option value="">Select a track…</option>
              {sortedTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.variant ? ` — ${t.variant}` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="analyze-button reference-fetch"
            onClick={fetchLaps}
            disabled={loading || !selectedCarId || !selectedTrackId}
          >
            {loading ? 'Fetching…' : 'Fetch laps'}
          </button>
        </div>

        {error && <p className="identify-result err">{error}</p>}

        {laps !== null && !error && (
          laps.length === 0 ? (
            <div className="empty-state">
              <p>No laps yet for this car/track combination.</p>
              <p className="reference-hint">
                Garage 61 shows laps from you and your team. Install the
                Garage 61 Agent, drive a session in iRacing, and your laps
                will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="reference-table-wrap">
              <table className="reference-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Driver</th>
                    <th>Lap Time</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {laps.map((lap, i) => (
                    <tr key={lap.id ?? i}>
                      <td>{i + 1}</td>
                      <td>{lapDriver(lap)}</td>
                      <td className="reference-time">{formatLapTime(lapTime(lap))}</td>
                      <td>{lapDate(lap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    </div>
  );
}
