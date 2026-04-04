"""SELVAM - AI and deterministic narrative service."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)
ANTHROPIC_BASE = "https://api.anthropic.com/v1"

POSITIVE_WORDS = {"growth", "record", "beat", "strong", "upgrade", "partnership", "launch", "approval", "wins", "innovation", "expands"}
NEGATIVE_WORDS = {"lawsuit", "probe", "antitrust", "layoffs", "recall", "delay", "fine", "decline", "weak", "miss", "cuts", "breach"}


def _anthropic_key() -> str:
    return os.getenv("ANTHROPIC_API_KEY", "").strip()


async def analyze_article(url: str, company_x: str, company_y: Optional[str] = None) -> Dict[str, Any]:
    content = await _fetch_article_content(url)
    title = _extract_title(content) or urlparse(url).netloc or url
    heuristic = _heuristic_article_analysis(title, content, company_x, company_y, url)

    if not _anthropic_key():
        return heuristic

    prompt = f"""Analyze this article for an M&A analyst.

Primary company: {company_x}
Secondary company: {company_y or 'N/A'}
URL: {url}
Title: {title}
Content excerpt: {content[:3500]}

Return ONLY valid JSON with these keys:
{{
  "title": "",
  "publisher": "",
  "publication_date": "",
  "event_type": "",
  "strategic_implication": "",
  "sentiment": 0.0,
  "risk_factor": "",
  "esg_relevance": 0.0,
  "impact_on_x": "",
  "impact_on_y": "",
  "score_delta": 0.0,
  "key_claims": [""],
  "reliability_score": 0.0
}}
Base the analysis on the actual article content, not generic market commentary."""

    response = await _call_claude(prompt, max_tokens=900)
    if not response:
        return heuristic

    try:
        parsed = json.loads(response)
        if isinstance(parsed, dict):
            parsed.setdefault("title", title)
            parsed.setdefault("publisher", heuristic.get("publisher"))
            parsed.setdefault("publication_date", heuristic.get("publication_date"))
            parsed.setdefault("url", url)
            return parsed
    except json.JSONDecodeError:
        logger.warning("Claude article analysis did not return valid JSON for %s", url)
    return heuristic


async def generate_merger_insights(
    company_x: str,
    company_y: str,
    merger_scores: Dict[str, Any],
    financials_x: Dict[str, Any],
    financials_y: Dict[str, Any],
) -> str:
    local_summary = _local_merger_insight(company_x, company_y, merger_scores, financials_x, financials_y)
    if not _anthropic_key():
        return local_summary

    prompt = f"""Write a concise, data-driven 3 paragraph merger memo for {company_x} and {company_y}.

Overall score: {merger_scores.get('overall_score')}
Probability of success: {merger_scores.get('probability_of_success')}
Synergy potential: {merger_scores.get('synergy_potential')}
Integration risk: {merger_scores.get('integration_risk')}
Recommendation: {merger_scores.get('recommendation')}
Revenue X: {financials_x.get('revenue')}
Revenue Y: {financials_y.get('revenue')}
Debt/Equity X: {financials_x.get('debt_to_equity')}
Debt/Equity Y: {financials_y.get('debt_to_equity')}
Current Ratio X: {financials_x.get('current_ratio')}
Current Ratio Y: {financials_y.get('current_ratio')}

Make it specific to these metrics and avoid placeholders."""

    response = await _call_claude(prompt, max_tokens=600)
    return response or local_summary


async def draft_contract(
    company_x: str,
    company_y: str,
    transaction_type: str,
    val_low: float,
    val_high: float,
    deal_terms: str = "",
    esg_clauses: bool = True,
    due_diligence_notes: str = "",
) -> Dict[str, str]:
    local_draft = _local_contract(company_x, company_y, transaction_type, val_low, val_high, deal_terms, esg_clauses, due_diligence_notes)
    if not _anthropic_key():
        return local_draft

    prompt = f"""Draft professional M&A documents for a {transaction_type} between {company_x} and {company_y}.
Valuation range: ${val_low:,.0f} to ${val_high:,.0f}
Deal terms: {deal_terms or 'Standard negotiated terms'}
Include ESG clauses: {esg_clauses}
Due diligence notes: {due_diligence_notes or 'Standard diligence'}
Return ONLY valid JSON with keys loi_draft, acquisition_summary, due_diligence_checklist, merger_term_sheet."""
    response = await _call_claude(prompt, max_tokens=1400)
    if not response:
        return local_draft
    try:
        parsed = json.loads(response)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        logger.warning("Claude contract draft was not valid JSON")
    return local_draft


async def generate_investment_rationale(
    ticker: str,
    name: str,
    scores: Dict[str, Any],
    financials: Dict[str, Any],
    esg: Dict[str, Any],
) -> str:
    local_summary = _local_investment_rationale(ticker, name, scores, financials, esg)
    if not _anthropic_key():
        return local_summary

    prompt = f"""Write a concise, company-specific investment rationale for {name} ({ticker}).
Financial health overall: {scores.get('overall')}
Liquidity: {financials.get('current_ratio')}
Revenue: {financials.get('revenue')}
Revenue growth: {financials.get('revenue_growth')}
Profit margin: {financials.get('profit_margin')}
Debt/equity: {financials.get('debt_to_equity')}
ESG overall: {esg.get('overall_esg')}
Ground the writeup in these metrics and avoid generic phrasing."""

    response = await _call_claude(prompt, max_tokens=320)
    return response or local_summary


async def _call_claude(prompt: str, max_tokens: int = 1500) -> str:
    key = _anthropic_key()
    if not key:
        return ""

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{ANTHROPIC_BASE}/messages",
                headers={
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("content"):
                    return data["content"][0].get("text", "")
            logger.warning("Claude call failed with status %s: %s", response.status_code, response.text[:200])
        except Exception as exc:
            logger.error("Claude API error: %s", exc)
    return ""


async def _fetch_article_content(url: str) -> str:
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
        try:
            response = await client.get(url, headers={"User-Agent": "SELVAM/1.1 Research Bot"})
            if response.status_code == 200:
                text = re.sub(r"<script.*?</script>", " ", response.text, flags=re.S | re.I)
                text = re.sub(r"<style.*?</style>", " ", text, flags=re.S | re.I)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
                return text[:5000]
        except Exception as exc:
            logger.warning("Article fetch failed for %s: %s", url, exc)
    return f"Unable to fetch article body for {url}."


def _extract_title(content: str) -> str:
    if not content:
        return ""
    return content[:120].strip()


def _classify_event(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ["acquire", "acquisition", "merge", "m&a"]):
        return "transaction"
    if any(word in lowered for word in ["earnings", "quarter", "guidance"]):
        return "earnings"
    if any(word in lowered for word in ["lawsuit", "probe", "antitrust", "regulator", "sec", "doj"]):
        return "regulatory"
    if any(word in lowered for word in ["launch", "product", "ai", "chip", "platform"]):
        return "product"
    if any(word in lowered for word in ["layoff", "restructuring", "cost", "job cuts"]):
        return "restructuring"
    return "market_shift"


def _heuristic_article_analysis(url_title: str, content: str, company_x: str, company_y: Optional[str], url: str) -> Dict[str, Any]:
    publisher = urlparse(url).netloc.replace("www.", "")
    lowered = f"{url_title} {content}".lower()
    positive = sum(1 for word in POSITIVE_WORDS if word in lowered)
    negative = sum(1 for word in NEGATIVE_WORDS if word in lowered)
    sentiment_raw = 0.0
    total = positive + negative
    if total:
        sentiment_raw = max(-1.0, min(1.0, (positive - negative) / total))

    event_type = _classify_event(lowered)
    score_delta = sentiment_raw * 6
    if event_type == "transaction":
        score_delta += 1.5
    elif event_type == "regulatory":
        score_delta -= 2.0 if sentiment_raw <= 0 else 0.5
    elif event_type == "earnings":
        score_delta += 1.0 if sentiment_raw > 0 else -1.0

    impact_x = _article_impact_text(company_x, event_type, sentiment_raw)
    impact_y = _article_impact_text(company_y, event_type, -sentiment_raw * 0.4) if company_y else "N/A"
    reliability = 0.55 + min(0.35, len(content) / 12000)

    key_claims = []
    sentences = re.split(r"(?<=[.!?])\s+", content)
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) > 30 and len(key_claims) < 3:
            key_claims.append(sentence[:180])

    risk_factor = "Regulatory or execution uncertainty" if event_type in {"transaction", "regulatory"} else "Operating performance and market expectations"
    strategic_implication = _article_implication(company_x, company_y, event_type, sentiment_raw)

    return {
        "title": url_title,
        "publisher": publisher,
        "publication_date": "",
        "event_type": event_type,
        "strategic_implication": strategic_implication,
        "sentiment": round(sentiment_raw, 2),
        "risk_factor": risk_factor,
        "esg_relevance": round(0.7 if event_type == "regulatory" else 0.35 if event_type == "restructuring" else 0.2, 2),
        "impact_on_x": impact_x,
        "impact_on_y": impact_y,
        "score_delta": round(max(-8.0, min(8.0, score_delta)), 1),
        "key_claims": key_claims or [f"The article references strategic developments involving {company_x}."],
        "reliability_score": round(reliability, 2),
    }


def _article_impact_text(company: Optional[str], event_type: str, sentiment: float) -> str:
    if not company:
        return "N/A"
    direction = "supports" if sentiment > 0.1 else "pressures" if sentiment < -0.1 else "has a mixed effect on"
    if event_type == "transaction":
        return f"The article {direction} {company}'s deal-making position and strategic optionality."
    if event_type == "earnings":
        return f"The article {direction} {company}'s near-term valuation through earnings expectations."
    if event_type == "regulatory":
        return f"The article {direction} {company}'s regulatory and execution risk profile."
    if event_type == "restructuring":
        return f"The article {direction} {company}'s cost structure and integration readiness."
    return f"The article {direction} {company}'s market narrative and strategic momentum."


def _article_implication(company_x: str, company_y: Optional[str], event_type: str, sentiment: float) -> str:
    mood = "constructive" if sentiment > 0.1 else "adverse" if sentiment < -0.1 else "mixed"
    counterpart = f" and {company_y}" if company_y else ""
    if event_type == "transaction":
        return f"This article points to {mood} transaction conditions for {company_x}{counterpart}, with direct implications for synergy realization and timing."
    if event_type == "regulatory":
        return f"This article highlights {mood} regulatory conditions that should be incorporated into the downside case for {company_x}{counterpart}."
    if event_type == "earnings":
        return f"This article changes the near-term operating outlook for {company_x}{counterpart}, which can move valuation and negotiation leverage."
    return f"This article changes the strategic narrative around {company_x}{counterpart} and should be factored into market momentum assumptions."


def _score_label(score: float) -> str:
    if score >= 75:
        return "strong"
    if score >= 60:
        return "moderate"
    if score >= 45:
        return "mixed"
    return "weak"


def _local_merger_insight(company_x: str, company_y: str, scores: Dict[str, Any], fin_x: Dict[str, Any], fin_y: Dict[str, Any]) -> str:
    probability = scores.get("probability_of_success", 0)
    synergy = scores.get("synergy_potential", 0)
    integration_risk = scores.get("integration_risk", 0)
    rev_x = fin_x.get("revenue") or 0
    rev_y = fin_y.get("revenue") or 0
    current_x = fin_x.get("current_ratio")
    current_y = fin_y.get("current_ratio")
    debt_x = fin_x.get("debt_to_equity")
    debt_y = fin_y.get("debt_to_equity")

    paragraph_1 = (
        f"{company_x} and {company_y} produce a merger feasibility score of {scores.get('overall_score', 0):.1f}/100, "
        f"with an estimated success probability of {probability:.1f}%. The strategic case is strongest when scale, product adjacency, "
        f"or customer overlap can translate into the modeled synergy potential of {synergy:.1f}/100."
    )
    paragraph_2 = (
        f"From a balance-sheet standpoint, {company_x} shows a current ratio of {current_x if current_x is not None else 'N/A'} and debt/equity of {debt_x if debt_x is not None else 'N/A'}, "
        f"while {company_y} shows a current ratio of {current_y if current_y is not None else 'N/A'} and debt/equity of {debt_y if debt_y is not None else 'N/A'}. "
        f"Revenue scale is {rev_x:,.0f} versus {rev_y:,.0f}, which affects integration complexity and negotiating leverage."
    )
    paragraph_3 = (
        f"Recommendation: {scores.get('recommendation', 'Proceed with caution')}. Integration risk is currently scored at {integration_risk:.1f}/100, "
        f"so the next diligence steps should focus on synergy verification, leverage capacity, and any concentration or execution risks surfaced by current operations."
    )
    return "\n\n".join([paragraph_1, paragraph_2, paragraph_3])


def _local_investment_rationale(ticker: str, name: str, scores: Dict[str, Any], financials: Dict[str, Any], esg: Dict[str, Any]) -> str:
    health = scores.get("overall") or 0
    revenue_growth = financials.get("revenue_growth")
    profit_margin = financials.get("profit_margin")
    current_ratio = financials.get("current_ratio")
    debt_to_equity = financials.get("debt_to_equity")
    esg_score = esg.get("overall_esg")

    strengths = []
    risks = []
    if revenue_growth is not None and revenue_growth > 0.05:
        strengths.append(f"revenue growth of {revenue_growth:.1%}")
    if profit_margin is not None and profit_margin > 0.10:
        strengths.append(f"profit margin of {profit_margin:.1%}")
    if current_ratio is not None and current_ratio >= 1.2:
        strengths.append(f"liquidity supported by a current ratio of {current_ratio:.2f}")
    if debt_to_equity is not None and debt_to_equity > 2.0:
        risks.append(f"leverage is elevated at {debt_to_equity:.2f}x debt-to-equity")
    if current_ratio is not None and current_ratio < 1.0:
        risks.append(f"short-term liquidity is tight with a current ratio of {current_ratio:.2f}")
    if profit_margin is not None and profit_margin < 0:
        risks.append("profitability is negative")

    if not strengths:
        strengths.append("the company still retains measurable operating scale")
    if not risks:
        risks.append("execution and market re-rating remain the main watch items")

    esg_clause = f" ESG momentum is {esg_score:.1f}/100." if esg_score is not None else " ESG data was not available from the configured providers."
    return (
        f"{name} ({ticker}) currently screens as a {_score_label(health)} candidate with a financial health score of {health:.1f}/100. "
        f"The more constructive parts of the profile are {', '.join(strengths)}.{esg_clause}\n\n"
        f"The main risks are that {', '.join(risks)}. That means the investment case should be tied to whether current operating trends continue, "
        f"rather than assuming a generic upside scenario."
    )


def _local_contract(company_x: str, company_y: str, transaction_type: str, val_low: float, val_high: float, deal_terms: str, esg_clauses: bool, due_diligence_notes: str) -> Dict[str, str]:
    esg_line = "Include ESG disclosure, compliance, and post-close reporting obligations." if esg_clauses else "No dedicated ESG clause package requested in this draft."
    diligence_line = due_diligence_notes or "Validate audited financials, customer concentration, contracts, IP, and regulatory exposure."
    return {
        "loi_draft": (
            f"LETTER OF INTENT\n\n"
            f"This non-binding Letter of Intent records the preliminary understanding between {company_x} and {company_y} regarding a proposed {transaction_type}. "
            f"The parties are exploring a transaction value in the range of ${val_low:,.0f} to ${val_high:,.0f}, subject to confirmatory diligence, negotiation of definitive documents, and board approval.\n\n"
            f"The parties intend to negotiate exclusively for 60 days, exchange information in good faith, and refine definitive economic, regulatory, governance, and integration terms. "
            f"{esg_line}\n\n"
            f"This document is non-binding other than confidentiality, exclusivity, governing law, and expense allocation provisions, and remains subject to legal review."
        ),
        "acquisition_summary": (
            f"Executive Summary\n\n"
            f"The proposed {transaction_type} between {company_x} and {company_y} is being evaluated within a valuation band of ${val_low:,.0f} to ${val_high:,.0f}. "
            f"The transaction thesis should focus on strategic fit, synergy capture, integration feasibility, and downside protection through diligence and closing conditions.\n\n"
            f"Key negotiation topics include price adjustment mechanics, representations and warranties, interim operating covenants, regulatory approvals, employee retention, and integration planning."
        ),
        "due_diligence_checklist": [
            "Audited financial statements and quality of earnings analysis",
            "Debt agreements, liens, covenants, and contingent liabilities",
            "Material customer and supplier agreements",
            "Revenue concentration and churn analysis",
            "Intellectual property ownership and encumbrances",
            "Cybersecurity controls and incident history",
            "Privacy, data governance, and data transfer compliance",
            "Employment agreements, retention plans, and labor issues",
            "Litigation, claims, and government investigations",
            diligence_line,
            "Tax returns, nexus exposure, and deferred tax items",
            "Insurance coverage and claims history",
            "Real estate leases and occupancy obligations",
            "Environmental compliance and permit status",
            "Integration roadmap, systems, and change-management assumptions",
        ],
        "merger_term_sheet": (
            f"Term Sheet Highlights\n\n"
            f"• Structure: {transaction_type.title()}\n"
            f"• Indicative valuation range: ${val_low:,.0f} to ${val_high:,.0f}\n"
            f"• Consideration mix: Cash, stock, or mixed consideration to be finalized\n"
            f"• Exclusivity: 60 days\n"
            f"• Diligence window: 30 to 45 days\n"
            f"• Closing conditions: Board approval, definitive agreements, required regulatory clearances\n"
            f"• Interim covenants: Operate in ordinary course, no material asset sales without consent\n"
            f"• ESG package: {esg_line}\n"
            f"• Special deal terms: {deal_terms or 'None specified yet'}\n"
            f"• Governing law and dispute resolution: To be specified in the definitive agreement"
        ),
    }
