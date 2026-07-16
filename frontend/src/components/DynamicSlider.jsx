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
  
  // Calculate color based on value (DTM dark palette: red fill for plain
  // sliders; amber/blue for zero-centered feedback sliders)
  const getSliderColor = () => {
    if (!centerZero) {
      return 'var(--accent-primary)';
    }

    if (value > 0) {
      return '#fbbf24'; // amber — positive side
    } else if (value < 0) {
      return '#60a5fa'; // blue — negative side
    } else {
      return 'rgba(255, 255, 255, 0.35)'; // neutral at zero
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
  
  // Create gradient for slider track (dark theme: unfilled = white/12 hairline)
  const unfilled = 'rgba(255, 255, 255, 0.12)';
  const trackGradient = `linear-gradient(to right,
    ${centerZero ? unfilled : sliderColor} 0%,
    ${sliderColor} ${fillPercentage}%,
    ${unfilled} ${fillPercentage}%,
    ${unfilled} 100%)`;
  
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