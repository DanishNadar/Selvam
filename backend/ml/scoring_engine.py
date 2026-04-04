"""
SELVAM - ML Scoring Engine
Merger probability, valuation, and risk scoring models
"""
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class FinancialHealthScorer:
    """Scores overall financial health of a company"""

    def score(self, financials: Dict[str, Any]) -> Dict[str, float]:
        scores = {}

        # Liquidity Score (current ratio is key)
        cr = financials.get("current_ratio", 1.0) or 1.0
        if cr >= 2.0:
            liquidity = 90
        elif cr >= 1.5:
            liquidity = 75
        elif cr >= 1.0:
            liquidity = 55
        elif cr >= 0.7:
            liquidity = 35
        else:
            liquidity = 15
        scores["liquidity"] = liquidity

        # Leverage Score
        dte = financials.get("debt_to_equity", 1.0) or 1.0
        if dte < 0.5:
            leverage = 90
        elif dte < 1.0:
            leverage = 75
        elif dte < 2.0:
            leverage = 55
        elif dte < 4.0:
            leverage = 35
        else:
            leverage = 15
        scores["leverage"] = leverage

        # Profitability Score
        margin = financials.get("profit_margin", 0) or 0
        if margin > 0.20:
            profitability = 90
        elif margin > 0.10:
            profitability = 75
        elif margin > 0.05:
            profitability = 60
        elif margin > 0:
            profitability = 45
        else:
            profitability = 20
        scores["profitability"] = profitability

        # Growth Score
        growth = financials.get("revenue_growth", 0) or 0
        if growth > 0.30:
            growth_score = 90
        elif growth > 0.15:
            growth_score = 75
        elif growth > 0.05:
            growth_score = 60
        elif growth > -0.05:
            growth_score = 45
        else:
            growth_score = 20
        scores["growth"] = growth_score

        # Free Cash Flow
        fcf = financials.get("free_cash_flow", 0) or 0
        revenue = financials.get("revenue", 1) or 1
        fcf_yield = fcf / max(revenue, 1)
        if fcf_yield > 0.15:
            fcf_score = 90
        elif fcf_yield > 0.08:
            fcf_score = 75
        elif fcf_yield > 0:
            fcf_score = 55
        else:
            fcf_score = 30
        scores["fcf"] = fcf_score

        # Overall financial health
        scores["overall"] = (
            scores["liquidity"] * 0.25 +
            scores["leverage"] * 0.20 +
            scores["profitability"] * 0.25 +
            scores["growth"] * 0.20 +
            scores["fcf"] * 0.10
        )

        return scores


class ValuationEngine:
    """Company valuation using multiple methods"""

    def estimate_value(
        self,
        financials: Dict[str, Any],
        ratios: Dict[str, Any],
        sector_multiples: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:

        revenue = financials.get("revenue", 0) or 0
        ebitda = financials.get("ebitda", 0) or 0
        net_income = financials.get("net_income", 0) or 0
        fcf = financials.get("free_cash_flow", 0) or 0
        book_value = financials.get("stockholders_equity", 0) or 0

        # Default sector multiples (P/E, EV/EBITDA, P/S)
        if not sector_multiples:
            sector_multiples = {"pe": 20, "ev_ebitda": 12, "ps": 3}

        estimates = []

        # Method 1: EV/EBITDA
        if ebitda > 0:
            ev_estimate = ebitda * sector_multiples.get("ev_ebitda", 12)
            debt = financials.get("total_debt", 0) or 0
            cash = financials.get("cash", 0) or 0
            equity_val = ev_estimate - debt + cash
            if equity_val > 0:
                estimates.append(equity_val)

        # Method 2: P/E
        if net_income > 0:
            pe_val = net_income * sector_multiples.get("pe", 20)
            if pe_val > 0:
                estimates.append(pe_val)

        # Method 3: P/S
        if revenue > 0:
            ps_val = revenue * sector_multiples.get("ps", 3)
            if ps_val > 0:
                estimates.append(ps_val)

        # Method 4: DCF (simplified)
        if fcf > 0:
            growth_rate = min(financials.get("revenue_growth", 0.05) or 0.05, 0.25)
            discount_rate = 0.10
            terminal_growth = 0.03
            dcf = 0
            for year in range(1, 6):
                dcf += fcf * (1 + growth_rate) ** year / (1 + discount_rate) ** year
            terminal = fcf * (1 + terminal_growth) / (discount_rate - terminal_growth)
            terminal_pv = terminal / (1 + discount_rate) ** 5
            dcf_val = dcf + terminal_pv
            if dcf_val > 0:
                estimates.append(dcf_val)

        # Method 5: Book Value
        if book_value > 0:
            pb_multiple = ratios.get("price_to_book", 2.0) or 2.0
            estimates.append(book_value * pb_multiple)

        market_cap = financials.get("market_cap", 0) or 0
        if market_cap > 0:
            estimates.append(float(market_cap))

        if not estimates:
            raise ValueError("No usable valuation inputs were available for this company.")

        base = float(np.median(estimates))
        std = float(np.std(estimates)) if len(estimates) > 1 else base * 0.2

        low = max(base - std, base * 0.6)
        high = base + std

        confidence = min(90, 50 + len(estimates) * 8)

        return {
            "low": round(low, 0),
            "base": round(base, 0),
            "high": round(high, 0),
            "confidence": confidence,
            "methods_used": len(estimates),
            "assumptions": {
                "pe_multiple": sector_multiples.get("pe", 20),
                "ev_ebitda_multiple": sector_multiples.get("ev_ebitda", 12),
                "ps_multiple": sector_multiples.get("ps", 3),
                "discount_rate": "10%",
                "terminal_growth": "3%"
            }
        }


class MergerFeasibilityEngine:
    """Calculates merger/acquisition feasibility probability"""

    def __init__(self):
        self.health_scorer = FinancialHealthScorer()

    def analyze(
        self,
        financials_x: Dict[str, Any],
        financials_y: Dict[str, Any],
        profile_x: Dict[str, Any],
        profile_y: Dict[str, Any],
        esg_x: Dict[str, Any],
        esg_y: Dict[str, Any],
        news_sentiment: float = 0.0,
        article_impact: float = 0.0,
        risk_tolerance: str = "moderate"
    ) -> Dict[str, Any]:

        health_x = self.health_scorer.score(financials_x)
        health_y = self.health_scorer.score(financials_y)

        # Financial Health Score (average of both)
        fin_health = (health_x["overall"] + health_y["overall"]) / 2

        # Balance Sheet Compatibility
        cr_x = financials_x.get("current_ratio", 1) or 1
        cr_y = financials_y.get("current_ratio", 1) or 1
        balance_compat = 70 if (cr_x > 1 and cr_y > 1) else 40 if (cr_x > 1 or cr_y > 1) else 25

        # Revenue Complementarity
        rev_x = financials_x.get("revenue", 0) or 0
        rev_y = financials_y.get("revenue", 0) or 0
        if rev_x > 0 and rev_y > 0:
            rev_ratio = min(rev_x, rev_y) / max(rev_x, rev_y)
            rev_compat = 60 + rev_ratio * 30
        else:
            rev_compat = 50

        # Sector/Industry Overlap
        sector_x = profile_x.get("sector", "")
        sector_y = profile_y.get("sector", "")
        industry_x = profile_x.get("industry", "")
        industry_y = profile_y.get("industry", "")

        if sector_x == sector_y and industry_x == industry_y:
            sector_score = 85  # Same industry (horizontal)
        elif sector_x == sector_y:
            sector_score = 70  # Same sector
        else:
            sector_score = 50  # Cross-sector

        # ESG Compatibility
        esg_score_x = esg_x.get("esg_score", 50) or 50
        esg_score_y = esg_y.get("esg_score", 50) or 50
        esg_diff = abs(esg_score_x - esg_score_y)
        esg_compat = max(30, 80 - esg_diff * 0.5)

        # Debt/Leverage Compatibility
        dte_x = financials_x.get("debt_to_equity", 1) or 1
        dte_y = financials_y.get("debt_to_equity", 1) or 1
        combined_leverage = (dte_x + dte_y) / 2
        if combined_leverage < 1:
            leverage_score = 85
        elif combined_leverage < 2:
            leverage_score = 65
        elif combined_leverage < 4:
            leverage_score = 45
        else:
            leverage_score = 25

        # Growth Synergy (combined growth potential)
        growth_x = financials_x.get("revenue_growth", 0) or 0
        growth_y = financials_y.get("revenue_growth", 0) or 0
        avg_growth = (growth_x + growth_y) / 2
        synergy_score = min(90, 50 + avg_growth * 200)

        # Strategic Momentum (news + article signals)
        momentum_score = 50 + news_sentiment * 30

        # Overall feasibility (weighted composite)
        feasibility = (
            fin_health * 0.25 +
            balance_compat * 0.15 +
            rev_compat * 0.15 +
            sector_score * 0.15 +
            esg_compat * 0.10 +
            leverage_score * 0.10 +
            synergy_score * 0.05 +
            momentum_score * 0.05
        )

        # Probability of successful merger
        probability = min(95, max(5, feasibility * 0.85 + article_impact * 10))

        # Risk tolerance adjustment
        if risk_tolerance == "conservative":
            adjustment = -8
        elif risk_tolerance == "aggressive":
            adjustment = +6
        else:
            adjustment = 0

        adjusted_probability = min(95, max(5, probability + adjustment))

        # Integration risk
        integration_risk = max(10, 80 - feasibility * 0.5)

        # Recommendation
        if adjusted_probability >= 75:
            recommendation = "Strong Buy / Proceed"
            rec_detail = f"High merger feasibility. Strong financial compatibility with {round(adjusted_probability)}% estimated probability of value creation."
            risk_level = "Low-Moderate"
        elif adjusted_probability >= 60:
            recommendation = "Moderately Favorable"
            rec_detail = f"Good merger potential with manageable integration risks. {round(adjusted_probability)}% probability of positive outcome."
            risk_level = "Moderate"
        elif adjusted_probability >= 45:
            recommendation = "Proceed with Caution"
            rec_detail = f"Mixed signals. Significant due diligence required. {round(adjusted_probability)}% estimated feasibility."
            risk_level = "Moderate-High"
        else:
            recommendation = "High Risk / Reconsider"
            rec_detail = f"Significant barriers to value creation identified. {round(adjusted_probability)}% success probability is below threshold."
            risk_level = "High"

        # Key drivers
        all_factors = [
            ("Financial health", fin_health),
            ("Balance sheet compatibility", balance_compat),
            ("Revenue complementarity", rev_compat),
            ("Industry alignment", sector_score),
            ("ESG compatibility", esg_compat),
            ("Leverage profile", leverage_score),
            ("Growth synergy", synergy_score),
        ]
        all_factors.sort(key=lambda x: x[1], reverse=True)
        positive_drivers = [f[0] for f in all_factors if f[1] >= 60][:4]
        negative_drivers = [f[0] for f in all_factors if f[1] < 50][:4]

        return {
            "overall_score": round(feasibility, 1),
            "probability_of_success": round(adjusted_probability, 1),
            "synergy_potential": round(synergy_score, 1),
            "integration_risk": round(integration_risk, 1),
            "financial_health_score": round(fin_health, 1),
            "balance_compat": round(balance_compat, 1),
            "revenue_compat": round(rev_compat, 1),
            "sector_score": round(sector_score, 1),
            "esg_compat": round(esg_compat, 1),
            "leverage_score": round(leverage_score, 1),
            "recommendation": recommendation,
            "recommendation_detail": rec_detail,
            "risk_level": risk_level,
            "key_drivers_positive": positive_drivers,
            "key_drivers_negative": negative_drivers,
        }


class RiskToleranceEngine:
    """Applies risk tolerance adjustments to scores"""

    def adjust(
        self,
        raw_score: float,
        risk_tolerance: str,
        company_factors: Dict[str, Any]
    ) -> Dict[str, Any]:

        penalty = 0
        risk_factors = []

        dte = company_factors.get("debt_to_equity", 1) or 1
        cr = company_factors.get("current_ratio", 1) or 1
        controversy = company_factors.get("controversy_score", 0.3) or 0.3

        # Leverage penalty
        if dte > 3:
            lev_penalty = 10 if risk_tolerance == "conservative" else 5 if risk_tolerance == "moderate" else 2
            penalty += lev_penalty
            risk_factors.append({"factor": "High leverage", "penalty": lev_penalty, "severity": "high"})

        # Liquidity penalty
        if cr < 1:
            liq_penalty = 12 if risk_tolerance == "conservative" else 6 if risk_tolerance == "moderate" else 2
            penalty += liq_penalty
            risk_factors.append({"factor": "Low current ratio", "penalty": liq_penalty, "severity": "high"})

        # Controversy penalty
        if controversy > 0.6:
            cont_penalty = 8 if risk_tolerance == "conservative" else 4 if risk_tolerance == "moderate" else 1
            penalty += cont_penalty
            risk_factors.append({"factor": "ESG controversies", "penalty": cont_penalty, "severity": "medium"})

        adjusted = max(5, min(95, raw_score - penalty))

        if adjusted >= 70:
            recommendation = "Favorable for your risk profile"
        elif adjusted >= 50:
            recommendation = "Acceptable with monitoring"
        else:
            recommendation = "Does not meet your risk criteria"

        return {
            "raw_score": raw_score,
            "adjusted_score": adjusted,
            "penalty": penalty,
            "risk_factors": risk_factors,
            "recommendation": recommendation
        }


class ESGGNNScorer:
    """
    Graph Neural Network-inspired ESG scoring
    Uses NetworkX for graph construction and propagation
    """

    def compute_network_score(
        self,
        company_esg: Dict[str, Any],
        related_companies: List[Dict[str, Any]] = None,
        news_articles: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:

        base_esg = company_esg.get("esg_score")
        env_score = company_esg.get("environmental_score")
        soc_score = company_esg.get("social_score")
        gov_score = company_esg.get("governance_score")
        esg_available = all(value is not None for value in [base_esg, env_score, soc_score, gov_score])
        if not esg_available:
            base_esg = env_score = soc_score = gov_score = None

        # Network effect from related companies
        network_bonus = 0
        if related_companies:
            neighbor_esg = [r.get("esg_score", base_esg) for r in related_companies[:5]]
            avg_neighbor = np.mean(neighbor_esg) if neighbor_esg else base_esg
            # GNN-inspired message passing: blend own score with neighbors
            network_bonus = (avg_neighbor - base_esg) * 0.2

        # News sentiment adjustment
        controversy_count = 0
        sentiment_sum = 0
        if news_articles:
            for art in news_articles:
                sent = art.get("sentiment_score", 0)
                sentiment_sum += sent
                if art.get("is_controversy", False):
                    controversy_count += 1

        news_esg_adj = sentiment_sum * 3 if news_articles else 0
        controversy_penalty = controversy_count * 5

        adjusted_overall = None
        if esg_available:
            adjusted_overall = max(0, min(100,
                base_esg + network_bonus + news_esg_adj - controversy_penalty
            ))

        gov_risk = None
        if gov_score is not None:
            gov_risk = max(0, min(100, 100 - gov_score))

        return {
            "available": esg_available,
            "overall_esg": round(adjusted_overall, 1) if adjusted_overall is not None else None,
            "environmental": round(env_score, 1) if env_score is not None else None,
            "social": round(soc_score, 1) if soc_score is not None else None,
            "governance": round(gov_score, 1) if gov_score is not None else None,
            "controversy_score": round(controversy_count / max(1, len(news_articles or [1])), 2),
            "governance_risk": round(gov_risk, 1) if gov_risk is not None else None,
            "network_strength": round(50 + network_bonus, 1),
            "network_adjustment": round(network_bonus, 2),
            "sustainability_trend": "improving" if news_esg_adj > 0 else "stable" if news_esg_adj == 0 else "declining",
            "key_issues": self._identify_issues(env_score, soc_score, gov_score, controversy_count, esg_available)
        }

    def _identify_issues(self, env, soc, gov, controversies, esg_available=True) -> List[str]:
        issues = []
        if not esg_available:
            issues.append("Live ESG scores were unavailable from the configured providers")
        if env is not None and env < 40:
            issues.append("Environmental performance concerns")
        if soc is not None and soc < 40:
            issues.append("Social responsibility gaps")
        if gov is not None and gov < 40:
            issues.append("Governance structure weakness")
        if controversies > 2:
            issues.append(f"{controversies} active ESG controversies detected")
        if not issues:
            issues.append("No significant ESG issues identified")
        return issues


class CompositeScorer:
    """Final composite SELVAM decision score"""

    def compute(
        self,
        financial_health: float,
        valuation_attractiveness: float,
        merger_feasibility: float,
        esg_score: float,
        strategic_momentum: float,
        article_impact: float,
        risk_tolerance: str = "moderate",
        risk_penalty: float = 0
    ) -> Dict[str, Any]:

        overall = (
            financial_health * 0.30 +
            valuation_attractiveness * 0.20 +
            merger_feasibility * 0.20 +
            esg_score * 0.15 +
            strategic_momentum * 0.10 +
            article_impact * 0.05
        )

        final = max(5, min(95, overall - risk_penalty))

        sub_scores = {
            "financial_health": round(financial_health, 1),
            "valuation_attractiveness": round(valuation_attractiveness, 1),
            "merger_feasibility": round(merger_feasibility, 1),
            "esg_score": round(esg_score, 1),
            "strategic_momentum": round(strategic_momentum, 1),
            "article_impact": round(article_impact, 1),
            "overall": round(overall, 1),
            "final_adjusted": round(final, 1),
        }

        return sub_scores