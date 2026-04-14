import React from 'react';
import DynamicSlider from './DynamicSlider';

export default function SetupInputs({ setup, feedback, conditions, onSetupChange, onFeedbackChange, onConditionsChange }) {
  
  const updateSetup = (field, value) => {
    onSetupChange({ ...setup, [field]: value });
  };
  
  const updateTirePressure = (corner, value) => {
    onSetupChange({
      ...setup,
      tire_pressure: { ...setup.tire_pressure, [corner]: value }
    });
  };
  
  const updateFeedback = (field, value) => {
    onFeedbackChange({ ...feedback, [field]: value });
  };
  
  const updateConditions = (field, value) => {
    onConditionsChange({ ...conditions, [field]: value });
  };
  
  return (
    <div className="setup-inputs">
      
      {/* Car Setup Section */}
      <section className="input-section">
        <h2 className="section-title">
          <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Car Setup
        </h2>
        
        {/* Ride Height */}
        <DynamicSlider
          label="Front Ride Height"
          value={setup.front_ride_height_mm}
          min={35}
          max={60}
          step={0.5}
          unit=" mm"
          onChange={(val) => updateSetup('front_ride_height_mm', val)}
          centerZero={false}
        />
        
        <DynamicSlider
          label="Rear Ride Height"
          value={setup.rear_ride_height_mm}
          min={40}
          max={70}
          step={0.5}
          unit=" mm"
          onChange={(val) => updateSetup('rear_ride_height_mm', val)}
          centerZero={false}
        />
        
        {/* Wing Angles */}
        <DynamicSlider
          label="Front Wing"
          value={setup.front_wing_angle_deg}
          min={5}
          max={15}
          step={0.5}
          unit="°"
          onChange={(val) => updateSetup('front_wing_angle_deg', val)}
          centerZero={false}
        />
        
        <DynamicSlider
          label="Rear Wing"
          value={setup.rear_wing_angle_deg}
          min={10}
          max={25}
          step={0.5}
          unit="°"
          onChange={(val) => updateSetup('rear_wing_angle_deg', val)}
          centerZero={false}
        />
        
        {/* Brake Bias */}
        <DynamicSlider
          label="Brake Bias"
          value={setup.brake_bias_percent}
          min={45}
          max={60}
          step={1}
          unit="%"
          onChange={(val) => updateSetup('brake_bias_percent', val)}
          centerZero={false}
        />
        
        {/* Hybrid Deployment */}
        <div className="input-row">
          <label className="input-label">
            Hybrid Deployment
            <span className="input-value">
              {setup.hybrid_deployment_map === 1 ? 'CONSERVATIVE' : 
               setup.hybrid_deployment_map === 2 ? 'BALANCED' : 'AGGRESSIVE'}
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="3"
            step="1"
            value={setup.hybrid_deployment_map}
            onChange={(e) => updateSetup('hybrid_deployment_map', parseInt(e.target.value))}
            className="input-slider"
          />
        </div>
        
        {/* Tire Pressures */}
        <div className="tire-pressures">
          <h3 className="subsection-title">Tire Pressures (bar)</h3>
          <div className="tire-grid">
            <div className="tire-input">
              <label>FL</label>
              <input
                type="number"
                min="1.5"
                max="2.5"
                step="0.1"
                value={setup.tire_pressure.fl}
                onChange={(e) => updateTirePressure('fl', parseFloat(e.target.value))}
                className="tire-number-input"
              />
            </div>
            <div className="tire-input">
              <label>FR</label>
              <input
                type="number"
                min="1.5"
                max="2.5"
                step="0.1"
                value={setup.tire_pressure.fr}
                onChange={(e) => updateTirePressure('fr', parseFloat(e.target.value))}
                className="tire-number-input"
              />
            </div>
            <div className="tire-input">
              <label>RL</label>
              <input
                type="number"
                min="1.5"
                max="2.5"
                step="0.1"
                value={setup.tire_pressure.rl}
                onChange={(e) => updateTirePressure('rl', parseFloat(e.target.value))}
                className="tire-number-input"
              />
            </div>
            <div className="tire-input">
              <label>RR</label>
              <input
                type="number"
                min="1.5"
                max="2.5"
                step="0.1"
                value={setup.tire_pressure.rr}
                onChange={(e) => updateTirePressure('rr', parseFloat(e.target.value))}
                className="tire-number-input"
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Driver Feedback Section */}
      <section className="input-section">
        <h2 className="section-title">
          <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Driver Feedback
        </h2>
        
        <DynamicSlider
          label="Understeer"
          value={feedback.understeer}
          min={-5}
          max={5}
          step={1}
          unit=""
          onChange={(val) => updateFeedback('understeer', val)}
          centerZero={true}
        />
        <div className="slider-labels">
          <span>-5 Oversteer</span>
          <span>+5 Understeer</span>
        </div>
        
        <DynamicSlider
          label="Brake Stability"
          value={feedback.brake_stability}
          min={-5}
          max={5}
          step={1}
          unit=""
          onChange={(val) => updateFeedback('brake_stability', val)}
          centerZero={true}
        />
        <div className="slider-labels">
          <span>-5 Rear Unstable</span>
          <span>+5 Front Unstable</span>
        </div>
        
        <DynamicSlider
          label="Hybrid Feel"
          value={feedback.hybrid_feel}
          min={-5}
          max={5}
          step={1}
          unit=""
          onChange={(val) => updateFeedback('hybrid_feel', val)}
          centerZero={true}
        />
        <div className="slider-labels">
          <span>-5 Too Soft</span>
          <span>+5 Too Aggressive</span>
        </div>
        
        <div className="select-row">
          <label className="input-label">Corner Phase</label>
          <select
            value={feedback.corner_phase}
            onChange={(e) => updateFeedback('corner_phase', e.target.value)}
            className="input-select"
          >
            <option value="all">All Phases</option>
            <option value="entry">Entry</option>
            <option value="mid">Mid-Corner</option>
            <option value="exit">Exit</option>
          </select>
        </div>
      </section>
      
      {/* Track Conditions Section */}
      <section className="input-section">
        <h2 className="section-title">
          <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          Track Conditions
        </h2>
        
        <DynamicSlider
          label="Track Temperature"
          value={conditions.track_temp_c}
          min={10}
          max={60}
          step={1}
          unit="°C"
          onChange={(val) => updateConditions('track_temp_c', val)}
          centerZero={false}
        />
        
        <DynamicSlider
          label="Fuel Load"
          value={conditions.fuel_load_kg}
          min={20}
          max={90}
          step={5}
          unit=" kg"
          onChange={(val) => updateConditions('fuel_load_kg', val)}
          centerZero={false}
        />
        
        <DynamicSlider
          label="Stint Lap"
          value={conditions.stint_lap}
          min={1}
          max={60}
          step={1}
          unit=""
          onChange={(val) => updateConditions('stint_lap', val)}
          centerZero={false}
        />
        
        <div className="select-row">
          <label className="input-label">Time of Day</label>
          <select
            value={conditions.time_of_day}
            onChange={(e) => updateConditions('time_of_day', e.target.value)}
            className="input-select"
          >
            <option value="day">Day</option>
            <option value="dusk">Dusk</option>
            <option value="night">Night</option>
            <option value="dawn">Dawn</option>
          </select>
        </div>
      </section>
      
    </div>
  );
}