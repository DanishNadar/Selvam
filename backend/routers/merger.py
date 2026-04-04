"""SELVAM - Merger Analysis Router"""
from fastapi import APIRouter
from backend.models.schemas import MergerAnalysisRequest
from backend.services.financial_data import (
    get_company_profile, get_financial_statements,
    get_esg_data, get_company_news
)
from backend.services.llm_service import analyze_article, generate_merger_insights
from backend.ml.scoring_engine import (
    MergerFeasibilityEngine, ESGGNNScorer,
    CompositeScorer, RiskToleranceEngine
)

router = APIRouter()

merger_engine = MergerFeasibilityEngine()
esg_scorer = ESGGNNScorer()
composite = CompositeScorer()
risk_engine = RiskToleranceEngine()


@router.post("/analyze")
async def analyze_merger(req: MergerAnalysisRequest):
    import asyncio

    ticker_x = req.company_x_ticker.upper()
    ticker_y = req.company_y_ticker.upper()

    profile_x, profile_y, fin_x, fin_y, esg_x_raw, esg_y_raw, news_x, news_y = await asyncio.gather(
        get_company_profile(ticker_x),
        get_company_profile(ticker_y),
        get_financial_statements(ticker_x),
        get_financial_statements(ticker_y),
        get_esg_data(ticker_x),
        get_esg_data(ticker_y),
        get_company_news(ticker_x),
        get_company_news(ticker_y),
    )

    fin_x = {**fin_x, "market_cap": profile_x.get("market_cap"), "name": profile_x.get("name")}
    fin_y = {**fin_y, "market_cap": profile_y.get("market_cap"), "name": profile_y.get("name")}

    esg_result_x = esg_scorer.compute_network_score(esg_x_raw, None, news_x)
    esg_result_y = esg_scorer.compute_network_score(esg_y_raw, None, news_y)

    esg_values = [value for value in [esg_result_x.get("overall_esg"), esg_result_y.get("overall_esg")] if value is not None]
    esg_compat = sum(esg_values) / len(esg_values) if esg_values else None

    sentiments = []
    all_news = (news_x or []) + (news_y or [])
    for article in all_news[:10]:
        score = article.get("sentiment_score")
        if isinstance(score, (int, float)):
            sentiments.append(float(score))
    news_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.0

    article_results = []
    article_impact = 0.0
    for url in (req.user_article_urls or [])[:5]:
        art = await analyze_article(url, ticker_x, ticker_y)
        article_results.append(art)
        article_impact += art.get("score_delta", 0.0)

    merger_result = merger_engine.analyze(
        fin_x, fin_y, profile_x, profile_y,
        esg_result_x, esg_result_y, news_sentiment,
        article_impact / max(1, len(article_results)),
        req.risk_tolerance.value
    )

    risk_adj = risk_engine.adjust(
        merger_result["probability_of_success"],
        req.risk_tolerance.value,
        {**fin_x, "controversy_score": esg_result_x.get("controversy_score", 0.0)}
    )

    fin_health = merger_result["financial_health_score"]
    val_attract = min(90, fin_health * 0.9 + merger_result["synergy_potential"] * 0.1)
    momentum = min(90, 50 + news_sentiment * 40)
    art_score = min(90, max(10, 50 + (article_impact / max(1, len(article_results))))) if article_results else 50
    esg_component = (esg_compat * req.esg_weight) if esg_compat is not None else 0

    sub_scores = composite.compute(
        fin_health, val_attract, merger_result["overall_score"],
        esg_component,
        momentum, art_score,
        req.risk_tolerance.value,
        risk_adj["penalty"]
    )

    insights = await generate_merger_insights(
        ticker_x, ticker_y, merger_result, fin_x, fin_y
    )

    sources = []
    sources.extend(profile_x.get("sources", []))
    sources.extend(profile_y.get("sources", []))
    sources.extend(fin_x.get("sources", []))
    sources.extend(fin_y.get("sources", []))
    for art in all_news[:4]:
        if art.get("url"):
            sources.append({
                "name": art.get("title", "")[:80],
                "publisher": art.get("publisher", ""),
                "url": art.get("url", ""),
                "date": art.get("date", ""),
            })

    return {
        "company_x": {
            "ticker": ticker_x,
            "name": profile_x.get("name", ticker_x),
            "sector": profile_x.get("sector", ""),
            "market_cap": profile_x.get("market_cap", 0),
            "current_ratio": fin_x.get("current_ratio"),
            "revenue": fin_x.get("revenue", 0),
            "profit_margin": fin_x.get("profit_margin"),
            "debt_to_equity": fin_x.get("debt_to_equity"),
            "esg_score": esg_result_x.get("overall_esg"),
            "financial_health": merger_result["financial_health_score"],
        },
        "company_y": {
            "ticker": ticker_y,
            "name": profile_y.get("name", ticker_y),
            "sector": profile_y.get("sector", ""),
            "market_cap": profile_y.get("market_cap", 0),
            "current_ratio": fin_y.get("current_ratio"),
            "revenue": fin_y.get("revenue", 0),
            "profit_margin": fin_y.get("profit_margin"),
            "debt_to_equity": fin_y.get("debt_to_equity"),
            "esg_score": esg_result_y.get("overall_esg"),
            "financial_health": merger_result["financial_health_score"],
        },
        "merger_analysis": {
            **merger_result,
            **sub_scores,
            "risk_tolerance_fit": risk_adj["adjusted_score"],
            "risk_factors": risk_adj["risk_factors"],
            "confidence_level": min(95, 60 + min(20, len(all_news) * 2) + min(15, len(article_results) * 3)),
        },
        "esg": {
            "company_x": esg_result_x,
            "company_y": esg_result_y,
            "compatibility": round(esg_compat, 1) if esg_compat is not None else None,
        },
        "article_analysis": {
            "articles": article_results,
            "total_delta": round(article_impact, 2),
            "count": len(article_results),
        },
        "insights": insights,
        "sources": sources[:12],
        "news": {
            "company_x": news_x[:5],
            "company_y": news_y[:5],
        }
    }
