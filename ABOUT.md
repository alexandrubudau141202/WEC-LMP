# EnduranceAi Setups — What This App Does

A trackside setup-engineering assistant for WEC/IMSA endurance racing. You describe a car, a circuit, a setup and how the car felt; the app diagnoses handling problems, predicts lap time, simulates a race stint, and writes AI race-engineer debriefs. It runs locally as a React frontend (Vite, port 5173) talking to a FastAPI backend (port 8000).

## The garage

11 cars across three classes, each with an interactive 3D model (Three.js) and a class-specific physics profile:

- **Hypercar (LMH/LMDh)** — Porsche 963, Ferrari 499P, Cadillac V-Series.R, BMW M Hybrid V8, Aston Martin Valkyrie — hybrid deployment, underbody-dominant aero, rake-sensitive.
- **LMP2** — Oreca 07 spec — no hybrid, corner-speed dependent.
- **GT3/GTE** — 911 GT3 R, 911 RSR, M4 GT3, 296 GT3, R8 LMS — wing-dominant aero, kerb compliance matters.

Ten circuits derived from the telemetry files in `telemetry/`: Monza, Spa, Le Mans, COTA, Fuji, Interlagos, Nürburgring GP, Nürburgring 24h (Nordschleife), Silverstone and Laguna Seca — each with a length, a character (high speed / mixed / technical) and a reference lap.

## The five tabs

**Input Scenario** — the home screen. Pick a car and a track, dial in the setup (ride heights, wings, brake bias, tire pressures, hybrid map, plus advanced: diff, camber, wheel rates, final drive), report driver feedback (understeer/oversteer, brake stability, corner phase) and set conditions (track temp, fuel, stint lap, session type). A **Lap Time Prediction** panel updates live: predicted lap for the selected circuit, a gain/loss bar per setup group, and a rear-wing sensitivity curve. A "driver in car / sterile test" toggle controls whether the feedback sliders count. **Analyze Setup** sends everything to the backend.

**Simulate** — runs a 15-lap stint with the current car/track/setup through the backend simulator (tire warm-up, fuel burn, degradation, setup-dependent pace). Results show best/average lap, a lap-time chart and a lap table, and the stint can be **downloaded as a telemetry CSV** in the same schema as the files in `telemetry/`.

**Results** — the diagnosis report: the primary handling issue with severity and confidence, contributing factors, prioritized setup recommendations, and an **AI engineering debrief** written by an LLM from the engine's computed facts.

**Telemetry** — upload any telemetry CSV (hand-written or simulator-generated): session summary, driver inputs, tire temperature balance, rule-based issue detection, plus an **AI Race Engineer stint debrief**.

**Reference Laps** — real lap times from the Garage 61 API (iRacing data) for the selected car, proxied through the backend so the token stays server-side.

## How the intelligence is layered

1. **Deterministic physics first.** A rule-based diagnostic engine (`backend/diagnostic_engine.py`) is the source of truth for issues and recommendations. The lap-time model (quadratic penalties around track/session-dependent optima) exists twice by design — `frontend/src/laptimeModel.js` for live prediction and `backend/simulator.py` for the stint — sharing constants and anchored to each track's reference lap so they agree.
2. **LLM as communicator, not calculator.** Groq (Llama 3.3 70B; Llama 4 Scout for vision) turns computed results into natural-language debriefs and identifies cars from photos. It never invents numbers, and every AI feature degrades gracefully when `GROQ_API_KEY` is missing.

## Key API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /diagnose` | Setup + feedback + conditions → diagnosis + AI debrief |
| `GET /tracks` / `POST /simulate` | Track list; 15-lap stint → lap summary + telemetry CSV |
| `POST /telemetry-summary` | Analyzed telemetry report → AI stint debrief |
| `POST /identify-car` | Photo → car class/model (vision), auto-selects the garage entry |
| `GET /garage61/*` | Reference-lap proxy (Garage 61) |

## Running it

```bash
cd backend  && pip install -r requirements.txt && python main.py   # :8000 (GROQ_API_KEY in backend/.env)
cd frontend && npm install && npm run dev                          # :5173
```

Setups persist in localStorage (opt-out toggle), and named snapshots with track/temperature notes can be saved, reloaded and deleted.
