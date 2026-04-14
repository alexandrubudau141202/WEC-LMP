# WEC LMP Hypercar Diagnostic Assistant

**AI-Powered Setup Analysis** • Porsche 963 • WEC / IMSA

Professional trackside diagnostic tool for LMP Hypercar setup optimization.

## Overview

Real-time setup analysis system that correlates driver feedback, car setup, and track conditions to provide AI-powered recommendations for LMP Hypercars (Porsche 963, Ferrari 499P, Toyota GR010, Cadillac V-Series.R).

**Built for:** MTS Data Acquisition Technician Course Application  
**Target Role:** WEC Data Engineer  
**Version:** 1.0 - Pre-book baseline, iterating with technical references

## Features

### Setup Analysis
- **Ride height sensitivity** (front/rear, aero platform optimization)
- **Aero balance** (wing angles, diffuser efficiency)
- **Hybrid deployment strategy** (MGU-K integration with handling)
- **Brake bias optimization** (weight transfer, hybrid regen interaction)
- **Tire pressure management** (contact patch, endurance consistency)

### AI Diagnosis Engine
- Driver feedback interpretation (understeer, oversteer, instability patterns)
- Multi-parameter correlation (setup → handling characteristics)
- Severity scoring and confidence levels
- Prioritized recommendation list

### 3D Visualization
- Interactive Porsche 963 model
- Heatmap overlay for problem areas (planned)
- Setup change visualization

## Tech Stack

**Backend:**
- Python 3.10+
- FastAPI (REST API)
- Pydantic (data validation)
- NumPy/SciPy (physics calculations)

**Frontend:**
- React 18
- Three.js / React Three Fiber (3D model)
- Tailwind CSS (styling)
- Vite (build tool)

## Project Structure

```
wec-lmp-diagnostic/
├── backend/
│   ├── main.py                 # FastAPI server
│   ├── diagnostic_engine.py    # LMP diagnostic logic
│   ├── models.py               # Pydantic data models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main application
│   │   ├── components/
│   │   │   ├── SetupInputs.jsx
│   │   │   ├── DiagnosisReport.jsx
│   │   │   └── ModelViewer.jsx
│   │   └── main.jsx
│   ├── public/
│   │   └── porsche_963.glb    # 3D model (you provide)
│   ├── package.json
│   └── index.html
└── README.md
```

## Installation

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs on: `http://localhost:8000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

## Usage

1. **Input Setup:** Adjust sliders for current car configuration
2. **Driver Feedback:** Describe handling issue (understeer/oversteer/instability)
3. **Track Conditions:** Set ambient temp, fuel load, stint number
4. **Analyze:** AI generates diagnosis and prioritized recommendations
5. **Iterate:** Apply changes and re-test

## Diagnostic Rules (v1.0)

Current implementation uses physics-based heuristics:
- Ride height → aero balance sensitivity
- Fuel load → weight distribution changes
- Hybrid deployment → traction control interaction
- Tire pressure → contact patch compliance

**Planned improvements** (after reading books):
- Chapter 2 (Aero): Refined underbody/diffuser sensitivity
- Chapter 4 (Suspension): Roll center effects, kinematics
- Chapter 5 (Hybrid): MGU-K deployment impact on balance
- Chapter 9 (Data): Telemetry correlation patterns
- Chapter 10 (Performance): Endurance-specific tradeoffs

## API Endpoints

**POST /diagnose**
```json
{
  "setup": {
    "front_ride_height_mm": 45,
    "rear_ride_height_mm": 50,
    "front_wing_angle_deg": 8,
    "rear_wing_angle_deg": 15,
    "brake_bias_percent": 52,
    "hybrid_deployment_map": 1,
    "tire_pressure": {"fl": 1.8, "fr": 1.8, "rl": 1.9, "rr": 1.9}
  },
  "driver_feedback": {
    "understeer": 0,
    "oversteer": 0,
    "brake_stability": 0,
    "hybrid_feel": 0
  },
  "conditions": {
    "track_temp_c": 35,
    "fuel_load_kg": 60,
    "stint_lap": 15
  }
}
```

**Response:**
```json
{
  "diagnosis": {
    "primary_issue": "mid_corner_understeer",
    "severity": "medium",
    "confidence": 0.75
  },
  "recommendations": [
    {
      "action": "reduce_front_ride_height",
      "change": "-2mm",
      "rationale": "Increase front downforce"
    }
  ]
}
```

## Development Roadmap

**Phase 1 (Current):** Physics-based diagnostic rules  
**Phase 2 (After books):** Refined LMP-specific physics from technical references  
**Phase 3:** Telemetry data integration (actual sensor streams)  
**Phase 4:** Machine learning model trained on real setup changes  

## Why This Tool

Demonstrates three critical skills for WEC Data Engineer:

1. **Domain expertise:** Understanding LMP Hypercar setup parameters
2. **AI/Data skills:** Building intelligent decision support systems
3. **Engineering mindset:** Translating driver feedback → quantified changes

At Le Mans, Data Engineers don't just read sensors — they help Performance Engineers make split-second setup decisions during 24-hour races. This tool simulates that workflow.

## Technical References

- *Le Mans Prototype Engineering* - Chapters 2, 4, 5, 9, 10
- *GT3 Race Car Engineering* - Comparative analysis
- WEC Hypercar Technical Regulations 2024-2026
- Previous GT3 diagnostic tool (proven architecture)

## License

MIT

## Contact

Alexandru Budau - Aspiring WEC Data Engineer  
Applying to: MTS Data Acquisition Technician Course (November 2026)  
Portfolio: WEC Telemetry Strategy Dashboard + LMP Diagnostic Assistant