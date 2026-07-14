import { useState, useEffect } from 'react';
import axios from 'axios';
import SetupInputs from './components/SetupInputs';
import CarSelector from './components/CarSelector';
import TrackSelector from './components/TrackSelector';
import StintSimulator from './components/StintSimulator';
import { DEFAULT_CAR_ID, getCar } from './cars';
import { DEFAULT_TRACK_ID, getTrack } from './tracks';
import DiagnosisReport from './components/DiagnosisReport';
import ModelViewer from './components/ModelViewer';
import TelemetryAnalysis from './components/TelemetryAnalysis';
import SavedSetups from './components/SavedSetups';
import LapTimePrediction from './components/LapTimePrediction';
import ReferenceLaps from './components/ReferenceLaps';
import usePersistentState, { mergeWithDefaults } from './usePersistentState';
import './App.css';

const API_URL = 'http://localhost:8000';

// Defaults for the persisted input state. Stored values are merged over
// these on load, so adding/removing fields here stays backward-compatible
// with whatever an older visit left in localStorage.
const DEFAULT_SETUP = {
  front_ride_height_mm: 45,
  rear_ride_height_mm: 50,
  front_wing_angle_deg: 8,
  rear_wing_angle_deg: 15,
  brake_bias_percent: 52,
  hybrid_deployment_map: 1,
  tire_pressure: { fl: 1.9, fr: 1.9, rl: 1.9, rr: 1.9 },
  // Advanced setup
  coast_diff_percent: 40,
  rear_camber_deg: -3.0,
  front_wheel_rate_nmm: 200,
  rear_wheel_rate_nmm: 180,
  final_drive_ratio: 3.6
};

const DEFAULT_FEEDBACK = {
  understeer: 0,
  oversteer: 0,
  brake_stability: 0,
  hybrid_feel: 0,
  corner_phase: 'all',
  speed_range: 'all'
};

const DEFAULT_CONDITIONS = {
  track_temp_c: 35,
  fuel_load_kg: 60,
  stint_lap: 15,
  time_of_day: 'day',
  track_type: 'mixed',
  session_type: 'race'
};

function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [isOnline, setIsOnline] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Whether input state is saved to localStorage. The preference itself is
  // always remembered so an opt-out sticks across visits.
  const [saveSetups, setSaveSetups] = usePersistentState('wec-lmp:save-setups', true);

  // Selected car (class + physics profile + 3D model derive from the registry).
  // The four input states survive page reloads while saving is enabled.
  const [carId, setCarId] = usePersistentState('wec-lmp:car', DEFAULT_CAR_ID, saveSetups);
  const car = getCar(carId);
  const carClass = car.carClass;

  // Selected track (drives the simulator and the conditions' track character)
  const [trackId, setTrackId] = usePersistentState('wec-lmp:track', DEFAULT_TRACK_ID, saveSetups);

  const [setup, setSetup] = usePersistentState('wec-lmp:setup', DEFAULT_SETUP, saveSetups);
  const [feedback, setFeedback] = usePersistentState('wec-lmp:feedback', DEFAULT_FEEDBACK, saveSetups);

  // Was a driver actually in the car? Off = sterile test: the feedback
  // sliders are hidden and the diagnosis runs on neutral driver feedback.
  const [driverInCar, setDriverInCar] = usePersistentState('wec-lmp:driver-in-car', true, saveSetups);
  const [conditions, setConditions] = usePersistentState('wec-lmp:conditions', DEFAULT_CONDITIONS, saveSetups);

  const toggleSaveSetups = (on) => {
    setSaveSetups(on);
    if (!on) {
      // Opting out also wipes what's already stored — next reload starts clean
      ['wec-lmp:car', 'wec-lmp:track', 'wec-lmp:setup', 'wec-lmp:feedback', 'wec-lmp:conditions', 'wec-lmp:driver-in-car']
        .forEach((key) => localStorage.removeItem(key));
    }
  };

  // Picking a track also aligns the conditions' track character, so the
  // diagnosis, prediction and simulator all reason about the same circuit
  const selectTrack = (track) => {
    setTrackId(track.id);
    if (track.trackType && track.trackType !== conditions.track_type) {
      setConditions({ ...conditions, track_type: track.trackType });
    }
  };

  // Named setup snapshots (car + setup + conditions). Explicit saves, so
  // they persist regardless of the auto-save toggle.
  const [savedSetups, setSavedSetups] = usePersistentState('wec-lmp:saved-setups', []);

  // meta = { name, track, trackTemp, airTemp, dateModified } from the save form
  const saveNamedSetup = (meta) => {
    const entry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ...meta,
      carId,
      setup,
      conditions,
      savedAt: new Date().toISOString(),
    };
    setSavedSetups([entry, ...savedSetups].slice(0, 30)); // newest first, cap at 30
  };

  const loadNamedSetup = (entry) => {
    setCarId(entry.carId); // getCar() falls back if the car left the registry
    // Merge over defaults so presets saved under an older parameter schema
    // still load cleanly after the app gains/loses setup fields
    setSetup(mergeWithDefaults(DEFAULT_SETUP, entry.setup));
    setConditions(mergeWithDefaults(DEFAULT_CONDITIONS, entry.conditions));
  };

  const deleteNamedSetup = (id) => {
    setSavedSetups(savedSetups.filter((s) => s.id !== id));
  };
  
  // Diagnosis result
  const [diagnosis, setDiagnosis] = useState(null);
  
  const checkAPIHealth = async () => {
    try {
      const response = await axios.get(`${API_URL}/health`);
      setIsOnline(response.data.status === 'online');
    } catch (error) {
      setIsOnline(false);
    }
  };
  
  // Check API health on mount
  useEffect(() => {
    checkAPIHealth();
  }, []);
  
  // The rule engine responds in ~1ms; hold the analyzing state long enough
  // that the spinner is actually perceivable
  const MIN_ANALYSIS_MS = 900;

  const analyzeSetup = async () => {
    setIsAnalyzing(true);
    const startedAt = Date.now();

    try {
      const response = await axios.post(`${API_URL}/diagnose`, {
        car_class: carClass,
        car_name: car.name,
        setup,
        // Sterile test (no driver in the car): diagnose on neutral feedback
        driver_feedback: driverInCar ? feedback : DEFAULT_FEEDBACK,
        conditions
      });

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_ANALYSIS_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_ANALYSIS_MS - elapsed));
      }

      setDiagnosis(response.data);
      setActiveTab('results');
    } catch (error) {
      console.error('Diagnosis failed:', error);
      alert('Analysis failed. Make sure the backend is running on port 8000.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h1 className="logo-title">EnduranceAi Setups</h1>
              {/*<p className="logo-subtitle"></p>*/}
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>
          <span className="version">v1.0</span>
        </div>
      </header>
      
      {/* Tab Navigation */}
      <nav className="tab-nav">
        <button
          className={`tab-button ${activeTab === 'input' ? 'active' : ''}`}
          onClick={() => setActiveTab('input')}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Input Scenario
        </button>
        <button
          className={`tab-button ${activeTab === 'simulate' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulate')}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Simulate
        </button>
        <button
          className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={!diagnosis}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Results
        </button>
        <button
          className={`tab-button ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Telemetry
        </button>
        <button
          className={`tab-button ${activeTab === 'reference' ? 'active' : ''}`}
          onClick={() => setActiveTab('reference')}
        >
          <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Reference Laps
        </button>
      </nav>
      
      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'input' ? (
          <div className="input-layout">
            {/* Garage rail: car choice + persistence */}
            <aside className="garage-column">
              <label className="persist-toggle">
                <span className="persist-toggle-label">Remember setup in this browser</span>
                <input
                  type="checkbox"
                  checked={saveSetups}
                  onChange={(e) => toggleSaveSetups(e.target.checked)}
                />
                <span className="persist-toggle-switch" aria-hidden="true"></span>
              </label>

              <CarSelector carId={carId} onChange={setCarId} apiUrl={API_URL} />

              <TrackSelector trackId={trackId} onChange={selectTrack} apiUrl={API_URL} />

              <LapTimePrediction
                carClass={carClass}
                setup={setup}
                conditions={conditions}
                track={getTrack(trackId)}
              />

              <SavedSetups
                setups={savedSetups}
                currentCarName={car.name}
                onSave={saveNamedSetup}
                onLoad={loadNamedSetup}
                onDelete={deleteNamedSetup}
              />
            </aside>

            {/* Center: 3D model stays in view while scrolling, analyze below it */}
            <div className="model-column">
              <div className="model-card">
                <h3 className="model-title">3D Viewport</h3>
                <ModelViewer modelUrl={car.model} label={car.name} />
              </div>

              <button
                className="analyze-button"
                onClick={analyzeSetup}
                disabled={isAnalyzing || !isOnline}
              >
                {isAnalyzing ? (
                  <>
                    <svg className="spinner" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Analyze Setup
                  </>
                )}
              </button>
            </div>

            {/* Setup rail: car setup, feedback, conditions */}
            <div className="setup-column">
              <SetupInputs
                carClass={carClass}
                setup={setup}
                feedback={feedback}
                conditions={conditions}
                driverInCar={driverInCar}
                onSetupChange={setSetup}
                onFeedbackChange={setFeedback}
                onConditionsChange={setConditions}
                onDriverInCarChange={setDriverInCar}
              />
            </div>
          </div>
        ) : activeTab === 'simulate' ? (
          <StintSimulator
            carClass={carClass}
            carName={car.name}
            trackId={trackId}
            setup={setup}
            conditions={conditions}
            apiUrl={API_URL}
            isOnline={isOnline}
          />
        ) : activeTab === 'results' ? (
          <DiagnosisReport diagnosis={diagnosis} />
        ) : activeTab === 'reference' ? (
          <ReferenceLaps apiUrl={API_URL} carId={carId} />
        ) : (
          <TelemetryAnalysis />
        )}
      </main>
    </div>
  );
}

export default App;