import React, { useState } from 'react';
import DynamicSlider from './DynamicSlider';

// Collapsible card wrapper so the setup sections don't take over the page
function CollapsibleSection({ title, iconPath, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`input-section collapsible ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="section-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <h2 className="section-title">
          <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
          {title}
        </h2>
        <svg className="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

const GEAR_ICON = "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";
const WRENCH_ICON = "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z";

export default function SetupInputs({ carClass, setup, feedback, conditions, driverInCar, onSetupChange, onFeedbackChange, onConditionsChange, onDriverInCarChange }) {

  const isHybrid = carClass === 'hypercar';

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

      {/* Car Setup Card (collapsible) */}
      <CollapsibleSection title="Car Setup" iconPath={GEAR_ICON} defaultOpen={true}>

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

        {/* Hybrid Deployment — hypercar only */}
        {isHybrid && (
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
        )}

        {/* Tire Pressures */}
        <div className="tire-pressures">
          <h3 className="subsection-title">Tire Pressures (bar)</h3>
          <div className="tire-grid">
            {['fl', 'fr', 'rl', 'rr'].map((corner) => (
              <div className="tire-input" key={corner}>
                <label>{corner.toUpperCase()}</label>
                <input
                  type="number"
                  min="1.5"
                  max="2.5"
                  step="0.1"
                  value={setup.tire_pressure[corner]}
                  onChange={(e) => updateTirePressure(corner, parseFloat(e.target.value))}
                  className="tire-number-input"
                />
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Advanced Setup Card (collapsible, closed by default) */}
      <CollapsibleSection title="Advanced Setup" iconPath={WRENCH_ICON} defaultOpen={false}>

        <DynamicSlider
          label="Coast Diff Lock"
          value={setup.coast_diff_percent}
          min={10}
          max={90}
          step={5}
          unit="%"
          onChange={(val) => updateSetup('coast_diff_percent', val)}
          centerZero={false}
        />
        <div className="slider-labels">
          <span>Open (lift-off rotation)</span>
          <span>Locked (stable entry)</span>
        </div>

        <DynamicSlider
          label="Rear Camber"
          value={setup.rear_camber_deg}
          min={-5}
          max={0}
          step={0.1}
          unit="°"
          onChange={(val) => updateSetup('rear_camber_deg', val)}
          centerZero={false}
        />

        <DynamicSlider
          label="Front Wheel Rate"
          value={setup.front_wheel_rate_nmm}
          min={100}
          max={400}
          step={10}
          unit=" N/mm"
          onChange={(val) => updateSetup('front_wheel_rate_nmm', val)}
          centerZero={false}
        />

        <DynamicSlider
          label="Rear Wheel Rate"
          value={setup.rear_wheel_rate_nmm}
          min={100}
          max={400}
          step={10}
          unit=" N/mm"
          onChange={(val) => updateSetup('rear_wheel_rate_nmm', val)}
          centerZero={false}
        />
        <div className="slider-labels">
          <span>Soft (kerb compliance)</span>
          <span>Stiff (hotlap platform)</span>
        </div>

        <DynamicSlider
          label="Final Drive"
          value={setup.final_drive_ratio}
          min={2.8}
          max={4.8}
          step={0.05}
          unit=""
          onChange={(val) => updateSetup('final_drive_ratio', val)}
          centerZero={false}
        />
        <div className="slider-labels">
          <span>Long (top speed)</span>
          <span>Short (acceleration)</span>
        </div>
      </CollapsibleSection>

      {/* Driver Feedback Section */}
      <section className="input-section">
        <div className="feedback-header">
          <h2 className="section-title">
            <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Driver Feedback
          </h2>
          <label
            className="feel-toggle"
            title="On: a driver was in the car and the feedback below counts. Off: sterile test, no driver feel."
          >
            <span className="feel-toggle-label">
              {driverInCar ? 'Driver in car' : 'Sterile test'}
            </span>
            <input
              type="checkbox"
              checked={driverInCar}
              onChange={(e) => onDriverInCarChange(e.target.checked)}
            />
            <span className="persist-toggle-switch" aria-hidden="true"></span>
          </label>
        </div>

        {!driverInCar && (
          <p className="feedback-sterile-note">
            Sterile test — the car ran without driver feel. The sliders below are
            kept but excluded from the diagnosis until a driver is back in the car.
          </p>
        )}

        <div className={driverInCar ? undefined : 'feedback-disabled'}>
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

        {isHybrid && (
          <>
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
          </>
        )}

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

        <div className="select-row">
          <label className="input-label">Track Type</label>
          <select
            value={conditions.track_type}
            onChange={(e) => updateConditions('track_type', e.target.value)}
            className="input-select"
          >
            <option value="mixed">Mixed</option>
            <option value="high_speed">High Speed (long straights)</option>
            <option value="technical">Technical (rhythm sections)</option>
          </select>
        </div>

        <div className="select-row">
          <label className="input-label">Session</label>
          <select
            value={conditions.session_type}
            onChange={(e) => updateConditions('session_type', e.target.value)}
            className="input-select"
          >
            <option value="race">Race Stint</option>
            <option value="hotlap">Hotlap / Qualifying</option>
          </select>
        </div>

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
