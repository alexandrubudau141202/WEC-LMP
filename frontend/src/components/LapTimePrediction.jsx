import React, { useMemo, useState } from 'react';
import { predictLapTime, rearWingSweep, formatLapTime } from '../laptimeModel';

// SVG sweep chart geometry (viewBox units)
const CHART_W = 260;
const CHART_H = 88;
const PAD = { top: 8, right: 10, bottom: 16, left: 10 };

export default function LapTimePrediction({ carClass, setup, conditions, track }) {
  const baseLapS = track?.baseLapS ?? null;

  const prediction = useMemo(
    () => predictLapTime(carClass, setup, conditions, baseLapS),
    [carClass, setup, conditions, baseLapS]
  );

  const sweep = useMemo(
    () => rearWingSweep(carClass, setup, conditions, baseLapS),
    [carClass, setup, conditions, baseLapS]
  );

  const { totalSeconds, deltaVsBaseline, contributions } = prediction;

  // Diverging bar scale: symmetric around zero, min ±0.3s so tiny
  // deltas don't fill the track
  const maxAbs = Math.max(0.3, ...contributions.map((c) => Math.abs(c.delta)));

  const delta = deltaVsBaseline;
  const deltaClass = delta > 0.005 ? 'slower' : delta < -0.005 ? 'faster' : 'neutral';
  const deltaText =
    deltaClass === 'neutral'
      ? '±0.00s vs baseline'
      : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}s vs baseline`;

  // ── Sweep chart scales ──────────────────────────────────────────────
  const xMin = sweep[0].wing;
  const xMax = sweep[sweep.length - 1].wing;
  const yLo = Math.min(...sweep.map((p) => p.seconds));
  const yHi = Math.max(...sweep.map((p) => p.seconds));
  const ySpan = Math.max(yHi - yLo, 0.2);

  const xPos = (wing) =>
    PAD.left + ((wing - xMin) / (xMax - xMin)) * (CHART_W - PAD.left - PAD.right);
  // More seconds = higher on the chart, so the curve reads as a valley
  // with the fastest wing angle at the bottom
  const yPos = (s) =>
    PAD.top + ((yHi - s) / ySpan) * (CHART_H - PAD.top - PAD.bottom);

  const linePath = sweep
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xPos(p.wing).toFixed(1)},${yPos(p.seconds).toFixed(1)}`)
    .join(' ');

  const fastest = sweep.reduce((a, b) => (b.seconds < a.seconds ? b : a));
  const currentWing = Math.min(Math.max(setup.rear_wing_angle_deg, xMin), xMax);
  const currentPoint =
    sweep.reduce((a, b) =>
      Math.abs(b.wing - currentWing) < Math.abs(a.wing - currentWing) ? b : a
    );

  // Crosshair + tooltip on hover
  const [hover, setHover] = useState(null);
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const wing = xMin + frac * (xMax - xMin);
    const point = sweep.reduce((a, b) =>
      Math.abs(b.wing - wing) < Math.abs(a.wing - wing) ? b : a
    );
    setHover({ point, leftFrac: xPos(point.wing) / CHART_W });
  };

  return (
    <section className="input-section lap-prediction">
      <h2 className="section-title">
        <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Lap Time Prediction
      </h2>

      {/* Hero stat */}
      <div className="ltp-hero">
        <div className="ltp-hero-label">
          Predicted lap · {track?.name ?? 'reference circuit'}
        </div>
        <div className="ltp-hero-row">
          <span className="ltp-hero-value">{formatLapTime(totalSeconds)}</span>
          <span className={`ltp-delta ${deltaClass}`}>
            {deltaClass !== 'neutral' && (
              <svg viewBox="0 0 8 8" aria-hidden="true">
                {deltaClass === 'slower'
                  ? <path d="M4 1l3.2 5.4H0.8z" fill="currentColor" />
                  : <path d="M4 7L0.8 1.6h6.4z" fill="currentColor" />}
              </svg>
            )}
            {deltaText}
          </span>
        </div>
      </div>

      {/* Diverging contribution bars */}
      <div className="ltp-block">
        <h3 className="subsection-title">Time cost by setup group (s)</h3>
        <div className="ltp-bars">
          {contributions.map((c) => {
            const frac = Math.min(Math.abs(c.delta) / maxAbs, 1);
            const side = c.delta > 0.0005 ? 'slower' : c.delta < -0.0005 ? 'faster' : 'zero';
            return (
              <div
                className="ltp-bar-row"
                key={c.key}
                title={`${c.label}: ${c.delta >= 0 ? '+' : '−'}${Math.abs(c.delta).toFixed(3)}s vs baseline`}
              >
                <span className="ltp-bar-label">{c.label}</span>
                <span className="ltp-bar-track">
                  <span className="ltp-bar-axis" />
                  {side !== 'zero' && (
                    <span
                      className={`ltp-bar ${side}`}
                      style={{ width: `${Math.max(frac * 50, 1.5)}%` }}
                    />
                  )}
                </span>
                <span className={`ltp-bar-value ${side}`}>
                  {side === 'zero' ? '0.00' : `${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta).toFixed(2)}`}
                </span>
              </div>
            );
          })}
        </div>
        <div className="ltp-bars-scale">
          <span>−{maxAbs.toFixed(1)}s faster</span>
          <span>slower +{maxAbs.toFixed(1)}s</span>
        </div>
      </div>

      {/* Rear wing sensitivity curve */}
      <div className="ltp-block">
        <h3 className="subsection-title">
          Rear wing sensitivity
          <span className="ltp-hint">fastest ≈ {fastest.wing}°</span>
        </h3>
        <div
          className="ltp-sweep"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img"
            aria-label={`Predicted lap time versus rear wing angle, ${xMin} to ${xMax} degrees`}>
            {/* recessive grid */}
            <line x1={PAD.left} y1={CHART_H - PAD.bottom} x2={CHART_W - PAD.right} y2={CHART_H - PAD.bottom}
              className="ltp-grid-baseline" />
            <line x1={PAD.left} y1={PAD.top} x2={CHART_W - PAD.right} y2={PAD.top}
              className="ltp-grid-line" />

            {hover && (
              <line
                x1={xPos(hover.point.wing)} y1={PAD.top}
                x2={xPos(hover.point.wing)} y2={CHART_H - PAD.bottom}
                className="ltp-crosshair"
              />
            )}

            <path d={linePath} className="ltp-sweep-line" />

            {/* fastest point: open marker */}
            <circle cx={xPos(fastest.wing)} cy={yPos(fastest.seconds)} r="3"
              className="ltp-marker-fastest" />

            {/* current setting: filled marker with surface ring */}
            <circle cx={xPos(currentPoint.wing)} cy={yPos(currentPoint.seconds)} r="4.5"
              className="ltp-marker-current" />

            <text x={PAD.left} y={CHART_H - 4} className="ltp-axis-text">{xMin}°</text>
            <text x={CHART_W - PAD.right} y={CHART_H - 4} className="ltp-axis-text" textAnchor="end">{xMax}°</text>
          </svg>

          {hover && (
            <div
              className="ltp-tooltip"
              style={{ left: `${hover.leftFrac * 100}%` }}
            >
              {hover.point.wing}° · {formatLapTime(hover.point.seconds)}
            </div>
          )}
        </div>
        <p className="ltp-caption">
          Predicted lap vs rear wing angle, rest of setup held. ● current setting.
        </p>
      </div>
    </section>
  );
}
