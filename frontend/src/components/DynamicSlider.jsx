import React from 'react';

export default function DynamicSlider({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  unit,
  onChange,
  centerZero = false  // If true, 0 is neutral, +/- values change color
}) {
  
  // Calculate color based on value (minimal palette: graphite fill for
  // plain sliders; muted amber/blue for zero-centered feedback sliders)
  const getSliderColor = () => {
    if (!centerZero) {
      return 'var(--accent-primary)';
    }

    if (value > 0) {
      return '#b45309'; // muted amber — positive side
    } else if (value < 0) {
      return '#1d4ed8'; // muted blue — negative side
    } else {
      return '#b3b3ad'; // neutral at zero
    }
  };
  
  // Calculate fill percentage
  const getFillPercentage = () => {
    if (!centerZero) {
      return ((value - min) / (max - min)) * 100;
    } else {
      // For zero-centered, calculate from center
      const range = max - min;
      return ((value - min) / range) * 100;
    }
  };
  
  const sliderColor = getSliderColor();
  const fillPercentage = getFillPercentage();
  
  // Create gradient for slider track (light theme: unfilled = hairline gray)
  const trackGradient = `linear-gradient(to right,
    ${centerZero ? '#e7e7e4' : sliderColor} 0%,
    ${sliderColor} ${fillPercentage}%,
    #e7e7e4 ${fillPercentage}%,
    #e7e7e4 100%)`;
  
  return (
    <div className="dynamic-slider-container">
      <label className="input-label">
        {label}
        <span className="input-value" style={{ color: sliderColor }}>
          {value}{unit}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="dynamic-slider"
        style={{
          background: trackGradient
        }}
      />
    </div>
  );
}