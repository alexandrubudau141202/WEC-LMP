import React, { useRef, useState } from 'react';
import axios from 'axios';

// Thumbnail PICTURES (png/jpg) go in frontend/public/cars/ with these exact
// filenames — until they exist, a styled class-tag placeholder shows instead.
// NOTE: the .glb 3D models are not usable here (an <img> can't render them);
// they are wired into the 3D viewport via ModelViewer.jsx, which switches
// model automatically when you pick a car.
export const CARS = [
  {
    carClass: 'hypercar',
    name: 'Porsche 963',
    category: 'Hypercar (LMDh)',
    image: '/cars/hypercar.png',
    tag: 'HY',
  },
  {
    carClass: 'lmp2',
    name: 'Oreca 07',
    category: 'LMP2',
    image: '/cars/lmp2.png',
    tag: 'P2',
  },
  {
    carClass: 'gt3',
    name: 'Porsche 911 GT3 R',
    category: 'GT3',
    image: '/cars/gt3.png',
    tag: 'GT',
  },
];

function CarImage({ car }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="car-image-placeholder">{car.tag}</div>;
  }
  return (
    <img
      className="car-image"
      src={car.image}
      alt={car.name}
      onError={() => setFailed(true)}
    />
  );
}

export default function CarSelector({ value, onChange, apiUrl }) {
  const fileInputRef = useRef(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState(null); // { ok, text }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    setIdentifying(true);
    setIdentifyResult(null);

    try {
      const form = new FormData();
      form.append('photo', file);
      const { data } = await axios.post(`${apiUrl}/identify-car`, form);

      if (data.car_class === 'unknown') {
        setIdentifyResult({
          ok: false,
          text: `Couldn't identify a race car (${data.reasoning || 'no clear match'})`,
        });
      } else {
        onChange(data.car_class);
        setIdentifyResult({
          ok: true,
          text: `Recognized: ${data.model_name} — ${data.car_class.toUpperCase()} (${Math.round(data.confidence * 100)}%)`,
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
    <div className="car-selector-wrap">
      <div className="car-selector">
        {CARS.map((car) => (
          <button
            key={car.carClass}
            type="button"
            className={`car-option ${value === car.carClass ? 'selected' : ''}`}
            onClick={() => onChange(car.carClass)}
          >
            <CarImage car={car} />
            <div className="car-option-text">
              <span className="car-option-name">{car.name}</span>
              <span className="car-option-category">{car.category}</span>
            </div>
          </button>
        ))}
      </div>

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
