"""
WEC LMP Diagnostic Assistant - FastAPI Server
==============================================

REST API for LMP Hypercar setup diagnostics.

Author: Alexandru
Version: 1.0
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import DiagnosticRequest, Diagnosis, HealthCheck
from diagnostic_engine import diagnostic_engine
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
        return diagnosis
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Diagnostic engine error: {str(e)}"
        )


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