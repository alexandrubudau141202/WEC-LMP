import React, { useState } from 'react';
import axios from 'axios';
import { getTrack, TRACK_TYPE_LABELS } from '../tracks';
import { formatLapTime } from '../laptimeModel';

const STINT_LAPS = 15;

// Lap chart geometry (viewBox units)
const CH_W = 640;
const CH_H = 180;
const PAD = { top: 14, right: 16, bottom: 24, left: 46 };

export default function StintSimulator({ carClass, carName, trackId, setup, conditions, apiUrl, isOnline }) {
  const track = getTrack(trackId);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);

  const runStint = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const { data } = await axios.post(`${apiUrl}/simulate`, {
        car_class: carClass,
        car_name: carName,
        track_id: trackId,
        laps: STINT_LAPS,
        setup,
        conditions,
      });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Simulation failed — is the backend running?');
    } finally {
      setIsRunning(false);
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Lap time chart scales ───────────────────────────────────────────
  let chart = null;
  if (result) {
    const laps = result.laps;
    const times = laps.map((l) => l.lap_time_s);
    const yLo = Math.min(...times);
    const yHi = Math.max(...times);
    const ySpan = Math.max(yHi - yLo, 0.4);
    const xPos = (lap) =>
      PAD.left + ((lap - 1) / (laps.length - 1)) * (CH_W - PAD.left - PAD.right);
    const yPos = (s) =>
      PAD.top + ((yHi - s) / ySpan) * (CH_H - PAD.top - PAD.bottom);
    const path = laps
      .map((l, i) => `${i === 0 ? 'M' : 'L'}${xPos(l.lap).toFixed(1)},${yPos(l.lap_time_s).toFixed(1)}`)
      .join(' ');
    chart = { laps, yLo, yHi, xPos, yPos, path };
  }

  const onChartMove = (e) => {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const lap = Math.round(1 + frac * (chart.laps.length - 1));
    const point = chart.laps[Math.min(Math.max(lap - 1, 0), chart.laps.length - 1)];
    setHover(point);
  };

  const fuelUsed = result
    ? (conditions.fuel_load_kg - result.laps[result.laps.length - 1].fuel_remaining_kg).toFixed(1)
    : null;
  const avgLap = result
    ? result.laps.reduce((s, l) => s + l.lap_time_s, 0) / result.laps.length
    : null;
  const topSpeed = result ? Math.max(...result.laps.map((l) => l.max_speed_kmh)) : null;

  return (
    <div className="stint-simulator">
      {/* Run configuration */}
      <section className="report-section">
        <h2 className="report-heading">
          <svg className="heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Stint Simulation
        </h2>

        <div className="stint-config">
          <div className="stint-chip">
            <span className="stint-chip-label">Car</span>
            <span className="stint-chip-value">{carName}</span>
          </div>
          <div className="stint-chip">
            <span className="stint-chip-label">Track</span>
            <span className="stint-chip-value">
              {track.name} · {TRACK_TYPE_LABELS[track.trackType]}
            </span>
          </div>
          <div className="stint-chip">
            <span className="stint-chip-label">Stint</span>
            <span className="stint-chip-value">{STINT_LAPS} laps · {conditions.fuel_load_kg} kg fuel</span>
          </div>
          <div className="stint-chip">
            <span className="stint-chip-label">Track temp</span>
            <span className="stint-chip-value">{conditions.track_temp_c}°C</span>
          </div>
        </div>

        <p className="stint-hint">
          Runs {STINT_LAPS} laps with the setup dialed in on the Input Scenario tab
          (car, track, fuel and temperatures included). Change the setup there to
          simulate a different stint.
        </p>

        <button
          className="analyze-button"
          onClick={runStint}
          disabled={isRunning || !isOnline}
        >
          {isRunning ? (
            <>
              <svg className="spinner" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Running stint…
            </>
          ) : (
            <>
              <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run {STINT_LAPS}-Lap Stint
            </>
          )}
        </button>
        {error && <p className="stint-error">{error}</p>}
      </section>

      {/* Results */}
      {result && (
        <>
          <section className="report-section">
            <div className="stint-result-header">
              <h2 className="report-heading">Stint Result — {result.track_name}</h2>
              <button type="button" className="save-setup-button" onClick={downloadCsv}>
                ⬇ Download {result.filename}
              </button>
            </div>

            <div className="telemetry-grid">
              <div className="metric-card">
                <span className="metric-label">Best Lap</span>
                <span className="metric-value">{formatLapTime(result.best_lap_s)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Avg Lap</span>
                <span className="metric-value">{formatLapTime(avgLap)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Top Speed</span>
                <span className="metric-value">{topSpeed.toFixed(1)} km/h</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Fuel Used</span>
                <span className="metric-value">{fuelUsed} kg</span>
              </div>
            </div>

            <p className="stint-hint">
              Save the CSV, then upload it in the <strong>Telemetry</strong> tab for
              the full analysis and AI debrief.
            </p>
          </section>

          <section className="report-section">
            <h2 className="report-heading">Lap Times</h2>
            <div
              className="stint-chart"
              onMouseMove={onChartMove}
              onMouseLeave={() => setHover(null)}
            >
              <svg viewBox={`0 0 ${CH_W} ${CH_H}`} role="img"
                aria-label={`Lap times across the ${STINT_LAPS}-lap stint`}>
                {/* recessive grid: min/max time hairlines */}
                {[chart.yLo, chart.yHi].map((v) => (
                  <g key={v}>
                    <line x1={PAD.left} y1={chart.yPos(v)} x2={CH_W - PAD.right} y2={chart.yPos(v)}
                      className="ltp-grid-line" />
                    <text x={PAD.left - 6} y={chart.yPos(v) + 3} textAnchor="end" className="ltp-axis-text">
                      {formatLapTime(v)}
                    </text>
                  </g>
                ))}

                {hover && (
                  <line x1={chart.xPos(hover.lap)} y1={PAD.top}
                    x2={chart.xPos(hover.lap)} y2={CH_H - PAD.bottom}
                    className="ltp-crosshair" />
                )}

                <path d={chart.path} className="ltp-sweep-line" />

                {chart.laps.map((l) => (
                  <circle
                    key={l.lap}
                    cx={chart.xPos(l.lap)}
                    cy={chart.yPos(l.lap_time_s)}
                    r={l.lap_time_s === result.best_lap_s ? 4.5 : 3}
                    className={l.lap_time_s === result.best_lap_s ? 'stint-dot-best' : 'stint-dot'}
                  />
                ))}

                {chart.laps.filter((l) => l.lap === 1 || l.lap % 5 === 0).map((l) => (
                  <text key={l.lap} x={chart.xPos(l.lap)} y={CH_H - 8} textAnchor="middle"
                    className="ltp-axis-text">
                    L{l.lap}
                  </text>
                ))}
              </svg>

              {hover && (
                <div className="ltp-tooltip"
                  style={{ left: `${(chart.xPos(hover.lap) / CH_W) * 100}%` }}>
                  Lap {hover.lap} · {formatLapTime(hover.lap_time_s)}
                </div>
              )}
            </div>
            <p className="ltp-caption">
              ● best lap. Early laps carry tire warm-up; late laps gain from fuel
              burn but pay for tire degradation.
            </p>
          </section>

          <section className="report-section">
            <h2 className="report-heading">Lap Table</h2>
            <div className="reference-table-wrap">
              <table className="reference-table">
                <thead>
                  <tr>
                    <th>Lap</th>
                    <th>Time</th>
                    <th>Avg Speed</th>
                    <th>Top Speed</th>
                    <th>Fuel Left</th>
                  </tr>
                </thead>
                <tbody>
                  {result.laps.map((l) => (
                    <tr key={l.lap}>
                      <td>{l.lap}</td>
                      <td className="reference-time">
                        {formatLapTime(l.lap_time_s)}
                        {l.lap_time_s === result.best_lap_s && (
                          <span className="stint-best-tag">best</span>
                        )}
                      </td>
                      <td>{l.avg_speed_kmh} km/h</td>
                      <td>{l.max_speed_kmh} km/h</td>
                      <td>{l.fuel_remaining_kg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
