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


# Per-class physics profiles. The same engine serves all three categories;
# these constants encode what differs between them.
CLASS_PROFILES = {
    "hypercar": {
        "label": "LMH/LMDh Hypercar (Porsche 963)",
        "has_hybrid": True,
        "underbody_dominant": True,   # diffuser/floor is the main downforce source
        "rake_window": (3, 12),       # mm, efficient diffuser range
        "kerb_wheel_rate_limit": 300, # N/mm before kerb compliance suffers
        "hotlap_fuel_kg": 25,
    },
    "lmp2": {
        "label": "LMP2 (Oreca 07 - Gibson V8, no hybrid)",
        "has_hybrid": False,
        "underbody_dominant": True,
        "rake_window": (3, 14),
        "kerb_wheel_rate_limit": 280,
        "hotlap_fuel_kg": 20,
    },
    "gt3": {
        "label": "GT3 (Porsche 911 GT3 R - wing-dominant aero, no hybrid)",
        "has_hybrid": False,
        "underbody_dominant": False,  # rear wing carries most of the load
        "rake_window": (0, 20),       # far less diffuser-stall sensitive
        "kerb_wheel_rate_limit": 240, # softer platform, must ride kerbs
        "hotlap_fuel_kg": 15,
    },
}


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
        profile = CLASS_PROFILES[request.car_class]

        # Analyze issues
        issues = self._identify_issues(setup, feedback, conditions, profile)

        # Prioritize primary issue
        if not issues:
            return self._generate_no_issue_response()

        primary = issues[0]

        # Generate recommendations
        recommendations = self._generate_recommendations(
            primary, setup, feedback, conditions, profile
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
        conditions: TrackConditions,
        profile: dict
    ) -> List[dict]:
        """Identify and rank handling issues"""

        issues = []

        # Understeer analysis
        if feedback.understeer > 2:
            severity, confidence, factors = self._analyze_understeer(
                setup, feedback, conditions, profile
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
                setup, feedback, conditions, profile
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
                setup, feedback, conditions, profile
            )
            issues.append({
                "issue": "brake_instability",
                "severity": severity,
                "confidence": confidence,
                "factors": factors,
                "feedback_magnitude": abs(feedback.brake_stability)
            })
        
        # Hybrid integration issues (hypercar only — LMP2/GT3 have no hybrid)
        if profile["has_hybrid"] and abs(feedback.hybrid_feel) > 2:
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

        # Proactive setup audit (runs regardless of driver feedback —
        # a pathological setup is a problem even before the driver reports one)
        audit_issue = self._audit_setup(setup, conditions, profile)
        if audit_issue:
            issues.append(audit_issue)

        # Optimization pass: session/track-specific opportunities (low priority,
        # only surfaces as primary when nothing worse was found)
        optimization = self._optimization_audit(setup, feedback, conditions, profile)
        if optimization:
            issues.append(optimization)

        # Sort by severity and confidence
        issues.sort(
            key=lambda x: (
                {"low": 1, "medium": 2, "high": 3}[x["severity"]] * x["confidence"]
            ),
            reverse=True
        )
        
        return issues
    
    def _audit_setup(self, setup: Setup, conditions: TrackConditions, profile: dict) -> dict:
        """
        Audit the setup itself for pathological configurations,
        independent of driver feedback.

        Weighted severity score: geometry faults (rake) weigh heaviest
        because underbody aero dominates prototype downforce. Windows
        are class-specific (GT3 is far less rake-sensitive than LMH/LMP2).
        """
        factors = []
        score = 0

        rake_min, rake_max = profile["rake_window"]

        # Rake (rear - front ride height)
        rake = setup.rear_ride_height_mm - setup.front_ride_height_mm
        if rake < 0 and profile["underbody_dominant"]:
            factors.append(
                f"Negative rake ({rake:.0f}mm): aero platform inverted, "
                "underbody/diffuser cannot generate design downforce"
            )
            score += 4
        elif rake < rake_min:
            factors.append(
                f"Marginal rake ({rake:.0f}mm, class window {rake_min}-{rake_max}mm): "
                "underbody running below its efficient window"
            )
            score += 1
        elif rake > rake_max:
            factors.append(
                f"Excessive rake ({rake:.0f}mm, class window {rake_min}-{rake_max}mm): "
                "diffuser stall risk, unstable rear aero platform"
            )
            score += 3

        # Kerb compliance: very low + very stiff platform can't ride kerbs
        kerb_limit = profile["kerb_wheel_rate_limit"]
        stiffest = max(setup.front_wheel_rate_nmm, setup.rear_wheel_rate_nmm)
        if setup.front_ride_height_mm <= 40 and stiffest > kerb_limit:
            factors.append(
                f"Very low, very stiff platform ({stiffest:.0f} N/mm > {kerb_limit} N/mm class limit): "
                "kerb strikes will unsettle the car — hotlap-only compromise"
            )
            score += 1

        # Extreme rear camber: cornering gain but braking/traction contact patch loss
        if setup.rear_camber_deg < -4.2:
            factors.append(
                f"Extreme rear camber ({setup.rear_camber_deg:.1f}°): reduced contact "
                "patch under braking and traction, inner-shoulder tire wear risk"
            )
            score += 1

        # Cross-axle tire pressure imbalance (asymmetric grip left/right)
        fl_fr_diff = abs(setup.tire_pressure.fl - setup.tire_pressure.fr)
        rl_rr_diff = abs(setup.tire_pressure.rl - setup.tire_pressure.rr)
        if fl_fr_diff > 0.1:
            factors.append(
                f"Front cross-axle pressure imbalance ({fl_fr_diff:.1f} bar): "
                "asymmetric grip and braking response"
            )
            score += 2
        if rl_rr_diff > 0.1:
            factors.append(
                f"Rear cross-axle pressure imbalance ({rl_rr_diff:.1f} bar): "
                "asymmetric traction on corner exit"
            )
            score += 2

        # Front/rear pressure split
        avg_front = (setup.tire_pressure.fl + setup.tire_pressure.fr) / 2
        avg_rear = (setup.tire_pressure.rl + setup.tire_pressure.rr) / 2
        if abs(avg_front - avg_rear) > 0.3:
            factors.append(
                f"Extreme front/rear pressure split ({avg_front - avg_rear:+.1f} bar): "
                "mechanical balance heavily skewed"
            )
            score += 2

        # Aero balance from wing angles
        wing_balance = setup.rear_wing_angle_deg / (setup.front_wing_angle_deg + 0.1)
        if wing_balance > 2.8:
            factors.append(
                f"Heavily rear-biased wing package (ratio {wing_balance:.1f}): "
                "chronic understeer likely"
            )
            score += 2
        elif wing_balance < 1.2:
            factors.append(
                f"Heavily front-biased wing package (ratio {wing_balance:.1f}): "
                "high-speed rear instability likely"
            )
            score += 2

        # Brake bias outside workable window
        if setup.brake_bias_percent > 57:
            factors.append(
                f"Brake bias very far forward ({setup.brake_bias_percent:.0f}%): "
                "front lockup and flat-spot risk"
            )
            score += 1
        elif setup.brake_bias_percent < 48:
            factors.append(
                f"Brake bias very far rearward ({setup.brake_bias_percent:.0f}%): "
                "rear lockup risk, compounded by MGU-K regen"
            )
            score += 2

        if not factors:
            return None

        if score >= 4:
            severity = "high"
        elif score >= 2:
            severity = "medium"
        else:
            severity = "low"

        # Setup geometry is measured, not subjective — confidence scales
        # with how many independent checks fired
        confidence = min(0.95, 0.75 + 0.05 * len(factors))

        return {
            "issue": "setup_anomaly",
            "severity": severity,
            "confidence": confidence,
            "factors": factors,
            "feedback_magnitude": 0
        }

    def _optimization_audit(
        self, setup: Setup, feedback: DriverFeedback,
        conditions: TrackConditions, profile: dict
    ) -> dict:
        """
        Session/track-specific optimization opportunities. Always low
        severity — real handling issues and setup anomalies outrank it,
        so this only becomes the primary issue on an otherwise-clean car.
        """
        factors = []

        avg_pressure = (
            setup.tire_pressure.fl + setup.tire_pressure.fr +
            setup.tire_pressure.rl + setup.tire_pressure.rr
        ) / 4

        # Tire pressure vs track character (2-3 psi ≈ 0.15-0.2 bar)
        if conditions.track_type == "high_speed" and avg_pressure < 1.8:
            factors.append(
                f"Pressures low for a high-speed track (avg {avg_pressure:.2f} bar): "
                "+0.15-0.20 bar (2-3 psi) reduces rolling drag and stabilizes the "
                "carcass on long straights"
            )
        elif conditions.track_type == "technical" and avg_pressure > 1.9:
            factors.append(
                f"Pressures high for a technical track (avg {avg_pressure:.2f} bar): "
                "-0.15-0.20 bar (2-3 psi) grows the contact patch for rhythm sections"
            )

        # Rear wing trim on high-speed tracks (only if the driver reports no oversteer)
        if (
            conditions.track_type == "high_speed"
            and setup.rear_wing_angle_deg > 17
            and feedback.oversteer <= 0
        ):
            factors.append(
                f"Rear wing at {setup.rear_wing_angle_deg:.1f}° with no oversteer reported: "
                "drag can be trimmed toward the low end for straight-line speed"
            )

        # Fuel load for hotlap running
        hotlap_fuel = profile["hotlap_fuel_kg"]
        if conditions.session_type == "hotlap" and conditions.fuel_load_kg > hotlap_fuel + 10:
            factors.append(
                f"Hotlap run with {conditions.fuel_load_kg:.0f}kg fuel aboard: "
                f"cut to ~{hotlap_fuel}kg to reduce weight and tire loading"
            )

        # Suspension for hotlap running (soft/high platform leaves lap time on the table)
        if (
            conditions.session_type == "hotlap"
            and setup.front_ride_height_mm > 45
            and max(setup.front_wheel_rate_nmm, setup.rear_wheel_rate_nmm)
                < profile["kerb_wheel_rate_limit"] - 60
        ):
            factors.append(
                "Race-compliance platform in a hotlap session: lower ride heights and "
                "raise wheel rates for peak aero platform control (keep kerb clearance)"
            )

        # Gearing sanity at the extremes
        if setup.final_drive_ratio < 3.0:
            factors.append(
                f"Very long final drive ({setup.final_drive_ratio:.2f}): verify the car "
                "reaches the limiter just before the end of the longest straight — "
                "if not, shorten it"
            )
        elif setup.final_drive_ratio > 4.4:
            factors.append(
                f"Very short final drive ({setup.final_drive_ratio:.2f}): risk of sitting "
                "on the limiter well before the braking point"
            )

        if not factors:
            return None

        return {
            "issue": "optimization",
            "severity": "low",
            "confidence": 0.7,
            "factors": factors,
            "feedback_magnitude": 0
        }

    def _analyze_understeer(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions,
        profile: dict
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
        
        # Differential: high coast lock resists rotation into the corner
        if setup.coast_diff_percent > 60 and feedback.corner_phase in ("entry", "mid", "all"):
            factors.append(
                f"High coast diff lock ({setup.coast_diff_percent:.0f}%): "
                "differential resists rotation on turn-in"
            )
            confidence += 0.05

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
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions,
        profile: dict
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
        
        # Hybrid deployment interaction (hypercar only)
        if profile["has_hybrid"] and setup.hybrid_deployment_map >= 2 and feedback.corner_phase == "exit":
            factors.append("Aggressive hybrid deployment on exit (rear traction loss)")
            confidence += 0.15

        # Differential: very open coast side causes lift-off oversteer
        if setup.coast_diff_percent < 25 and feedback.corner_phase in ("entry", "mid", "all"):
            factors.append(
                f"Open coast diff ({setup.coast_diff_percent:.0f}%): "
                "excessive lift-off rotation when the driver breathes the throttle"
            )
            confidence += 0.1

        # Rear camber: too little negative camber weakens rear lateral grip
        if setup.rear_camber_deg > -1.5:
            factors.append(
                f"Insufficient rear camber ({setup.rear_camber_deg:.1f}°): "
                "rear tires under-cambered for cornering load"
            )
            confidence += 0.05
        
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
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions,
        profile: dict
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
        
        # Hybrid regen interaction (hypercar only)
        if profile["has_hybrid"] and setup.hybrid_deployment_map >= 2:
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
        conditions: TrackConditions,
        profile: dict
    ) -> List[Recommendation]:
        """Generate prioritized recommendations"""

        recommendations = []
        issue_type = primary_issue["issue"]

        if issue_type == "understeer":
            recommendations = self._recommend_understeer_fixes(setup, feedback, conditions)
        elif issue_type == "oversteer":
            recommendations = self._recommend_oversteer_fixes(setup, feedback, conditions, profile)
        elif issue_type == "brake_instability":
            recommendations = self._recommend_brake_fixes(setup, feedback, conditions, profile)
        elif issue_type == "hybrid_integration":
            recommendations = self._recommend_hybrid_fixes(setup, feedback, conditions)
        elif issue_type == "setup_anomaly":
            recommendations = self._recommend_setup_fixes(setup, feedback, conditions)
        elif issue_type == "optimization":
            recommendations = self._recommend_optimizations(setup, feedback, conditions, profile)

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

        # Coast diff (turn-in resistance)
        if setup.coast_diff_percent > 55:
            recs.append(Recommendation(
                priority=6,
                parameter="coast_diff",
                change="-10% to -15% lock",
                rationale="Free the differential on the coast side to let the car rotate on entry",
                expected_impact="Sharper turn-in, slight lift-off rotation"
            ))

        return recs
    
    def _recommend_oversteer_fixes(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions,
        profile: dict
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
        
        # Hybrid deployment (if exit oversteer, hypercar only)
        if profile["has_hybrid"] and feedback.corner_phase == "exit" and setup.hybrid_deployment_map >= 2:
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

        # Coast diff (lift-off oversteer)
        if setup.coast_diff_percent < 30:
            recs.append(Recommendation(
                priority=6,
                parameter="coast_diff",
                change="+10% to +15% lock",
                rationale="Lock the coast side more to calm lift-off rotation",
                expected_impact="More stable entry when the driver lifts"
            ))

        # Rear camber (rear lateral grip)
        if setup.rear_camber_deg > -1.5:
            recs.append(Recommendation(
                priority=7,
                parameter="rear_camber",
                change="-0.5° to -1.0° (more negative)",
                rationale="Add negative rear camber to increase cornering contact patch",
                expected_impact="More rear lateral grip mid-corner"
            ))

        return recs
    
    def _recommend_brake_fixes(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions,
        profile: dict
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

            if profile["has_hybrid"] and setup.hybrid_deployment_map >= 2:
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
    
    def _recommend_setup_fixes(
        self, setup: Setup, feedback: DriverFeedback, conditions: TrackConditions
    ) -> List[Recommendation]:
        """Recommendations for setup anomalies found by the proactive audit"""

        recs = []

        # Rake correction first — dominates LMP aero performance
        rake = setup.rear_ride_height_mm - setup.front_ride_height_mm
        if rake < 3:
            target_rear = setup.front_ride_height_mm + 5
            recs.append(Recommendation(
                priority=1,
                parameter="rear_ride_height",
                change=f"+{target_rear - setup.rear_ride_height_mm:.0f}mm (target ~5mm rake)",
                rationale="Restore positive rake so the underbody/diffuser works in its design window",
                expected_impact="Recovered underbody downforce and predictable aero balance"
            ))
        elif rake > 12:
            recs.append(Recommendation(
                priority=1,
                parameter="rear_ride_height",
                change=f"-{rake - 8:.0f}mm (target ~8mm rake)",
                rationale="Reduce rake below diffuser stall threshold",
                expected_impact="Stable rear downforce, less snap behavior over bumps"
            ))

        # Cross-axle pressure equalization
        fl_fr_diff = abs(setup.tire_pressure.fl - setup.tire_pressure.fr)
        if fl_fr_diff > 0.1:
            recs.append(Recommendation(
                priority=2,
                parameter="front_tire_pressure",
                change=f"Equalize left/right (currently {fl_fr_diff:.1f} bar apart)",
                rationale="Cross-axle imbalance gives asymmetric grip and braking response",
                expected_impact="Consistent front behavior in left vs right corners"
            ))
        rl_rr_diff = abs(setup.tire_pressure.rl - setup.tire_pressure.rr)
        if rl_rr_diff > 0.1:
            recs.append(Recommendation(
                priority=3,
                parameter="rear_tire_pressure",
                change=f"Equalize left/right (currently {rl_rr_diff:.1f} bar apart)",
                rationale="Rear cross-axle imbalance destabilizes traction on exit",
                expected_impact="Symmetric traction, easier hybrid deployment"
            ))

        # Wing package rebalance
        wing_balance = setup.rear_wing_angle_deg / (setup.front_wing_angle_deg + 0.1)
        if wing_balance > 2.8:
            recs.append(Recommendation(
                priority=4,
                parameter="rear_wing_angle",
                change="-1.0° to -2.0°",
                rationale="Bring aero balance back toward neutral from heavy rear bias",
                expected_impact="Reduced chronic understeer tendency"
            ))
        elif wing_balance < 1.2:
            recs.append(Recommendation(
                priority=4,
                parameter="rear_wing_angle",
                change="+1.0° to +2.0°",
                rationale="Bring aero balance back toward neutral from heavy front bias",
                expected_impact="Restored high-speed rear stability"
            ))

        # Brake bias back into window
        if setup.brake_bias_percent > 57:
            recs.append(Recommendation(
                priority=5,
                parameter="brake_bias",
                change=f"-{setup.brake_bias_percent - 55:.0f}% (target ≤55%)",
                rationale="Bias outside workable front window risks lockup and flat spots",
                expected_impact="Usable braking performance without front lockup"
            ))
        elif setup.brake_bias_percent < 48:
            recs.append(Recommendation(
                priority=5,
                parameter="brake_bias",
                change=f"+{50 - setup.brake_bias_percent:.0f}% (target ≥50%)",
                rationale="Rearward bias plus MGU-K regen overloads the rear axle under braking",
                expected_impact="Stable rear under heavy braking zones"
            ))

        return recs

    def _recommend_optimizations(
        self, setup: Setup, feedback: DriverFeedback,
        conditions: TrackConditions, profile: dict
    ) -> List[Recommendation]:
        """Recommendations for session/track-specific optimization opportunities"""

        recs = []

        avg_pressure = (
            setup.tire_pressure.fl + setup.tire_pressure.fr +
            setup.tire_pressure.rl + setup.tire_pressure.rr
        ) / 4

        if conditions.track_type == "high_speed" and avg_pressure < 1.8:
            recs.append(Recommendation(
                priority=1,
                parameter="tire_pressure",
                change="+0.15 to +0.20 bar all round (2-3 psi)",
                rationale="High-speed track: firmer carcass cuts rolling drag on the straights",
                expected_impact="Better top speed and pressure stability over a stint"
            ))
        elif conditions.track_type == "technical" and avg_pressure > 1.9:
            recs.append(Recommendation(
                priority=1,
                parameter="tire_pressure",
                change="-0.15 to -0.20 bar all round (2-3 psi)",
                rationale="Technical track: larger contact patch for the rhythm sections",
                expected_impact="More mechanical grip in direction changes"
            ))

        if (
            conditions.track_type == "high_speed"
            and setup.rear_wing_angle_deg > 17
            and feedback.oversteer <= 0
        ):
            recs.append(Recommendation(
                priority=2,
                parameter="rear_wing_angle",
                change=f"-{setup.rear_wing_angle_deg - 13:.0f}° (toward the low end)",
                rationale="No oversteer reported: drag is free lap time on a high-speed track — "
                          "keep the front aero unchanged for stability",
                expected_impact="Higher straight-line speed; back the change out if the rear goes loose"
            ))

        hotlap_fuel = profile["hotlap_fuel_kg"]
        if conditions.session_type == "hotlap" and conditions.fuel_load_kg > hotlap_fuel + 10:
            recs.append(Recommendation(
                priority=3,
                parameter="fuel_load",
                change=f"-{conditions.fuel_load_kg - hotlap_fuel:.0f}kg (target ~{hotlap_fuel}kg)",
                rationale="Every 10kg of fuel costs roughly 0.3s/lap and loads the tires",
                expected_impact="Lower lap time and reduced tire degradation for the run"
            ))

        if (
            conditions.session_type == "hotlap"
            and setup.front_ride_height_mm > 45
            and max(setup.front_wheel_rate_nmm, setup.rear_wheel_rate_nmm)
                < profile["kerb_wheel_rate_limit"] - 60
        ):
            recs.append(Recommendation(
                priority=4,
                parameter="ride_height_and_wheel_rate",
                change="-2 to -4mm ride height, +20 to +40 N/mm wheel rate",
                rationale="Hotlap session: a lower, stiffer platform maximizes aero consistency",
                expected_impact="Better aero platform control — verify kerb clearance at apexes"
            ))

        if setup.final_drive_ratio < 3.0:
            recs.append(Recommendation(
                priority=5,
                parameter="final_drive",
                change="+0.1 to +0.3 (shorter)",
                rationale="Aim to touch the limiter 2-3 mph before the end of the longest straight",
                expected_impact="Full use of the gear stack without over-revving"
            ))
        elif setup.final_drive_ratio > 4.4:
            recs.append(Recommendation(
                priority=5,
                parameter="final_drive",
                change="-0.1 to -0.3 (longer)",
                rationale="Avoid sitting on the limiter before the braking point",
                expected_impact="Higher terminal speed on the longest straight"
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