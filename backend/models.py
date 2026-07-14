"""
Data models for WEC LMP Diagnostic Assistant
=============================================

Pydantic models for request/response validation.

Author: Alexandru
Version: 1.0
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Literal, Optional
from enum import Enum


CarClass = Literal["hypercar", "lmp2", "gt3"]


class TirePressure(BaseModel):
    """Tire pressures in bar"""
    fl: float = Field(ge=1.5, le=2.5, description="Front left tire pressure (bar)")
    fr: float = Field(ge=1.5, le=2.5, description="Front right tire pressure (bar)")
    rl: float = Field(ge=1.5, le=2.5, description="Rear left tire pressure (bar)")
    rr: float = Field(ge=1.5, le=2.5, description="Rear right tire pressure (bar)")


class Setup(BaseModel):
    """LMP Hypercar setup configuration"""
    front_ride_height_mm: float = Field(ge=35, le=60, description="Front ride height (mm)")
    rear_ride_height_mm: float = Field(ge=40, le=70, description="Rear ride height (mm)")
    front_wing_angle_deg: float = Field(ge=5, le=15, description="Front wing angle (degrees)")
    rear_wing_angle_deg: float = Field(ge=10, le=25, description="Rear wing angle (degrees)")
    brake_bias_percent: float = Field(ge=45, le=60, description="Brake bias % front")
    hybrid_deployment_map: int = Field(ge=1, le=3, description="Hybrid deployment aggressiveness (1-3, hypercar only)")
    tire_pressure: TirePressure

    # Advanced setup (optional — defaults keep older clients working)
    coast_diff_percent: float = Field(
        default=40, ge=10, le=90,
        description="Differential coast-side lock % (lower = more lift-off rotation)"
    )
    rear_camber_deg: float = Field(
        default=-3.0, ge=-5.0, le=0.0,
        description="Rear camber (degrees, negative improves cornering grip)"
    )
    front_wheel_rate_nmm: float = Field(
        default=200, ge=100, le=400,
        description="Front wheel rate (N/mm, higher = stiffer)"
    )
    rear_wheel_rate_nmm: float = Field(
        default=180, ge=100, le=400,
        description="Rear wheel rate (N/mm, higher = stiffer)"
    )
    final_drive_ratio: float = Field(
        default=3.6, ge=2.8, le=4.8,
        description="Final drive ratio (higher = shorter gearing, more acceleration)"
    )


class DriverFeedback(BaseModel):
    """Driver handling feedback"""
    understeer: int = Field(ge=-5, le=5, description="Understeer severity (-5 to +5)")
    oversteer: int = Field(ge=-5, le=5, description="Oversteer severity (-5 to +5)")
    brake_stability: int = Field(ge=-5, le=5, description="Brake stability (-5 to +5)")
    hybrid_feel: int = Field(ge=-5, le=5, description="Hybrid deployment feel (-5 to +5)")
    corner_phase: Literal["entry", "mid", "exit", "all"] = Field(default="all", description="When issue occurs")
    speed_range: Literal["low", "medium", "high", "all"] = Field(default="all", description="Speed range")


class TrackConditions(BaseModel):
    """Track and environmental conditions"""
    track_temp_c: float = Field(ge=10, le=60, description="Track temperature (°C)")
    fuel_load_kg: float = Field(ge=20, le=90, description="Current fuel load (kg)")
    stint_lap: int = Field(ge=1, le=60, description="Current lap in stint")
    time_of_day: Literal["day", "night", "dawn", "dusk"] = Field(default="day")
    track_type: Literal["high_speed", "technical", "mixed"] = Field(
        default="mixed",
        description="Track character: long straights (Monza/Vallelunga), rhythm sections (Imola), or mixed"
    )
    session_type: Literal["race", "hotlap"] = Field(
        default="race",
        description="Race stint (endurance tradeoffs) or hotlap/qualifying (peak pace)"
    )


class DiagnosticRequest(BaseModel):
    """Complete diagnostic request"""
    car_class: CarClass = Field(default="hypercar", description="Car category being analyzed")
    car_name: Optional[str] = Field(
        default=None, max_length=80,
        description="Specific car model (e.g. 'Ferrari 499P') for the AI debrief"
    )
    setup: Setup
    driver_feedback: DriverFeedback
    conditions: TrackConditions


class Recommendation(BaseModel):
    """Single setup recommendation"""
    priority: int = Field(description="Priority rank (1 = highest)")
    parameter: str = Field(description="Parameter to change")
    change: str = Field(description="Recommended change with units")
    rationale: str = Field(description="Why this change helps")
    expected_impact: str = Field(description="Expected handling improvement")


class Diagnosis(BaseModel):
    """Diagnostic result"""
    primary_issue: str = Field(description="Main handling issue identified")
    severity: Literal["low", "medium", "high"] = Field(description="Issue severity")
    confidence: float = Field(ge=0, le=1, description="Diagnostic confidence (0-1)")
    contributing_factors: List[str] = Field(description="Additional factors")
    recommendations: List[Recommendation]
    executive_summary: str = Field(description="One-line summary for engineer")
    ai_analysis: Optional[str] = Field(
        default=None,
        description="Claude-written engineering debrief; null when the AI layer is unavailable"
    )


class SimulateRequest(BaseModel):
    """Request to simulate one stint on a track"""
    car_class: CarClass = Field(default="hypercar")
    car_name: Optional[str] = Field(default=None, max_length=80)
    track_id: str = Field(max_length=40, description="Track id (telemetry CSV basename)")
    laps: int = Field(default=15, ge=3, le=40, description="Stint length in laps")
    setup: Setup
    conditions: TrackConditions


class StintLap(BaseModel):
    """Per-lap summary of a simulated stint"""
    lap: int
    lap_time_s: float
    avg_speed_kmh: float
    max_speed_kmh: float
    fuel_remaining_kg: float


class SimulationResult(BaseModel):
    """Simulated stint: per-lap summary + downloadable CSV telemetry"""
    track_id: str
    track_name: str
    car_class: CarClass
    car_name: Optional[str]
    laps: List[StintLap]
    best_lap_s: float
    csv: str = Field(description="Telemetry CSV (same schema as telemetry/*.csv)")
    filename: str


class TelemetrySummaryRequest(BaseModel):
    """Frontend-computed telemetry report to summarize with the AI layer"""
    report: Dict = Field(description="The report object built by the Telemetry tab")


class TelemetrySummaryResponse(BaseModel):
    summary: Optional[str] = Field(
        default=None,
        description="AI stint debrief; null when the AI layer is unavailable"
    )


class CarIdentification(BaseModel):
    """Result of AI car recognition from a photo"""
    car_class: Literal["hypercar", "lmp2", "gt3", "unknown"] = Field(
        description="Recognized category, or 'unknown' if not identifiable"
    )
    model_name: str = Field(description="Best guess at the specific car model")
    confidence: float = Field(ge=0, le=1, description="Recognition confidence (0-1)")
    reasoning: str = Field(description="One-line explanation of the identification")
    car_id: Optional[str] = Field(
        default=None,
        description="Matching garage entry id when the caller supplied a garage list"
    )


class HealthCheck(BaseModel):
    """API health check response"""
    status: str
    version: str
    diagnostic_engine: str