"""
SELVAM - Financial data service.

Uses live provider endpoints without fabricating valuation inputs.
Primary provider: Financial Modeling Prep stable endpoints.
Fallback provider for fundamentals/profile: Alpha Vantage.
Supplementary providers: Finnhub (profile/search/ESG), NewsAPI (news).
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.services.errors import UpstreamDataError

logger = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"
FINNHUB_BASE = "https://finnhub.io/api/v1"
ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query"
NEWS_BASE = "https://newsapi.org/v2"
DEFAULT_HEADERS = {"User-Agent": "SELVAM/1.2 (research@local)"}
CACHE_TTL_SECONDS = 300

POSITIVE_NEWS_WORDS = {
    "beat", "beats", "growth", "surge", "record", "strong", "expands", "launch",
    "acquire", "acquisition", "profit", "raises", "upgrade", "partnership", "ai",
    "innovation", "approval", "win", "outperform",
}
NEGATIVE_NEWS_WORDS = {
    "miss", "drops", "decline", "lawsuit", "probe", "antitrust", "fine", "layoffs",
    "recall", "breach", "downgrade", "cuts", "weak", "loss", "fraud", "investigation",
    "delay", "risk", "warning",
}
CONTROVERSY_WORDS = {
    "lawsuit", "probe", "antitrust", "breach", "fraud", "recall", "fine", "investigation",
    "whistleblower", "sanction", "penalty", "regulator", "doj", "sec",
}

_CACHE: Dict[Tuple[str, str], Tuple[float, Any]] = {}


def _cache_get(namespace: str, key: str) -> Any:
    cached = _CACHE.get((namespace, key))
    if not cached:
        return None
    timestamp, value = cached
    if time.time() - timestamp > CACHE_TTL_SECONDS:
        _CACHE.pop((namespace, key), None)
        return None
    return value


def _cache_set(namespace: str, key: str, value: Any) -> Any:
    _CACHE[(namespace, key)] = (time.time(), value)
    return value


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def _client(timeout: float = 20.0) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, headers=DEFAULT_HEADERS, follow_redirects=True)


def _is_missing(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> Optional[int]:
    num = _to_float(value)
    return int(num) if num is not None else None


def _first_non_empty(*values: Any) -> Any:
    for value in values:
        if not _is_missing(value):
            return value
    return None


def _format_provider_error(provider: str, status_code: int, body: str) -> str:
    clipped = body.replace("\n", " ")[:220]
    return f"{provider} returned HTTP {status_code}. {clipped}".strip()


async def _get_json(
    client: httpx.AsyncClient,
    url: str,
    params: Optional[Dict[str, Any]] = None,
    provider: str = "upstream",
) -> Any:
    response = await client.get(url, params=params)
    body = response.text or ""
    if response.status_code >= 400:
        raise UpstreamDataError(_format_provider_error(provider, response.status_code, body), provider=provider)

    try:
        data = response.json()
    except ValueError as exc:
        raise UpstreamDataError(f"{provider} returned invalid JSON.", provider=provider) from exc

    if isinstance(data, dict):
        for key in ["Error Message", "error", "message", "Note", "Information"]:
            msg = data.get(key)
            if isinstance(msg, str) and msg.strip():
                lowered = msg.lower()
                if "no data" in lowered or "no match" in lowered or "not found" in lowered:
                    continue
                raise UpstreamDataError(f"{provider}: {msg}", provider=provider)
    return data


def _normalize_profile_from_fmp(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": raw.get("companyName") or raw.get("name"),
        "sector": raw.get("sector"),
        "industry": raw.get("industry"),
        "description": raw.get("description"),
        "country": raw.get("country"),
        "exchange": raw.get("exchangeShortName") or raw.get("exchange"),
        "market_cap": _to_float(raw.get("mktCap") or raw.get("marketCap")),
        "employees": _to_int(raw.get("fullTimeEmployees")),
        "website": raw.get("website"),
        "image": raw.get("image"),
        "ipo_date": raw.get("ipoDate"),
        "currency": raw.get("currency"),
        "source": "FMP",
    }


def _normalize_profile_from_finnhub(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": raw.get("name"),
        "sector": raw.get("finnhubIndustry"),
        "industry": raw.get("finnhubIndustry"),
        "description": None,
        "country": raw.get("country"),
        "exchange": raw.get("exchange"),
        "market_cap": _to_float(raw.get("marketCapitalization")),
        "employees": _to_int(raw.get("employeeTotal")),
        "website": raw.get("weburl"),
        "image": raw.get("logo"),
        "ipo_date": raw.get("ipo"),
        "currency": raw.get("currency"),
        "source": "Finnhub",
    }


def _normalize_profile_from_alpha(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": raw.get("Name"),
        "sector": raw.get("Sector"),
        "industry": raw.get("Industry"),
        "description": raw.get("Description"),
        "country": raw.get("Country"),
        "exchange": raw.get("Exchange"),
        "market_cap": _to_float(raw.get("MarketCapitalization")),
        "employees": None,
        "website": raw.get("OfficialSite"),
        "image": "",
        "ipo_date": None,
        "currency": raw.get("Currency"),
        "source": "Alpha Vantage",
    }


def _normalize_alpha_income(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    statements = raw.get("annualReports") or raw.get("quarterlyReports") or []
    normalized = []
    for item in statements[:5]:
        normalized.append({
            "date": item.get("fiscalDateEnding", ""),
            "revenue": _to_float(item.get("totalRevenue")) or 0.0,
            "grossProfit": _to_float(item.get("grossProfit")) or 0.0,
            "operatingIncome": _to_float(item.get("operatingIncome")) or 0.0,
            "netIncome": _to_float(item.get("netIncome")) or 0.0,
            "ebitda": _to_float(item.get("ebitda")) or _to_float(item.get("operatingIncome")) or 0.0,
        })
    return normalized


def _normalize_alpha_balance(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    statements = raw.get("annualReports") or raw.get("quarterlyReports") or []
    normalized = []
    for item in statements[:5]:
        normalized.append({
            "date": item.get("fiscalDateEnding", ""),
            "totalAssets": _to_float(item.get("totalAssets")) or 0.0,
            "totalLiabilities": _to_float(item.get("totalLiabilities")) or 0.0,
            "totalCurrentAssets": _to_float(item.get("totalCurrentAssets")) or 0.0,
            "totalCurrentLiabilities": _to_float(item.get("totalCurrentLiabilities")) or 0.0,
            "cashAndCashEquivalents": _to_float(item.get("cashAndCashEquivalentsAtCarryingValue")) or _to_float(item.get("cashAndShortTermInvestments")) or 0.0,
            "totalDebt": _to_float(item.get("shortLongTermDebtTotal")) or _to_float(item.get("currentLongTermDebt")) or _to_float(item.get("longTermDebt") or 0.0),
            "totalStockholdersEquity": _to_float(item.get("totalShareholderEquity")) or 0.0,
        })
    return normalized


def _normalize_alpha_cashflow(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    statements = raw.get("annualReports") or raw.get("quarterlyReports") or []
    normalized = []
    for item in statements[:5]:
        operating_cash_flow = _to_float(item.get("operatingCashflow")) or 0.0
        capex = _to_float(item.get("capitalExpenditures")) or 0.0
        normalized.append({
            "date": item.get("fiscalDateEnding", ""),
            "operatingCashFlow": operating_cash_flow,
            "freeCashFlow": operating_cash_flow - abs(capex),
        })
    return normalized


def _normalize_alpha_overview_to_ratios(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "current_ratio": None,
        "quick_ratio": None,
        "debt_to_equity": None,
        "price_to_earnings": _to_float(raw.get("PERatio")),
        "price_to_book": _to_float(raw.get("PriceToBookRatio")),
        "ev_to_ebitda": _to_float(raw.get("EVToEBITDA")),
        "return_on_equity": _to_float(raw.get("ReturnOnEquityTTM")),
        "return_on_assets": _to_float(raw.get("ReturnOnAssetsTTM")),
        "profit_margin": _to_float(raw.get("ProfitMargin")),
        "revenue_growth": _to_float(raw.get("QuarterlyRevenueGrowthYOY")),
        "dividend_yield": _to_float(raw.get("DividendYield")),
        "sources": [{"name": "Alpha Vantage", "url": "https://www.alphavantage.co/documentation/"}],
    }


def _derive_ratios_from_financials(financials: Dict[str, Any]) -> Dict[str, Any]:
    current_ratio = financials.get("current_ratio")
    debt_to_equity = financials.get("debt_to_equity")
    profit_margin = financials.get("profit_margin")
    return {
        "current_ratio": current_ratio,
        "quick_ratio": current_ratio,
        "debt_to_equity": debt_to_equity,
        "price_to_earnings": None,
        "price_to_book": None,
        "ev_to_ebitda": None,
        "return_on_equity": None,
        "return_on_assets": None,
        "profit_margin": profit_margin,
        "revenue_growth": financials.get("revenue_growth"),
        "dividend_yield": None,
        "sources": financials.get("sources", []),
    }


async def _get_alpha_overview(client: httpx.AsyncClient, ticker: str, alpha_key: str) -> Dict[str, Any]:
    data = await _get_json(
        client,
        ALPHA_VANTAGE_BASE,
        {"function": "OVERVIEW", "symbol": ticker, "apikey": alpha_key},
        provider="Alpha Vantage",
    )
    if not isinstance(data, dict) or not data.get("Symbol"):
        raise UpstreamDataError(f"Alpha Vantage returned no company overview for {ticker}.", provider="Alpha Vantage")
    return data


async def _get_alpha_fundamentals(client: httpx.AsyncClient, ticker: str, alpha_key: str) -> Dict[str, Any]:
    income = await _get_json(
        client,
        ALPHA_VANTAGE_BASE,
        {"function": "INCOME_STATEMENT", "symbol": ticker, "apikey": alpha_key},
        provider="Alpha Vantage",
    )
    balance = await _get_json(
        client,
        ALPHA_VANTAGE_BASE,
        {"function": "BALANCE_SHEET", "symbol": ticker, "apikey": alpha_key},
        provider="Alpha Vantage",
    )
    cashflow = await _get_json(
        client,
        ALPHA_VANTAGE_BASE,
        {"function": "CASH_FLOW", "symbol": ticker, "apikey": alpha_key},
        provider="Alpha Vantage",
    )
    return {
        "income": _normalize_alpha_income(income),
        "balance": _normalize_alpha_balance(balance),
        "cashflow": _normalize_alpha_cashflow(cashflow),
    }


async def get_company_profile(ticker: str) -> Dict[str, Any]:
    ticker = ticker.upper().strip()
    cached = _cache_get("profile", ticker)
    if cached is not None:
        return cached

    fmp_key = _env("FMP_API_KEY")
    finnhub_key = _env("FINNHUB_API_KEY")
    alpha_key = _env("ALPHA_VANTAGE_KEY")
    if not fmp_key and not finnhub_key and not alpha_key:
        raise UpstreamDataError(
            "No financial data API keys found. Set FMP_API_KEY, FINNHUB_API_KEY, and/or ALPHA_VANTAGE_KEY in the backend environment.",
            provider="configuration",
        )

    errors: List[str] = []
    fmp_profile: Dict[str, Any] = {}
    finnhub_profile: Dict[str, Any] = {}
    alpha_profile: Dict[str, Any] = {}

    async with _client(15.0) as client:
        if fmp_key:
            try:
                data = await _get_json(
                    client,
                    f"{FMP_STABLE_BASE}/profile",
                    {"symbol": ticker, "apikey": fmp_key},
                    provider="FMP",
                )
                if isinstance(data, list) and data:
                    fmp_profile = _normalize_profile_from_fmp(data[0])
            except UpstreamDataError as exc:
                errors.append(exc.message)

        if finnhub_key:
            try:
                data = await _get_json(
                    client,
                    f"{FINNHUB_BASE}/stock/profile2",
                    {"symbol": ticker, "token": finnhub_key},
                    provider="Finnhub",
                )
                if isinstance(data, dict) and any(data.values()):
                    finnhub_profile = _normalize_profile_from_finnhub(data)
            except UpstreamDataError as exc:
                errors.append(exc.message)

        if alpha_key:
            try:
                data = await _get_alpha_overview(client, ticker, alpha_key)
                alpha_profile = _normalize_profile_from_alpha(data)
            except UpstreamDataError as exc:
                errors.append(exc.message)

    merged = {
        "ticker": ticker,
        "name": _first_non_empty(fmp_profile.get("name"), finnhub_profile.get("name"), alpha_profile.get("name"), ticker),
        "sector": _first_non_empty(fmp_profile.get("sector"), finnhub_profile.get("sector"), alpha_profile.get("sector")),
        "industry": _first_non_empty(fmp_profile.get("industry"), finnhub_profile.get("industry"), alpha_profile.get("industry")),
        "description": _first_non_empty(fmp_profile.get("description"), finnhub_profile.get("description"), alpha_profile.get("description"), ""),
        "country": _first_non_empty(fmp_profile.get("country"), finnhub_profile.get("country"), alpha_profile.get("country"), "US"),
        "exchange": _first_non_empty(fmp_profile.get("exchange"), finnhub_profile.get("exchange"), alpha_profile.get("exchange"), ""),
        "market_cap": _first_non_empty(fmp_profile.get("market_cap"), finnhub_profile.get("market_cap"), alpha_profile.get("market_cap"), 0),
        "employees": _first_non_empty(fmp_profile.get("employees"), finnhub_profile.get("employees"), alpha_profile.get("employees"), 0),
        "website": _first_non_empty(fmp_profile.get("website"), finnhub_profile.get("website"), alpha_profile.get("website"), ""),
        "image": _first_non_empty(fmp_profile.get("image"), finnhub_profile.get("image"), alpha_profile.get("image"), ""),
        "ipo_date": _first_non_empty(fmp_profile.get("ipo_date"), finnhub_profile.get("ipo_date"), alpha_profile.get("ipo_date"), ""),
        "currency": _first_non_empty(fmp_profile.get("currency"), finnhub_profile.get("currency"), alpha_profile.get("currency"), "USD"),
        "is_active": True,
        "sources": [],
    }

    if fmp_profile:
        merged["sources"].append({"name": "Financial Modeling Prep", "url": f"https://site.financialmodelingprep.com/developer/docs/stable/profile-symbol"})
    if finnhub_profile:
        merged["sources"].append({"name": "Finnhub", "url": "https://finnhub.io/docs/api"})
    if alpha_profile:
        merged["sources"].append({"name": "Alpha Vantage", "url": "https://www.alphavantage.co/documentation/"})

    has_real_profile = bool(fmp_profile or finnhub_profile or alpha_profile)
    if not has_real_profile or (merged["name"] == ticker and not merged["market_cap"] and not merged["sector"]):
        raise UpstreamDataError(
            f"No live company profile data was returned for {ticker}. Check the symbol and verify your configured provider keys have profile access.",
            provider="company-profile",
            errors=errors,
        )

    return _cache_set("profile", ticker, merged)


async def get_financial_statements(ticker: str) -> Dict[str, Any]:
    ticker = ticker.upper().strip()
    cached = _cache_get("financials", ticker)
    if cached is not None:
        return cached

    fmp_key = _env("FMP_API_KEY")
    alpha_key = _env("ALPHA_VANTAGE_KEY")
    if not fmp_key and not alpha_key:
        raise UpstreamDataError(
            "Fundamental data requires FMP_API_KEY and/or ALPHA_VANTAGE_KEY. Add at least one provider key and restart the backend.",
            provider="configuration",
        )

    results: Dict[str, Any] = {}
    errors: List[str] = []

    async with _client(25.0) as client:
        if fmp_key:
            endpoints = {
                "income": f"{FMP_STABLE_BASE}/income-statement",
                "balance": f"{FMP_STABLE_BASE}/balance-sheet-statement",
                "cashflow": f"{FMP_STABLE_BASE}/cash-flow-statement",
            }
            for key, url in endpoints.items():
                try:
                    data = await _get_json(client, url, {"symbol": ticker, "limit": 5, "apikey": fmp_key}, provider="FMP")
                    if isinstance(data, list) and data:
                        results[key] = data[:5]
                except UpstreamDataError as exc:
                    errors.append(exc.message)

        missing_keys = [key for key in ["income", "balance", "cashflow"] if key not in results]
        if missing_keys and alpha_key:
            try:
                alpha_results = await _get_alpha_fundamentals(client, ticker, alpha_key)
                for key in missing_keys:
                    if alpha_results.get(key):
                        results[key] = alpha_results[key]
            except UpstreamDataError as exc:
                errors.append(exc.message)

    if not results:
        raise UpstreamDataError(
            f"No live financial statements were returned for {ticker}. Your current FMP legacy endpoints are blocked; use FMP stable access or Alpha Vantage fundamentals.",
            provider="financial-statements",
            errors=errors,
        )

    processed = _process_statements(results, ticker)
    has_real_financials = any(
        _to_float(processed.get(field)) not in (None, 0.0)
        for field in ["revenue", "net_income", "ebitda", "total_assets", "stockholders_equity"]
    )
    if not has_real_financials:
        raise UpstreamDataError(
            f"Financial statements for {ticker} were fetched, but they did not contain usable valuation inputs.",
            provider="financial-statements",
            errors=errors,
        )

    return _cache_set("financials", ticker, processed)


def _process_statements(data: Dict[str, Any], ticker: str) -> Dict[str, Any]:
    income = data.get("income", [])
    balance = data.get("balance", [])
    cashflow = data.get("cashflow", [])

    latest_income = income[0] if income else {}
    latest_balance = balance[0] if balance else {}
    latest_cashflow = cashflow[0] if cashflow else {}

    current_assets = _to_float(latest_balance.get("totalCurrentAssets")) or 0.0
    current_liabilities = _to_float(latest_balance.get("totalCurrentLiabilities")) or 0.0
    current_ratio = current_assets / current_liabilities if current_liabilities > 0 else None

    total_debt = _to_float(latest_balance.get("totalDebt")) or 0.0
    stockholders_equity = _to_float(latest_balance.get("totalStockholdersEquity")) or 0.0
    debt_to_equity = total_debt / stockholders_equity if stockholders_equity > 0 else None

    revenue = _to_float(latest_income.get("revenue")) or 0.0
    net_income = _to_float(latest_income.get("netIncome")) or 0.0
    ebitda = _to_float(latest_income.get("ebitda")) or 0.0
    gross_profit = _to_float(latest_income.get("grossProfit")) or 0.0
    operating_income = _to_float(latest_income.get("operatingIncome")) or 0.0
    free_cash_flow = _to_float(latest_cashflow.get("freeCashFlow")) or 0.0
    operating_cash_flow = _to_float(latest_cashflow.get("operatingCashFlow")) or 0.0

    revenue_growth = None
    if len(income) >= 2:
        prev_revenue = _to_float(income[1].get("revenue"))
        if prev_revenue and prev_revenue != 0:
            revenue_growth = (revenue - prev_revenue) / abs(prev_revenue)

    profit_margin = net_income / revenue if revenue else None

    return {
        "ticker": ticker,
        "period": latest_income.get("date", ""),
        "revenue": revenue,
        "net_income": net_income,
        "ebitda": ebitda,
        "gross_profit": gross_profit,
        "operating_income": operating_income,
        "total_assets": _to_float(latest_balance.get("totalAssets")) or 0.0,
        "total_liabilities": _to_float(latest_balance.get("totalLiabilities")) or 0.0,
        "current_assets": current_assets,
        "current_liabilities": current_liabilities,
        "cash": _to_float(latest_balance.get("cashAndCashEquivalents")) or 0.0,
        "total_debt": total_debt,
        "stockholders_equity": stockholders_equity,
        "free_cash_flow": free_cash_flow,
        "operating_cash_flow": operating_cash_flow,
        "current_ratio": round(current_ratio, 3) if current_ratio is not None else None,
        "debt_to_equity": round(debt_to_equity, 3) if debt_to_equity is not None else None,
        "profit_margin": round(profit_margin, 4) if profit_margin is not None else None,
        "revenue_growth": round(revenue_growth, 4) if revenue_growth is not None else None,
        "revenue_history": [
            {"period": statement.get("date", ""), "value": _to_float(statement.get("revenue")) or 0.0}
            for statement in income[:5]
        ],
        "income_history": [
            {"period": statement.get("date", ""), "value": _to_float(statement.get("netIncome")) or 0.0}
            for statement in income[:5]
        ],
        "sources": [
            {"name": "SEC EDGAR", "url": f"https://www.sec.gov/cgi-bin/browse-edgar?company={ticker}&action=getcompany"},
            {"name": "Financial Modeling Prep", "url": "https://site.financialmodelingprep.com/developer/docs/stable/income-statement"},
            {"name": "Alpha Vantage", "url": "https://www.alphavantage.co/documentation/"},
        ],
    }


async def get_key_ratios(ticker: str) -> Dict[str, Any]:
    ticker = ticker.upper().strip()
    cached = _cache_get("ratios", ticker)
    if cached is not None:
        return cached

    fmp_key = _env("FMP_API_KEY")
    alpha_key = _env("ALPHA_VANTAGE_KEY")

    async with _client(15.0) as client:
        if fmp_key:
            try:
                data = await _get_json(
                    client,
                    f"{FMP_STABLE_BASE}/ratios",
                    {"symbol": ticker, "limit": 1, "apikey": fmp_key},
                    provider="FMP",
                )
                if isinstance(data, list) and data:
                    ratio = data[0]
                    result = {
                        "current_ratio": _to_float(ratio.get("currentRatio")),
                        "quick_ratio": _to_float(ratio.get("quickRatio")),
                        "debt_to_equity": _to_float(ratio.get("debtEquityRatio")),
                        "price_to_earnings": _to_float(ratio.get("priceEarningsRatio")),
                        "price_to_book": _to_float(ratio.get("priceToBookRatio")),
                        "ev_to_ebitda": _to_float(ratio.get("enterpriseValueMultiple")),
                        "return_on_equity": _to_float(ratio.get("returnOnEquity")),
                        "return_on_assets": _to_float(ratio.get("returnOnAssets")),
                        "profit_margin": _to_float(ratio.get("netProfitMargin")),
                        "revenue_growth": _to_float(ratio.get("revenueGrowth")),
                        "dividend_yield": _to_float(ratio.get("dividendYield")),
                        "sources": [{"name": "Financial Modeling Prep", "url": "https://site.financialmodelingprep.com/developer/docs/stable/metrics-ratios"}],
                    }
                    return _cache_set("ratios", ticker, result)
            except UpstreamDataError as exc:
                logger.warning("Ratio fetch failed for %s: %s", ticker, exc.message)

        if alpha_key:
            try:
                overview = await _get_alpha_overview(client, ticker, alpha_key)
                result = _normalize_alpha_overview_to_ratios(overview)
                return _cache_set("ratios", ticker, result)
            except UpstreamDataError as exc:
                logger.warning("Alpha Vantage ratio fallback failed for %s: %s", ticker, exc.message)

    # Final deterministic fallback from statements, still company-specific not synthetic.
    try:
        financials = await get_financial_statements(ticker)
        return _cache_set("ratios", ticker, _derive_ratios_from_financials(financials))
    except UpstreamDataError:
        return {}


async def get_company_news(ticker: str, company_name: str = "") -> List[Dict[str, Any]]:
    ticker = ticker.upper().strip()
    cache_key = f"{ticker}:{company_name}"
    cached = _cache_get("news", cache_key)
    if cached is not None:
        return cached

    fmp_key = _env("FMP_API_KEY")
    news_key = _env("NEWS_API_KEY")
    articles: List[Dict[str, Any]] = []

    async with _client(15.0) as client:
        if fmp_key:
            try:
                data = await _get_json(
                    client,
                    f"{FMP_STABLE_BASE}/news/stock",
                    {"symbols": ticker, "limit": 10, "apikey": fmp_key},
                    provider="FMP",
                )
                if isinstance(data, list):
                    for item in data[:6]:
                        articles.append(
                            _build_news_item(
                                item.get("title", ""),
                                item.get("url", ""),
                                item.get("publisher", "") or item.get("site", ""),
                                item.get("publishedDate", "") or item.get("date", ""),
                                item.get("text", "") or item.get("title", ""),
                                "FMP",
                            )
                        )
            except UpstreamDataError as exc:
                logger.warning("FMP news fetch failed for %s: %s", ticker, exc.message)

        if news_key:
            try:
                query = company_name or ticker
                data = await _get_json(
                    client,
                    f"{NEWS_BASE}/everything",
                    {
                        "q": query,
                        "apiKey": news_key,
                        "pageSize": 5,
                        "sortBy": "publishedAt",
                        "language": "en",
                    },
                    provider="NewsAPI",
                )
                if isinstance(data, dict):
                    for item in data.get("articles", [])[:5]:
                        articles.append(
                            _build_news_item(
                                item.get("title", ""),
                                item.get("url", ""),
                                item.get("source", {}).get("name", ""),
                                item.get("publishedAt", ""),
                                item.get("description", "") or item.get("content", "") or item.get("title", ""),
                                "NewsAPI",
                            )
                        )
            except UpstreamDataError as exc:
                logger.warning("NewsAPI fetch failed for %s: %s", ticker, exc.message)

    deduped: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for article in articles:
        key = article.get("url") or article.get("title")
        if key and key not in seen:
            deduped.append(article)
            seen.add(key)
    return _cache_set("news", cache_key, deduped[:10])


async def search_companies(query: str) -> List[Dict[str, Any]]:
    query = query.strip()
    fmp_key = _env("FMP_API_KEY")
    finnhub_key = _env("FINNHUB_API_KEY")
    alpha_key = _env("ALPHA_VANTAGE_KEY")
    if not fmp_key and not finnhub_key and not alpha_key:
        raise UpstreamDataError(
            "No search provider is configured. Add FMP_API_KEY, FINNHUB_API_KEY, and/or ALPHA_VANTAGE_KEY to use company search.",
            provider="configuration",
        )

    cache_key = query.lower()
    cached = _cache_get("search", cache_key)
    if cached is not None:
        return cached

    results: List[Dict[str, Any]] = []
    async with _client(10.0) as client:
        if fmp_key:
            try:
                data = await _get_json(
                    client,
                    f"{FMP_STABLE_BASE}/search-symbol",
                    {"query": query, "apikey": fmp_key},
                    provider="FMP",
                )
                if isinstance(data, list):
                    for item in data[:10]:
                        ticker = (item.get("symbol") or "").upper()
                        if ticker:
                            results.append({
                                "ticker": ticker,
                                "name": item.get("name", ""),
                                "exchange": item.get("exchange", "") or item.get("stockExchange", ""),
                                "sector": item.get("exchangeShortName", ""),
                                "currency": item.get("currency", "USD"),
                            })
            except UpstreamDataError as exc:
                logger.warning("FMP search failed for %s: %s", query, exc.message)

        if finnhub_key:
            try:
                data = await _get_json(client, f"{FINNHUB_BASE}/search", {"q": query, "token": finnhub_key}, provider="Finnhub")
                if isinstance(data, dict):
                    for item in data.get("result", [])[:5]:
                        ticker = (item.get("symbol") or "").upper()
                        if ticker and not any(existing["ticker"] == ticker for existing in results):
                            results.append({
                                "ticker": ticker,
                                "name": item.get("description", ""),
                                "exchange": item.get("primaryExchange", ""),
                                "sector": "",
                                "currency": "USD",
                            })
            except UpstreamDataError as exc:
                logger.warning("Finnhub search failed for %s: %s", query, exc.message)

        if alpha_key and not results:
            try:
                data = await _get_alpha_overview(client, query.upper(), alpha_key)
                if isinstance(data, dict) and data.get("Symbol"):
                    results.append({
                        "ticker": data.get("Symbol", "").upper(),
                        "name": data.get("Name", ""),
                        "exchange": data.get("Exchange", ""),
                        "sector": data.get("Sector", ""),
                        "currency": data.get("Currency", "USD"),
                    })
            except UpstreamDataError:
                pass

    if not results:
        raise UpstreamDataError(
            f"No live company search results were returned for '{query}'.",
            provider="company-search",
        )
    return _cache_set("search", cache_key, results[:10])


async def get_esg_data(ticker: str, company_name: str = "") -> Dict[str, Any]:
    ticker = ticker.upper().strip()
    cache_key = f"{ticker}:{company_name}"
    cached = _cache_get("esg", cache_key)
    if cached is not None:
        return cached

    fmp_key = _env("FMP_API_KEY")
    finnhub_key = _env("FINNHUB_API_KEY")
    async with _client(15.0) as client:
        if fmp_key:
            try:
                data = await _get_json(
                    client,
                    "https://financialmodelingprep.com/api/v3/esg-environmental-social-governance-data",
                    {"symbol": ticker, "apikey": fmp_key},
                    provider="FMP",
                )
                if isinstance(data, list) and data:
                    item = data[0]
                    return _cache_set("esg", cache_key, {
                        "ticker": ticker,
                        "available": True,
                        "environmental_score": _to_float(item.get("environmentalScore")),
                        "social_score": _to_float(item.get("socialScore")),
                        "governance_score": _to_float(item.get("governanceScore")),
                        "esg_score": _to_float(item.get("ESGScore")),
                        "source": "FMP ESG",
                        "date": item.get("date", ""),
                    })
            except UpstreamDataError as exc:
                logger.warning("FMP ESG fetch failed for %s: %s", ticker, exc.message)

        if finnhub_key:
            try:
                data = await _get_json(
                    client,
                    f"{FINNHUB_BASE}/stock/esg",
                    {"symbol": ticker, "token": finnhub_key},
                    provider="Finnhub",
                )
                if isinstance(data, dict) and any(data.values()):
                    return _cache_set("esg", cache_key, {
                        "ticker": ticker,
                        "available": True,
                        "environmental_score": _to_float(data.get("environmentScore")) or _to_float(data.get("environmentalScore")),
                        "social_score": _to_float(data.get("socialScore")),
                        "governance_score": _to_float(data.get("governanceScore")),
                        "esg_score": _to_float(data.get("totalEsg")) or _to_float(data.get("esgScore")),
                        "source": "Finnhub ESG",
                        "date": "",
                    })
            except UpstreamDataError as exc:
                logger.warning("Finnhub ESG fetch failed for %s: %s", ticker, exc.message)

    return _cache_set("esg", cache_key, {
        "ticker": ticker,
        "available": False,
        "environmental_score": None,
        "social_score": None,
        "governance_score": None,
        "esg_score": None,
        "source": None,
        "date": "",
        "company_name": company_name,
    })


def _build_news_item(title: str, url: str, publisher: str, date: str, summary: str, source: str) -> Dict[str, Any]:
    sentiment_score = _score_text_sentiment(f"{title} {summary}")
    is_controversy = _contains_keywords(f"{title} {summary}", CONTROVERSY_WORDS)
    if sentiment_score > 0.15:
        sentiment = "positive"
    elif sentiment_score < -0.15:
        sentiment = "negative"
    else:
        sentiment = "neutral"
    return {
        "title": title,
        "url": url,
        "publisher": publisher,
        "date": date,
        "summary": summary[:400],
        "sentiment": sentiment,
        "sentiment_score": round(sentiment_score, 3),
        "is_controversy": is_controversy,
        "source": source,
    }


def _contains_keywords(text: str, keywords: set[str]) -> bool:
    lowered = (text or "").lower()
    return any(word in lowered for word in keywords)


def _score_text_sentiment(text: str) -> float:
    lowered = (text or "").lower()
    positive = sum(1 for word in POSITIVE_NEWS_WORDS if word in lowered)
    negative = sum(1 for word in NEGATIVE_NEWS_WORDS if word in lowered)
    total = positive + negative
    if total == 0:
        return 0.0
    return max(-1.0, min(1.0, (positive - negative) / max(total, 1)))
