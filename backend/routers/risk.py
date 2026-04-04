"""SELVAM - Risk Router"""
from fastapi import APIRouter
from backend.models.schemas import RiskProfileRequest
from backend.ml.scoring_engine import RiskToleranceEngine

router = APIRouter()
engine = RiskToleranceEngine()

@router.post("/profile")
async def create_risk_profile(req: RiskProfileRequest):
    return {
        "risk_tolerance": req.risk_tolerance,
        "time_horizon": req.time_horizon,
        "esg_importance": req.esg_importance,
        "max_acceptable_leverage": req.max_acceptable_leverage,
        "profile_summary": f"{req.risk_tolerance.value.title()} investor, {req.time_horizon.value} horizon, ESG weight {req.esg_importance:.0%}"
    }
