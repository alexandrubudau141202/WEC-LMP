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
  
  // Calculate color based on value
  const getSliderColor = () => {
    if (!centerZero) {
      // Normal slider - orange gradient
      return 'var(--accent-primary)';
    }
    
    // Zero-centered slider - color changes with positive/negative
    if (value > 0) {
      // Positive = red/orange intensity
      const intensity = Math.abs(value) / max;
      const r = 255;
      const g = Math.floor(115 * (1 - intensity * 0.5));
      const b = Math.floor(22 * (1 - intensity));
      return `rgb(${r}, ${g}, ${b})`;
    } else if (value < 0) {
      // Negative = blue/cyan
      const intensity = Math.abs(value) / Math.abs(min);
      const r = Math.floor(59 * (1 - intensity * 0.5));
      const g = Math.floor(130 * (1 - intensity * 0.3));
      const b = 255;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Zero = neutral gray
      return '#6b7280';
    }
  };
  
  // Calculate fill percentage
  const getFillPercentage = () => {
    if (!centerZero) {
      return ((value - min) / (max - min)) * 100;
    } else {
      // For zero-centered, calculate from center
      const range = max - min;
      const center = (max + min) / 2;
      return ((value - min) / range) * 100;
    }
  };
  
  const sliderColor = getSliderColor();
  const fillPercentage = getFillPercentage();
  
  // Create gradient for slider track
  const trackGradient = `linear-gradient(to right, 
    ${centerZero ? '#2e2e55' : sliderColor} 0%, 
    ${sliderColor} ${fillPercentage}%, 
    #14142a ${fillPercentage}%, 
    #14142a 100%)`;
  
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