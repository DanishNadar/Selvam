from fastapi import APIRouter

from backend.ml.scoring_engine import ESGGNNScorer, FinancialHealthScorer, ValuationEngine
from backend.models.schemas import ValuationRequest
from backend.services.financial_data import (
    get_company_news,
    get_company_profile,
    get_esg_data,
    get_financial_statements,
    get_key_ratios,
)
from backend.services.llm_service import generate_investment_rationale

router = APIRouter()

health_scorer = FinancialHealthScorer()
val_engine = ValuationEngine()
esg_scorer = ESGGNNScorer()


SECTOR_MULTIPLES = {
    "Technology": {"pe": 28, "ev_ebitda": 18, "ps": 6},
    "Communication Services": {"pe": 22, "ev_ebitda": 14, "ps": 4},
    "Healthcare": {"pe": 24, "ev_ebitda": 15, "ps": 5},
    "Financial Services": {"pe": 14, "ev_ebitda": 10, "ps": 3},
    "Consumer Cyclical": {"pe": 20, "ev_ebitda": 12, "ps": 3},
    "Industrials": {"pe": 18, "ev_ebitda": 11, "ps": 2.5},
    "Energy": {"pe": 12, "ev_ebitda": 6, "ps": 1.5},
    "Utilities": {"pe": 16, "ev_ebitda": 10, "ps": 2},
}


def _sector_multiples(sector: str | None):
    if not sector:
        return {"pe": 20, "ev_ebitda": 12, "ps": 3}
    return SECTOR_MULTIPLES.get(sector, {"pe": 20, "ev_ebitda": 12, "ps": 3})


@router.post("/run")
async def run_valuation(req: ValuationRequest):
    import asyncio

    ticker = req.ticker.upper()

    profile, financials, ratios, esg_data, news = await asyncio.gather(
        get_company_profile(ticker),
        get_financial_statements(ticker),
        get_key_ratios(ticker),
        get_esg_data(ticker),
        get_company_news(ticker),
    )

    financials = {
        **financials,
        "market_cap": profile.get("market_cap"),
        "sector": profile.get("sector"),
        "name": profile.get("name"),
    }

    health = health_scorer.score(financials)
    valuation = val_engine.estimate_value(financials, ratios, _sector_multiples(profile.get("sector")))
    esg_result = esg_scorer.compute_network_score(esg_data, None, news)

    rationale = await generate_investment_rationale(
        ticker,
        profile.get("name", ticker),
        health,
        financials,
        esg_result,
    )

    sources = []
    sources.extend(profile.get("sources", []))
    sources.extend(financials.get("sources", []))
    sources.extend(ratios.get("sources", []))
    if esg_data.get("source"):
        sources.append({"name": esg_data["source"], "url": "https://site.financialmodelingprep.com/developer/docs/esg-score-api"})

    return {
        "ticker": ticker,
        "name": profile.get("name", ticker),
        "sector": profile.get("sector", ""),
        "country": profile.get("country", "US"),
        "exchange": profile.get("exchange", ""),
        "image": profile.get("image", ""),
        "market_cap": profile.get("market_cap", 0),
        "valuation": valuation,
        "health_scores": health,
        "financial_summary": {
            "current_ratio": financials.get("current_ratio"),
            "revenue": financials.get("revenue"),
            "net_income": financials.get("net_income"),
            "ebitda": financials.get("ebitda"),
            "debt_to_equity": financials.get("debt_to_equity"),
            "profit_margin": financials.get("profit_margin"),
            "revenue_growth": financials.get("revenue_growth"),
            "free_cash_flow": financials.get("free_cash_flow"),
            "gross_profit": financials.get("gross_profit"),
            "total_assets": financials.get("total_assets"),
            "total_debt": financials.get("total_debt"),
        },
        "revenue_history": financials.get("revenue_history", []),
        "income_history": financials.get("income_history", []),
        "esg": esg_result,
        "esg_raw": esg_data,
        "ratios": ratios,
        "investment_rationale": rationale,
        "sources": sources,
        "news": news[:5],
    }
