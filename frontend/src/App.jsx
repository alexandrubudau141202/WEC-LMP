import { useState, useEffect } from 'react';
import axios from 'axios';
import SetupInputs from './components/SetupInputs';
import DiagnosisReport from './components/DiagnosisReport';
import ModelViewer from './components/ModelViewer';
import TelemetryAnalysis from './components/TelemetryAnalysis';
import './App.css';

const API_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [isOnline, setIsOnline] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Setup state
  const [setup, setSetup] = useState({
    front_ride_height_mm: 45,
    rear_ride_height_mm: 50,
    front_wing_angle_deg: 8,
    rear_wing_angle_deg: 15,
    brake_bias_percent: 52,
    hybrid_deployment_map: 1,
    tire_pressure: { fl: 1.9, fr: 1.9, rl: 1.9, rr: 1.9 }
  });
  
  // Driver feedback state
  const [feedback, setFeedback] = useState({
    understeer: 0,
    oversteer: 0,
    brake_stability: 0,
    hybrid_feel: 0,
    corner_phase: 'all',
    speed_range: 'all'
  });
  
  // Track conditions state
  const [conditions, setConditions] = useState({
    track_temp_c: 35,
    fuel_load_kg: 60,
    stint_lap: 15,
    time_of_day: 'day'
  });
  
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
  
  const analyzeSetup = async () => {
    setIsAnalyzing(true);
    
    try {
      const response = await axios.post(`${API_URL}/diagnose`, {
        setup,
        driver_feedback: feedback,
        conditions
      });
      
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
              <h1 className="logo-title">WEC LMP Diagnostic</h1>
              <p className="logo-subtitle">AI-Powered Setup Analysis · Porsche 963 · WEC / IMSA</p>
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
      </nav>
      
      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'input' ? (
          <div className="input-layout">
            {/* Left Column: Inputs */}
            <div className="input-column">
              <SetupInputs
                setup={setup}
                feedback={feedback}
                conditions={conditions}
                onSetupChange={setSetup}
                onFeedbackChange={setFeedback}
                onConditionsChange={setConditions}
              />
              
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
            
            {/* Right Column: 3D Model */}
            <div className="model-column">
              <div className="model-card">
                <h3 className="model-title">3D Viewport</h3>
                <ModelViewer />
              </div>
            </div>
          </div>
        ) : activeTab === 'results' ? (
          <DiagnosisReport diagnosis={diagnosis} />
        ) : (
          <TelemetryAnalysis />
        )}
      </main>
    </div>
  );
}

export default App;