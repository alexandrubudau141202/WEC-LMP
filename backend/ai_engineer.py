"""
WEC LMP Diagnostic Assistant - AI Race Engineer
================================================

LLM-powered natural-language analysis layer (Groq free tier).

The deterministic diagnostic engine remains the source of truth for
physics: it computes the issue, severity, confidence, contributing
factors, and recommendations. The LLM's job is purely communicative —
turn those computed facts into the kind of debrief a performance
engineer would give the driver over the radio.

Requires GROQ_API_KEY in the environment (free key from
https://console.groq.com). If no key is set or the API call fails,
the caller falls back to the template-based summary.

Author: Alexandru
"""

import json
import logging

import groq

from models import (
    CarClass, CarIdentification, Diagnosis, Setup, DriverFeedback, TrackConditions
)

logger = logging.getLogger(__name__)

MODEL = "llama-3.3-70b-versatile"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Class-specific engineering context injected into the system prompt so the
# debrief speaks the right car's language (hybrid vs no hybrid, underbody vs
# wing-dominant aero, tire and fuel characteristics).
CAR_CONTEXT: dict[str, str] = {
    "hypercar": """Class: LMH/LMDh Hypercar (Porsche 963, Ferrari 499P, Cadillac V-Series.R,
BMW M Hybrid V8, Aston Martin Valkyrie AMR-LMH...).
- Hybrid powertrain (MGU-K); hybrid deployment and regen interact with traction
  and braking stability. (Exception: the Valkyrie races without hybrid boost —
  keep hybrid comments out if the specific car is the Valkyrie.)
- Underbody/diffuser dominates downforce: rake (rear minus front ride height)
  is the single most sensitive parameter; efficient window roughly 3-12mm.
- ~90L fuel capacity, ~1030-1060kg. Slicks around 1.8-2.0 bar hot.""",
    "lmp2": """Class: LMP2 (Oreca 07 and equivalent spec prototypes).
- Naturally aspirated Gibson 4.2L V8, NO hybrid system — never mention hybrid
  deployment or regen for this car.
- Spec prototype with underbody-dominant aero like the Hypercar, slightly wider
  efficient rake window (~3-14mm), less power so corner speed matters more.
- ~75L fuel capacity, ~930kg. Slicks around 1.8-2.0 bar hot.""",
    "gt3": """Class: GT3/GTE (Porsche 911 GT3 R / RSR, BMW M4 GT3, Ferrari 296 GT3,
Audi R8 LMS...).
- Production-based, NO hybrid system — never mention hybrid deployment or
  regen for this car.
- Wing-dominant aero: the rear wing, not the floor, carries most of the load,
  so the car is far less rake-sensitive than a prototype.
- Kerb compliance matters — the platform must stay softer than a prototype.
- Engine layout varies by model (rear-engine 911, mid-engine 296, front-engine
  M4/R8-derivatives) — reason from the specific car named below when
  discussing balance and traction.
- ~100-120L fuel capacity, ~1250-1350kg. ABS and traction control available.""",
}

SYSTEM_PROMPT_TEMPLATE = """You are a senior performance engineer for a WEC/IMSA team.
You are given the output of a deterministic setup-diagnostic engine: the identified
handling issue, its severity and confidence, the contributing factors it detected,
and its recommended setup changes — plus the raw setup, driver feedback, and track
conditions that produced them.

{car_context}
{car_line}
Write a trackside engineering debrief for the driver and race engineer:
- 3 to 5 sentences of flowing prose, radio-debrief tone, no headings or bullet points.
- Ground every claim strictly in the data provided. Do not invent numbers,
  factors, or recommendations that are not in the input.
- Explain the causal chain: which setup parameters are producing the reported
  behaviour and why the top recommendation addresses it, using the car
  characteristics above where relevant.
- If the engine found no issues, confirm the platform is in a good window and
  note what to monitor as fuel burns off and tyres age.
"""

# Lazy singleton — constructed on first use so a missing key surfaces as a
# catchable error per-request instead of crashing the server at import time.
_client: groq.AsyncGroq | None = None


def _get_client() -> groq.AsyncGroq:
    global _client
    if _client is None:
        _client = groq.AsyncGroq()  # reads GROQ_API_KEY from the environment
    return _client


def _build_prompt(
    diagnosis: Diagnosis,
    setup: Setup,
    feedback: DriverFeedback,
    conditions: TrackConditions,
) -> str:
    return (
        "## Diagnostic engine output\n"
        f"{diagnosis.model_dump_json(indent=2, exclude={'ai_analysis'})}\n\n"
        "## Car setup\n"
        f"{setup.model_dump_json(indent=2)}\n\n"
        "## Driver feedback (-5 to +5 scales)\n"
        f"{feedback.model_dump_json(indent=2)}\n\n"
        "## Track conditions\n"
        f"{conditions.model_dump_json(indent=2)}\n\n"
        "Write the debrief."
    )


async def generate_ai_analysis(
    diagnosis: Diagnosis,
    setup: Setup,
    feedback: DriverFeedback,
    conditions: TrackConditions,
    car_class: CarClass = "hypercar",
    car_name: str | None = None,
) -> str | None:
    """
    Ask the LLM to write the engineering debrief for the given car.

    Returns None on any failure (no key, network error, rate limit)
    so the endpoint can degrade gracefully to the template summary.
    """
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        car_context=CAR_CONTEXT[car_class],
        car_line=(
            f"\nThe specific car is a {car_name} — refer to it by name in the debrief.\n"
            if car_name else ""
        ),
    )
    try:
        response = await _get_client().chat.completions.create(
            model=MODEL,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": _build_prompt(diagnosis, setup, feedback, conditions),
                },
            ],
        )

        text = (response.choices[0].message.content or "").strip()
        return text or None

    except groq.APIConnectionError:
        logger.warning("Groq API unreachable — falling back to template summary")
        return None
    except groq.RateLimitError:
        logger.warning("Groq free-tier rate limit hit — falling back to template summary")
        return None
    except groq.APIStatusError as e:
        logger.warning("Groq API error %s — falling back to template summary", e.status_code)
        return None
    except groq.GroqError:
        # Raised at client construction when GROQ_API_KEY is not set
        logger.warning(
            "No Groq credentials configured (set GROQ_API_KEY — free key at "
            "https://console.groq.com) — falling back to template summary"
        )
        return None
    except Exception:
        logger.exception("Unexpected error generating AI analysis")
        return None


TELEMETRY_SYSTEM_PROMPT = """You are a senior performance engineer for a WEC/IMSA team
reviewing stint telemetry with the driver after a run.

You are given a JSON report computed from the telemetry: session summary (laps,
best lap, speeds), driver inputs, average tire temperatures and thermal balance,
and any issues a rule engine flagged.

Write the stint debrief:
- 3 to 6 sentences of flowing prose, radio-debrief tone, no headings or bullets.
- Ground every claim strictly in the numbers provided — do not invent laps,
  temperatures, or setup values that are not in the report.
- Cover pace (best lap and what the averages suggest), tire thermal balance and
  what it implies for pressures or aero, and the flagged issues in priority order.
- Close with the single most valuable change to try next stint.
"""


async def generate_telemetry_summary(report: dict) -> str | None:
    """
    Ask the LLM to write a stint debrief from the Telemetry tab's report.

    Returns None on any failure (no key, network error, rate limit)
    so the endpoint can degrade gracefully.
    """
    try:
        response = await _get_client().chat.completions.create(
            model=MODEL,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": TELEMETRY_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "## Telemetry report\n"
                        f"{json.dumps(report, indent=2)}\n\n"
                        "Write the debrief."
                    ),
                },
            ],
        )
        text = (response.choices[0].message.content or "").strip()
        return text or None

    except groq.APIConnectionError:
        logger.warning("Groq API unreachable — no telemetry summary")
        return None
    except groq.RateLimitError:
        logger.warning("Groq free-tier rate limit hit — no telemetry summary")
        return None
    except groq.APIStatusError as e:
        logger.warning("Groq API error %s — no telemetry summary", e.status_code)
        return None
    except groq.GroqError:
        logger.warning(
            "No Groq credentials configured (set GROQ_API_KEY — free key at "
            "https://console.groq.com) — no telemetry summary"
        )
        return None
    except Exception:
        logger.exception("Unexpected error generating telemetry summary")
        return None


IDENTIFY_PROMPT = """You are a motorsport expert. Look at the photo and classify the race car
into exactly one of these categories:

- "hypercar": LMH/LMDh prototypes (Porsche 963, Ferrari 499P, Toyota GR010,
  Cadillac V-Series.R, BMW M Hybrid V8, Peugeot 9X8, Alpine A424, Lamborghini SC63...).
  Closed-cockpit prototypes with large sculpted bodywork, no exposed wheels.
- "lmp2": LMP2 prototypes (Oreca 07, Ligier JS P217, Dallara P217). Closed-cockpit
  prototypes, simpler bodywork than Hypercars, usually a large shark fin.
- "gt3": GT3/GTE production-based race cars (Porsche 911 GT3 R / RSR, Ferrari 296 GT3,
  Corvette Z06 GT3.R, BMW M4 GT3, Aston Martin Vantage...). Recognizable road-car
  silhouette with a big rear wing.
- "unknown": not a race car, or impossible to tell.

Respond with ONLY a JSON object, no other text:
{"car_class": "hypercar" | "lmp2" | "gt3" | "unknown",
 "model_name": "<specific model, e.g. 'Porsche 963', or 'unidentified'>",
 "confidence": <0.0-1.0>,
 "reasoning": "<one sentence on the visual cues you used>"}"""


async def identify_car(
    image_b64: str,
    mime_type: str,
    garage: list[dict] | None = None,
) -> CarIdentification | None:
    """
    Recognize a race car from a photo using Groq's vision model.

    When a garage list is supplied ([{id, name, car_class}, ...]), the model
    also matches the photo to the closest garage entry so the frontend can
    auto-select that exact car and its 3D model.

    Returns None on any failure so the endpoint can report 'AI unavailable'.
    """
    prompt = IDENTIFY_PROMPT
    if garage:
        garage_lines = "\n".join(
            f"- {c['id']}: {c['name']} ({c['car_class']})" for c in garage
        )
        prompt += (
            "\n\nThe team garage contains these cars:\n"
            f"{garage_lines}\n\n"
            'Additionally include "car_id" in the JSON: the id of the garage entry '
            "that best matches the photographed car (exact model preferred; if the "
            "exact model is not in the garage, the closest car of the same class). "
            'Use null only when car_class is "unknown".'
        )

    try:
        response = await _get_client().chat.completions.create(
            model=VISION_MODEL,
            max_tokens=512,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{image_b64}"},
                        },
                    ],
                }
            ],
        )

        raw = response.choices[0].message.content or ""
        data = json.loads(raw)

        # Only accept a car_id that actually exists in the supplied garage
        car_id = data.get("car_id")
        valid_ids = {c["id"] for c in garage} if garage else set()
        if car_id not in valid_ids:
            car_id = None

        return CarIdentification(
            car_class=data.get("car_class", "unknown"),
            model_name=data.get("model_name", "unidentified"),
            confidence=max(0.0, min(1.0, float(data.get("confidence", 0)))),
            reasoning=data.get("reasoning", ""),
            car_id=car_id,
        )

    except (json.JSONDecodeError, ValueError, KeyError):
        logger.warning("Vision model returned unparseable identification")
        return None
    except groq.GroqError:
        logger.warning("Groq unavailable for car identification")
        return None
    except Exception:
        logger.exception("Unexpected error identifying car")
        return None
