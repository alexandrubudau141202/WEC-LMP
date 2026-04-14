"""
WEC LMP Hypercar Diagnostic Engine
===================================

Physics-based diagnostic system for LMP setup analysis.

Based on:
- Engineering principles for LMP aerodynamics and suspension
- To be refined with Le Mans Prototype Engineering technical data
- Adapted from GT3 diagnostic tool architecture

Author: Alexandru
Version: 1.0 (Pre-book baseline)
"""

from models import (
    DiagnosticRequest, Diagnosis, Recommendation,
    Setup, DriverFeedback, TrackConditions
)
from typing import List, Tuple
import math


class LMPDiagnosticEngine:
    """
    Diagnostic engine for LMP Hypercar setup analysis.
    
    Key differences from GT3:
    - Ride height is MORE critical than wing angle (underbody aero dominance)
    - Hybrid deployment affects traction and balance
    - Fuel load changes are larger (90L tank vs GT3 ~120L)
    - Endurance-specific considerations (tire life, driver fatigue)
    """
    
    def __init__(self):
        self.version = "1.0-baseline"
        
    def diagnose(self, request: DiagnosticRequest) -> Diagnosis:
        """Main diagnostic function"""
        
        # Extract components
        setup = request.setup
        feedback = request.driver_feedback
        conditions = request.conditions
        
        # Analyze issues
        issues = self._identify_issues(setup, feedback, conditions)
        
        # Prioritize primary issue
        if not issues:
            return self._generate_no_issue_response()
        
        primary = issues[0]
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            primary, setup, feedback, conditions
        )
        
        # Build diagnosis
        return Diagnosis(
            primary_issue=primary["issue"],
            severity=primary["severity"],
            confidence=primary["confidence"],
            contributing_factors=primary["factors"],
            recommendations=recommendations,
            executive_summary=self._generate_summary(primary, recommendations)
        )
    
    def _identify_issues(
        self, 
        setup: Setup, 
        feedback: DriverFeedback,
        conditions: TrackConditions
    ) -> List[dict]:
        """Identify and rank handling issues"""
        
        issues = []
        
        # Understeer analysis
        if feedback.understeer > 2:
            severity, confidence, factors = self._analyze_understeer(
                setup, feedback, conditions
            )
            issues.append({
                "issue": "understeer",
                "severity": severity,
                "confidence": confidence,
                "factors": factors,
                "feedback_magnitude": feedback.understeer
            })
        
        # Oversteer analysis
        if feedback.oversteer > 2:
            severity, confidence, factors = self._analyze_oversteer(
                setup, feedback, conditions
            )
            issues.append({
                "issue": "oversteer",
                "severity": severity,
                "confidence": confidence,
                "factors": factors,
                "feedback_magnitude": feedback.oversteer
            })
        
        # Brake stability
        if abs(feedback.brake_stability) > 2:
            severity, confidence, factors = self._analyze_brake_stability(
                setup, feedback, conditions
            )
            issues.append({
                "issue": "brake_instability",
                "severity": severity,
                "confidence": confidence,
                "factors": factors,
                "feedback_magnitude": abs(feedback.brake_stability)
            })
        
        # Hybrid integration issues
        if abs(feedback.hybrid_feel) > 2:
            severity, confidence, factors = self._analyze_hybrid_issues(
                setup, feedback, conditions
            )
            issues.append({
                "issue": "hybrid_integration",
                "severity": severity,
                "confidence": confidence,
                "factors": factors,
                "feedback_magnitude": abs(feedback.hybrid_feel)
            })
        
        # Sort by severity and confidence
        issues.sort(
            key=lambda x: (
                {"low": 1, "medium": 2, "high": 3}[x["severity"]] * x["confidence"]
            ),
            reverse=True
        )
        
        return issues
    
    def _analyze_understeer(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> Tuple[str, float, List[str]]:
        """Analyze understeer issue"""
        
        factors = []
        confidence = 0.7  # Base confidence
        
        # Check ride height balance (critical for LMP)
        rake = setup.rear_ride_height_mm - setup.front_ride_height_mm
        if rake < 3:
            factors.append("Insufficient rake (front too high relative to rear)")
            confidence += 0.1
        
        # Check aero balance
        wing_balance = setup.rear_wing_angle_deg / (setup.front_wing_angle_deg + 0.1)
        if wing_balance > 2.0:
            factors.append("Rear-biased aero (too much rear downforce)")
            confidence += 0.1
        
        # Fuel load effect
        if conditions.fuel_load_kg > 70:
            factors.append("High fuel load (rear weight bias)")
            confidence += 0.05
        
        # Tire pressure front/rear balance
        avg_front_pressure = (setup.tire_pressure.fl + setup.tire_pressure.fr) / 2
        avg_rear_pressure = (setup.tire_pressure.rl + setup.tire_pressure.rr) / 2
        if avg_front_pressure > avg_rear_pressure + 0.1:
            factors.append("Front tire pressure too high (reduced contact patch)")
        
        # Corner phase specific
        if feedback.corner_phase == "mid":
            factors.append("Mid-corner specific (likely aero platform issue)")
            confidence += 0.1
        elif feedback.corner_phase == "entry":
            factors.append("Entry specific (likely brake bias or front grip)")
        
        # Determine severity
        if feedback.understeer >= 4:
            severity = "high"
        elif feedback.understeer >= 3:
            severity = "medium"
        else:
            severity = "low"
        
        confidence = min(1.0, confidence)
        
        return severity, confidence, factors
    
    def _analyze_oversteer(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> Tuple[str, float, List[str]]:
        """Analyze oversteer issue"""
        
        factors = []
        confidence = 0.7
        
        # Ride height analysis
        rake = setup.rear_ride_height_mm - setup.front_ride_height_mm
        if rake > 8:
            factors.append("Excessive rake (rear too high, losing rear downforce)")
            confidence += 0.1
        
        # Aero balance
        wing_balance = setup.rear_wing_angle_deg / (setup.front_wing_angle_deg + 0.1)
        if wing_balance < 1.5:
            factors.append("Front-biased aero (insufficient rear downforce)")
            confidence += 0.1
        
        # Hybrid deployment interaction
        if setup.hybrid_deployment_map >= 2 and feedback.corner_phase == "exit":
            factors.append("Aggressive hybrid deployment on exit (rear traction loss)")
            confidence += 0.15
        
        # Low fuel = lighter rear
        if conditions.fuel_load_kg < 40:
            factors.append("Low fuel load (reduced rear weight, less traction)")
        
        # Tire pressure
        avg_rear_pressure = (setup.tire_pressure.rl + setup.tire_pressure.rr) / 2
        if avg_rear_pressure > 2.1:
            factors.append("Rear tire pressure too high (reduced grip)")
        
        # Severity
        if feedback.oversteer >= 4:
            severity = "high"
        elif feedback.oversteer >= 3:
            severity = "medium"
        else:
            severity = "low"
        
        confidence = min(1.0, confidence)
        
        return severity, confidence, factors
    
    def _analyze_brake_stability(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> Tuple[str, float, List[str]]:
        """Analyze brake stability issues"""
        
        factors = []
        confidence = 0.75
        
        # Brake bias analysis
        if feedback.brake_stability < 0:  # Rear instability
            if setup.brake_bias_percent < 51:
                factors.append("Brake bias too far rearward (rear lockup risk)")
                confidence += 0.1
        else:  # Front instability
            if setup.brake_bias_percent > 55:
                factors.append("Brake bias too far forward (front lockup risk)")
                confidence += 0.1
        
        # Hybrid regen interaction
        if setup.hybrid_deployment_map >= 2:
            factors.append("Aggressive hybrid regen may destabilize rear under braking")
        
        # Ride height and aero
        if setup.front_ride_height_mm < 40:
            factors.append("Very low front ride height (pitch sensitivity under braking)")
        
        # Tire pressure cross-axle balance
        fl_fr_diff = abs(setup.tire_pressure.fl - setup.tire_pressure.fr)
        if fl_fr_diff > 0.1:
            factors.append(f"Front tire pressure imbalance ({fl_fr_diff:.1f} bar difference)")
        
        severity = "medium" if abs(feedback.brake_stability) >= 4 else "low"
        confidence = min(1.0, confidence)
        
        return severity, confidence, factors
    
    def _analyze_hybrid_issues(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> Tuple[str, float, List[str]]:
        """Analyze hybrid system integration issues"""
        
        factors = []
        confidence = 0.65  # Hybrid is complex, lower base confidence
        
        if feedback.hybrid_feel > 0:  # Too aggressive
            if setup.hybrid_deployment_map == 3:
                factors.append("Maximum deployment map (may be too aggressive for conditions)")
                confidence += 0.15
            
            if feedback.corner_phase == "exit":
                factors.append("Exit traction issues (hybrid overwhelming rear grip)")
                confidence += 0.1
        
        else:  # Too conservative
            if setup.hybrid_deployment_map == 1:
                factors.append("Conservative deployment map (underutilizing hybrid potential)")
                confidence += 0.1
        
        # Fuel load interaction
        if conditions.fuel_load_kg > 75 and setup.hybrid_deployment_map >= 2:
            factors.append("Heavy fuel + aggressive deployment (traction challenge)")
        
        severity = "medium" if abs(feedback.hybrid_feel) >= 4 else "low"
        confidence = min(1.0, confidence)
        
        return severity, confidence, factors
    
    def _generate_recommendations(
        self,
        primary_issue: dict,
        setup: Setup,
        feedback: DriverFeedback,
        conditions: TrackConditions
    ) -> List[Recommendation]:
        """Generate prioritized recommendations"""
        
        recommendations = []
        issue_type = primary_issue["issue"]
        
        if issue_type == "understeer":
            recommendations = self._recommend_understeer_fixes(setup, feedback, conditions)
        elif issue_type == "oversteer":
            recommendations = self._recommend_oversteer_fixes(setup, feedback, conditions)
        elif issue_type == "brake_instability":
            recommendations = self._recommend_brake_fixes(setup, feedback, conditions)
        elif issue_type == "hybrid_integration":
            recommendations = self._recommend_hybrid_fixes(setup, feedback, conditions)
        
        # Add priority ranks
        for i, rec in enumerate(recommendations, 1):
            rec.priority = i
        
        return recommendations[:5]  # Top 5 recommendations
    
    def _recommend_understeer_fixes(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> List[Recommendation]:
        """Recommendations for understeer"""
        
        recs = []
        
        # Ride height adjustment (highest priority for LMP)
        if setup.front_ride_height_mm > 42:
            recs.append(Recommendation(
                priority=1,
                parameter="front_ride_height",
                change="-2 to -3mm",
                rationale="Increase front downforce via underbody/diffuser",
                expected_impact="Improved front grip, especially mid-corner"
            ))
        
        # Rake reduction
        rake = setup.rear_ride_height_mm - setup.front_ride_height_mm
        if rake > 6:
            recs.append(Recommendation(
                priority=2,
                parameter="rear_ride_height",
                change="+1 to +2mm",
                rationale="Reduce rake to shift aero balance forward",
                expected_impact="More front downforce, reduced understeer"
            ))
        
        # Wing angle adjustment
        wing_balance = setup.rear_wing_angle_deg / (setup.front_wing_angle_deg + 0.1)
        if wing_balance > 2.0:
            recs.append(Recommendation(
                priority=3,
                parameter="rear_wing_angle",
                change="-0.5° to -1.0°",
                rationale="Reduce rear downforce to balance car",
                expected_impact="Less rear grip, more neutral balance"
            ))
        
        # Tire pressure
        avg_front = (setup.tire_pressure.fl + setup.tire_pressure.fr) / 2
        if avg_front > 1.9:
            recs.append(Recommendation(
                priority=4,
                parameter="front_tire_pressure",
                change="-0.1 to -0.2 bar",
                rationale="Improve front tire contact patch compliance",
                expected_impact="Better front mechanical grip"
            ))
        
        # Brake bias (if entry understeer)
        if feedback.corner_phase == "entry" and setup.brake_bias_percent > 53:
            recs.append(Recommendation(
                priority=5,
                parameter="brake_bias",
                change="-1% to -2%",
                rationale="Shift weight forward during braking phase",
                expected_impact="More front load on turn-in"
            ))
        
        return recs
    
    def _recommend_oversteer_fixes(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> List[Recommendation]:
        """Recommendations for oversteer"""
        
        recs = []
        
        # Rear ride height (increase rear downforce)
        if setup.rear_ride_height_mm > 52:
            recs.append(Recommendation(
                priority=1,
                parameter="rear_ride_height",
                change="-2 to -3mm",
                rationale="Lower rear for increased diffuser efficiency",
                expected_impact="More rear downforce and stability"
            ))
        
        # Rear wing increase
        if setup.rear_wing_angle_deg < 13:
            recs.append(Recommendation(
                priority=2,
                parameter="rear_wing_angle",
                change="+0.5° to +1.0°",
                rationale="Increase rear downforce directly",
                expected_impact="Better rear stability and traction"
            ))
        
        # Hybrid deployment (if exit oversteer)
        if feedback.corner_phase == "exit" and setup.hybrid_deployment_map >= 2:
            recs.append(Recommendation(
                priority=3,
                parameter="hybrid_deployment_map",
                change="Reduce to map 1",
                rationale="Less aggressive power delivery on corner exit",
                expected_impact="Improved rear traction management"
            ))
        
        # Rear tire pressure
        avg_rear = (setup.tire_pressure.rl + setup.tire_pressure.rr) / 2
        if avg_rear > 2.0:
            recs.append(Recommendation(
                priority=4,
                parameter="rear_tire_pressure",
                change="-0.1 to -0.2 bar",
                rationale="Improve rear tire contact patch",
                expected_impact="Better rear mechanical grip"
            ))
        
        # Brake bias (if trail-braking oversteer)
        if feedback.corner_phase == "entry" and setup.brake_bias_percent < 52:
            recs.append(Recommendation(
                priority=5,
                parameter="brake_bias",
                change="+1% to +2%",
                rationale="Keep more weight on front during trail-brake",
                expected_impact="Reduced rear instability on entry"
            ))
        
        return recs
    
    def _recommend_brake_fixes(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> List[Recommendation]:
        """Recommendations for brake stability"""
        
        recs = []
        
        if feedback.brake_stability < 0:  # Rear instability
            recs.append(Recommendation(
                priority=1,
                parameter="brake_bias",
                change="+1% to +2%",
                rationale="Shift braking load forward to stabilize rear",
                expected_impact="Reduced rear lockup tendency"
            ))
            
            if setup.hybrid_deployment_map >= 2:
                recs.append(Recommendation(
                    priority=2,
                    parameter="hybrid_regen_mapping",
                    change="Reduce regen aggressiveness",
                    rationale="Hybrid regen may be destabilizing rear under braking",
                    expected_impact="More predictable rear behavior"
                ))
        
        else:  # Front instability
            recs.append(Recommendation(
                priority=1,
                parameter="brake_bias",
                change="-1% to -2%",
                rationale="Reduce front braking load to prevent lockup",
                expected_impact="Better front tire control under braking"
            ))
        
        # Tire pressure balance
        fl_fr_diff = abs(setup.tire_pressure.fl - setup.tire_pressure.fr)
        if fl_fr_diff > 0.1:
            lower_side = "left" if setup.tire_pressure.fl < setup.tire_pressure.fr else "right"
            recs.append(Recommendation(
                priority=3,
                parameter=f"front_{lower_side}_tire_pressure",
                change=f"Match opposite side (±0.{int(fl_fr_diff*10)} bar)",
                rationale="Eliminate cross-axle pressure imbalance",
                expected_impact="Equal braking force left/right"
            ))
        
        return recs
    
    def _recommend_hybrid_fixes(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> List[Recommendation]:
        """Recommendations for hybrid integration"""
        
        recs = []
        
        if feedback.hybrid_feel > 0:  # Too aggressive
            recs.append(Recommendation(
                priority=1,
                parameter="hybrid_deployment_map",
                change=f"Reduce from map {setup.hybrid_deployment_map} to map {max(1, setup.hybrid_deployment_map-1)}",
                rationale="Soften power delivery for better traction",
                expected_impact="Smoother exit, less wheelspin"
            ))
        else:  # Too conservative
            recs.append(Recommendation(
                priority=1,
                parameter="hybrid_deployment_map",
                change=f"Increase from map {setup.hybrid_deployment_map} to map {min(3, setup.hybrid_deployment_map+1)}",
                rationale="Utilize more hybrid potential",
                expected_impact="Better acceleration, reduced lap time"
            ))
        
        return recs
    
    def _generate_no_issue_response(self) -> Diagnosis:
        """Return when no significant issues detected"""
        return Diagnosis(
            primary_issue="optimal_balance",
            severity="low",
            confidence=0.8,
            contributing_factors=[],
            recommendations=[],
            executive_summary="No significant handling issues detected. Car is well-balanced."
        )
    
    def _generate_summary(self, primary_issue: dict, recommendations: List[Recommendation]) -> str:
        """Generate executive summary"""
        
        issue_name = primary_issue["issue"].replace("_", " ").title()
        severity = primary_issue["severity"]
        confidence = int(primary_issue["confidence"] * 100)
        
        if not recommendations:
            return f"{issue_name} ({severity} severity, {confidence}% confidence)."
        
        top_action = recommendations[0].parameter.replace("_", " ")
        
        return f"{issue_name} ({severity} severity, {confidence}% confidence). Primary fix: {top_action} {recommendations[0].change}."


# Singleton instance
diagnostic_engine = LMPDiagnosticEngine()