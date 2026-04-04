"""SELVAM - ESG Router"""
from fastapi import APIRouter
from backend.services.financial_data import get_esg_data, get_company_news
from backend.ml.scoring_engine import ESGGNNScorer

router = APIRouter()
scorer = ESGGNNScorer()


def _weight(value):
    if value is None:
        return 0.2
    return max(0.1, min(1.0, value / 100))


@router.post("/graph/build")
async def build_esg_graph(ticker: str, include_network: bool = True):
    ticker = ticker.upper()
    esg_data = await get_esg_data(ticker)
    news = await get_company_news(ticker)
    result = scorer.compute_network_score(esg_data, None, news)
    return {
        "ticker": ticker,
        "scores": result,
        "graph_nodes": [
            {"id": ticker, "type": "company", "esg_score": result["overall_esg"]},
            {"id": f"{ticker}_env", "type": "esg_topic", "score": result["environmental"]},
            {"id": f"{ticker}_soc", "type": "esg_topic", "score": result["social"]},
            {"id": f"{ticker}_gov", "type": "esg_topic", "score": result["governance"]},
        ],
        "graph_edges": [
            {"source": ticker, "target": f"{ticker}_env", "weight": _weight(result["environmental"])},
            {"source": ticker, "target": f"{ticker}_soc", "weight": _weight(result["social"])},
            {"source": ticker, "target": f"{ticker}_gov", "weight": _weight(result["governance"])},
        ]
    }


@router.get("/{ticker}")
async def get_esg(ticker: str):
    ticker = ticker.upper()
    esg_data = await get_esg_data(ticker)
    news = await get_company_news(ticker)
    result = scorer.compute_network_score(esg_data, None, news)
    return result
