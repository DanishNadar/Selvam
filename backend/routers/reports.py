"""SELVAM - Reports Router"""
from fastapi import APIRouter
import sys, json
sys.path.append('/home/claude/selvam/backend')

router = APIRouter()

@router.post("/generate")
async def generate_report(
    analysis_type: str = "merger",
    company_x_ticker: str = "",
    company_y_ticker: str = "",
    risk_tolerance: str = "moderate"
):
    return {
        "report_id": f"RPT-{company_x_ticker}-{company_y_ticker}-001",
        "status": "generated",
        "message": "Report generated. Use PDF export in the dashboard.",
        "sections": ["Executive Summary", "Valuation Analysis", "Merger Feasibility", "ESG Assessment", "Risk Evaluation", "Sources & Citations"]
    }

@router.get("/{report_id}")
async def get_report(report_id: str):
    return {"report_id": report_id, "status": "available"}
