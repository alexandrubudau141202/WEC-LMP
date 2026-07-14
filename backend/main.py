"""
WEC LMP Diagnostic Assistant - FastAPI Server
==============================================

REST API for LMP Hypercar setup diagnostics.

Author: Alexandru
Version: 1.0
"""

from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env (GROQ_API_KEY) regardless of the launch directory
load_dotenv(Path(__file__).parent / ".env")

import base64
import json

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from models import (
    CarIdentification, DiagnosticRequest, Diagnosis, HealthCheck,
    SimulateRequest, SimulationResult, TelemetrySummaryRequest, TelemetrySummaryResponse,
)
from diagnostic_engine import diagnostic_engine
from ai_engineer import generate_ai_analysis, generate_telemetry_summary, identify_car
import garage61
import simulator
import uvicorn


# Initialize FastAPI app
app = FastAPI(
    title="WEC LMP Diagnostic API",
    description="AI-powered setup analysis for LMP Hypercars",
    version="1.0.0"
)

# CORS middleware (allow frontend to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=HealthCheck)
async def root():
    """Health check endpoint"""
    return HealthCheck(
        status="online",
        version="1.0.0",
        diagnostic_engine=diagnostic_engine.version
    )


@app.get("/health", response_model=HealthCheck)
async def health_check():
    """Detailed health check"""
    return HealthCheck(
        status="online",
        version="1.0.0",
        diagnostic_engine=diagnostic_engine.version
    )


@app.post("/diagnose", response_model=Diagnosis)
async def diagnose_setup(request: DiagnosticRequest):
    """
    Analyze LMP Hypercar setup and provide recommendations.
    
    **Parameters:**
    - setup: Current car configuration (ride height, aero, hybrid, tires, brakes)
    - driver_feedback: Handling feedback (understeer, oversteer, stability)
    - conditions: Track temp, fuel load, stint info
    
    **Returns:**
    - Diagnosis with identified issues and prioritized recommendations
    """
    try:
        diagnosis = diagnostic_engine.diagnose(request)

        # AI layer: Claude writes the engineering debrief from the computed
        # diagnosis. Falls back to the template summary when unavailable.
        diagnosis.ai_analysis = await generate_ai_analysis(
            diagnosis,
            request.setup,
            request.driver_feedback,
            request.conditions,
            request.car_class,
            request.car_name,
        )

        return diagnosis
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Diagnostic engine error: {str(e)}"
        )


@app.post("/identify-car", response_model=CarIdentification)
async def identify_car_from_photo(
    photo: UploadFile = File(...),
    garage: str = Form(None),
):
    """
    Recognize the car from an uploaded photo using the AI vision model.

    Optionally pass `garage` — a JSON list of {id, name, car_class} — and the
    response's car_id will name the garage entry that best matches the photo,
    letting the frontend auto-select that exact car and its 3D model.
    """
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image file (JPEG/PNG/WebP)")

    data = await photo.read()
    if len(data) > 3 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image too large (max 3MB) — resize or crop the photo"
        )

    garage_list = None
    if garage:
        try:
            garage_list = [
                {"id": str(c["id"]), "name": str(c["name"]), "car_class": str(c["car_class"])}
                for c in json.loads(garage)
            ][:30]
        except (ValueError, KeyError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="garage must be a JSON list of {id, name, car_class}"
            )

    result = await identify_car(
        base64.standard_b64encode(data).decode("ascii"),
        photo.content_type,
        garage_list,
    )
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="AI recognition unavailable — check GROQ_API_KEY and try again"
        )
    return result


# --- Stint simulation ---------------------------------------------------

@app.get("/tracks")
async def get_tracks():
    """Tracks available for simulation (derived from telemetry/*.csv)."""
    return simulator.list_tracks()


@app.post("/simulate", response_model=SimulationResult)
async def simulate_stint(request: SimulateRequest):
    """
    Simulate one stint with the current car, setup and conditions.

    Returns a per-lap summary plus a telemetry CSV (same schema as the
    files in telemetry/) that can be saved and re-uploaded in the
    Telemetry tab for analysis.
    """
    try:
        return simulator.simulate_stint(
            track_id=request.track_id,
            car_class=request.car_class,
            car_name=request.car_name,
            setup=request.setup,
            conditions=request.conditions,
            laps=request.laps,
        )
    except simulator.SimulatorError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.post("/telemetry-summary", response_model=TelemetrySummaryResponse)
async def telemetry_summary(request: TelemetrySummaryRequest):
    """
    AI race-engineer debrief of an analyzed telemetry session (Groq).
    Returns {summary: null} when the AI layer is unavailable so the
    frontend can degrade gracefully.
    """
    return TelemetrySummaryResponse(
        summary=await generate_telemetry_summary(request.report)
    )


# --- Garage 61 proxy (Reference Laps) ---------------------------------
# The token stays server-side; the frontend only talks to these routes.

@app.get("/garage61/status")
async def garage61_status():
    """Is the Garage 61 integration configured and the token valid?"""
    return await garage61.get_status()


@app.get("/garage61/cars")
async def garage61_cars():
    try:
        return await garage61.get_cars()
    except garage61.Garage61Error as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/garage61/tracks")
async def garage61_tracks():
    try:
        return await garage61.get_tracks()
    except garage61.Garage61Error as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/garage61/laps")
async def garage61_laps(cars: str, tracks: str, limit: int = 20, offset: int = 0):
    """Laps visible to the account (own + team) for a car/track combination."""
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be 1-100")
    try:
        return await garage61.find_laps(cars, tracks, limit, offset)
    except garage61.Garage61Error as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@app.get("/parameters")
async def get_parameter_info():
    """Get valid parameter ranges for frontend"""
    return {
        "ride_height": {
            "front": {"min": 35, "max": 60, "unit": "mm", "typical": 45},
            "rear": {"min": 40, "max": 70, "unit": "mm", "typical": 50}
        },
        "wing_angle": {
            "front": {"min": 5, "max": 15, "unit": "degrees", "typical": 8},
            "rear": {"min": 10, "max": 25, "unit": "degrees", "typical": 15}
        },
        "brake_bias": {"min": 45, "max": 60, "unit": "% front", "typical": 52},
        "hybrid_map": {"min": 1, "max": 3, "options": ["Conservative", "Balanced", "Aggressive"]},
        "tire_pressure": {"min": 1.5, "max": 2.5, "unit": "bar", "typical": 1.9}
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )