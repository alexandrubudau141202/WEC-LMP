import React, { useRef, useState } from 'react';
import axios from 'axios';
import { CAR_REGISTRY, CLASS_LABELS, getCar } from '../cars';

// Garage picker: choose any car from the registry (no manual class filter —
// the class is a property of the car). The AI identify button sends a photo
// plus the garage list to the backend, and the vision model picks the
// matching garage entry automatically.
export default function CarSelector({ carId, onChange, apiUrl }) {
  const fileInputRef = useRef(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState(null); // { ok, text }

  const car = getCar(carId);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    setIdentifying(true);
    setIdentifyResult(null);

    try {
      const form = new FormData();
      form.append('photo', file);
      form.append(
        'garage',
        JSON.stringify(
          CAR_REGISTRY.map(({ id, name, carClass }) => ({ id, name, car_class: carClass }))
        )
      );
      const { data } = await axios.post(`${apiUrl}/identify-car`, form);

      if (data.car_class === 'unknown' || !data.car_id) {
        setIdentifyResult({
          ok: false,
          text: `Couldn't match a garage car (${data.reasoning || 'no clear match'})`,
        });
      } else {
        const matched = getCar(data.car_id);
        onChange(matched.id);
        const exact = matched.name.toLowerCase().includes(
          (data.model_name || '').toLowerCase().slice(0, 6)
        );
        setIdentifyResult({
          ok: true,
          text:
            `Recognized: ${data.model_name} (${Math.round(data.confidence * 100)}%)` +
            (exact ? '' : ` → closest in garage: ${matched.name}`),
        });
      }
    } catch (err) {
      setIdentifyResult({
        ok: false,
        text: err.response?.data?.detail || 'Recognition failed — is the backend running?',
      });
    } finally {
      setIdentifying(false);
    }
  };

  return (
    <div className="car-picker input-section">
      <div className="car-picker-header">
        <div>
          <h2 className="section-title">
            <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h8m-8 5h8m-9 5h10a2 2 0 002-2V7a4 4 0 00-4-4H9a4 4 0 00-4 4v8a2 2 0 002 2z" />
            </svg>
            Car
          </h2>
        </div>
        <span className={`class-badge class-${car.carClass}`}>
          {CLASS_LABELS[car.carClass]}
        </span>
      </div>

      <select
        className="input-select car-select"
        value={car.id}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(CLASS_LABELS).map(([cls, label]) => (
          <optgroup key={cls} label={label}>
            {CAR_REGISTRY.filter((c) => c.carClass === cls).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* AI car recognition from a photo */}
      <div className="car-identify-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhoto}
        />
        <button
          type="button"
          className="identify-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={identifying}
        >
          <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {identifying ? 'Identifying…' : 'Identify from photo (AI)'}
        </button>
        {identifyResult && (
          <p className={`identify-result ${identifyResult.ok ? 'ok' : 'err'}`}>
            {identifyResult.text}
          </p>
        )}
      </div>
    </div>
  );
}
