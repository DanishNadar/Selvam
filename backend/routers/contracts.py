"""SELVAM - Contracts Router"""
from fastapi import APIRouter
from backend.models.schemas import ContractDraftRequest
from backend.services.llm_service import draft_contract

router = APIRouter()

@router.post("/draft")
async def create_contract_draft(req: ContractDraftRequest):
    result = await draft_contract(
        req.company_x_ticker,
        req.company_y_ticker,
        req.transaction_type.value,
        req.valuation_range_low,
        req.valuation_range_high,
        req.deal_terms,
        req.esg_clauses,
        req.due_diligence_notes
    )
    return {
        **result,
        "disclaimer": "⚠️ This is an AI-generated draft for discussion purposes only. It does not constitute legal advice and must be reviewed by qualified legal counsel before use.",
        "companies": {
            "x": req.company_x_ticker,
            "y": req.company_y_ticker
        },
        "transaction_type": req.transaction_type.value,
        "valuation_range": {
            "low": req.valuation_range_low,
            "high": req.valuation_range_high
        }
    }
