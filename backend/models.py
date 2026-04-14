"""
Data models for WEC LMP Diagnostic Assistant
=============================================

Pydantic models for request/response validation.

Author: Alexandru
Version: 1.0
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Literal
from enum import Enum


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
    hybrid_deployment_map: int = Field(ge=1, le=3, description="Hybrid deployment aggressiveness (1-3)")
    tire_pressure: TirePressure


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


class DiagnosticRequest(BaseModel):
    """Complete diagnostic request"""
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


class HealthCheck(BaseModel):
    """API health check response"""
    status: str
    version: str
    diagnostic_engine: str