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
    """Car setup configuration (all classes; GT3 uses wing clicks 0-8)"""
    front_ride_height_mm: float = Field(ge=35, le=70, description="Front ride height (mm; GT3 50-70)")
    rear_ride_height_mm: float = Field(ge=40, le=80, description="Rear ride height (mm; GT3 50-80)")
    front_wing_angle_deg: float = Field(ge=5, le=15, description="Front wing angle (degrees, prototypes)")
    rear_wing_angle_deg: float = Field(ge=0, le=25, description="Rear wing: degrees 10-25 (prototypes) or clicks 0-8 (GT3)")
    brake_bias_percent: float = Field(ge=45, le=68.5, description="Brake bias % front (48.5-68.5)")
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
        default=150, ge=90, le=400,
        description="Front wheel rate (N/mm; UI range 105-180 step 15)"
    )
    rear_wheel_rate_nmm: float = Field(
        default=135, ge=90, le=400,
        description="Rear wheel rate (N/mm; UI range 90-165 step 15)"
    )
    final_drive_ratio: float = Field(
        default=3.6, ge=2.8, le=4.8,
        description="Final drive ratio (higher = shorter gearing, more acceleration)"
    )

    # Alignment
    front_toe_deg: float = Field(default=0.0, ge=-0.2, le=0.2, description="Front toe (degrees)")
    rear_toe_deg: float = Field(default=0.1, ge=0.0, le=0.31, description="Rear toe (degrees)")
    front_camber_deg: float = Field(default=-2.8, ge=-4.0, le=-1.5, description="Front camber (degrees)")
    caster_deg: float = Field(default=10.0, ge=6.1, le=13.9, description="Caster (degrees, front only)")

    # Electronics
    traction_control: int = Field(default=3, ge=0, le=10, description="TC level (0 = off)")
    abs_level: int = Field(default=3, ge=0, le=10, description="ABS level (0 = off)")
    ecu_map: int = Field(
        default=2, ge=1, le=8,
        description="ECU map: 1 most aggressive; 2 linear; 3 gradual on throttle; "
                    "4 slowest dry; 5 pace car; 6-8 rain (6 highest consumption)"
    )

    # Brakes
    brake_compound: int = Field(
        default=2, ge=1, le=4,
        description="Pad compound: 1 sprint (~3h), 2 endurance (~12h), 3 wet, 4 qualifying"
    )
    brake_power_percent: float = Field(default=100, ge=80, le=100, description="Brake power %")

    # Mechanical grip
    front_antiroll_bar: int = Field(default=4, ge=0, le=9, description="Front anti-roll bar stiffness")
    rear_antiroll_bar: int = Field(default=4, ge=0, le=9, description="Rear anti-roll bar stiffness")
    steering_ratio: float = Field(default=13.0, ge=9.0, le=18.0, description="Steering ratio")
    bumpstop_rate_n: float = Field(
        default=1000, ge=300, le=2500,
        description="Bumpstop rate (N) — secondary spring resistance at travel limit"
    )
    front_bumpstop_range_mm: float = Field(default=10, ge=0, le=32, description="Front bumpstop range (0 = softest engagement)")
    rear_bumpstop_range_mm: float = Field(default=20, ge=0, le=60, description="Rear bumpstop range (0 = softest engagement)")
    diff_preload_nm: float = Field(
        default=120, ge=0, le=300,
        description="Diff preload (Nm): 0 = wheels rotate in sync, 300 = max desync"
    )

    # Dampers
    bump_damping: int = Field(default=20, ge=0, le=40, description="Slow bump (compression)")
    rebound_damping: int = Field(default=20, ge=0, le=40, description="Slow rebound (extension)")
    fast_bump_damping: int = Field(default=24, ge=0, le=49, description="Fast bump")
    fast_rebound_damping: int = Field(default=24, ge=0, le=49, description="Fast rebound")

    # Aero extras (GT3-oriented)
    front_splitter: int = Field(default=1, ge=0, le=3, description="Front splitter position (GT3)")
    front_brake_ducts: int = Field(default=3, ge=0, le=6, description="Front brake ducts (0 = closed)")
    rear_brake_ducts: int = Field(default=3, ge=0, le=6, description="Rear brake ducts (0 = closed)")


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
    car_id: Optional[str] = Field(
        default=None, max_length=40,
        description="Garage car id — selects the per-car setup profile"
    )
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