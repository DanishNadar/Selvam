from fastapi import APIRouter, HTTPException, Query

from backend.services.financial_data import (
    get_company_news,
    get_company_profile,
    get_esg_data,
    get_financial_statements,
    get_key_ratios,
    search_companies,
)

router = APIRouter()


@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    results = await search_companies(q)
    return {"results": results, "count": len(results)}


@router.get("/{ticker}")
async def get_company(ticker: str):
    ticker = ticker.upper()
    profile = await get_company_profile(ticker)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Company {ticker} not found")
    return profile


@router.get("/{ticker}/financials")
async def get_financials(ticker: str):
    ticker = ticker.upper()
    return await get_financial_statements(ticker)


@router.get("/{ticker}/ratios")
async def get_ratios(ticker: str):
    ticker = ticker.upper()
    return await get_key_ratios(ticker)


@router.get("/{ticker}/news")
async def get_news(ticker: str, company_name: str = ""):
    ticker = ticker.upper()
    news = await get_company_news(ticker, company_name)
    return {"articles": news, "count": len(news)}


@router.get("/{ticker}/esg")
async def get_esg(ticker: str, company_name: str = ""):
    ticker = ticker.upper()
    return await get_esg_data(ticker, company_name)
