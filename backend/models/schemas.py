from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class RiskTolerance(str, Enum):
    conservative = "conservative"
    moderate = "moderate"
    aggressive = "aggressive"


class TimeHorizon(str, Enum):
    one_year = "1Y"
    three_year = "3Y"
    five_year = "5Y"
    ten_year = "10Y"


class TransactionType(str, Enum):
    merger = "merger"
    acquisition = "acquisition"
    partnership = "partnership"


class UserLogin(BaseModel):
    username: str
    password: str


class ValuationRequest(BaseModel):
    company_id: Optional[str] = None
    ticker: str
    risk_tolerance: RiskTolerance = RiskTolerance.moderate


class MergerAnalysisRequest(BaseModel):
    company_x_ticker: str
    company_y_ticker: str
    transaction_type: TransactionType = TransactionType.merger
    risk_tolerance: RiskTolerance = RiskTolerance.moderate
    time_horizon: TimeHorizon = TimeHorizon.three_year
    esg_weight: float = Field(default=0.5, ge=0.0, le=1.0)
    user_article_urls: List[str] = Field(default_factory=list)


class MergerScore(BaseModel):
    overall_score: float
    probability_of_success: float
    synergy_potential: float
    integration_risk: float


class RiskProfileRequest(BaseModel):
    risk_tolerance: RiskTolerance = RiskTolerance.moderate
    time_horizon: TimeHorizon = TimeHorizon.three_year
    esg_importance: float = Field(default=0.5, ge=0.0, le=1.0)
    max_acceptable_leverage: float = Field(default=3.0, ge=0.0)


class ArticleAnalysisRequest(BaseModel):
    urls: List[str] = Field(min_length=1)
    company_x_ticker: str
    company_y_ticker: Optional[str] = None
    baseline_merger_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)


class ContractDraftRequest(BaseModel):
    company_x_ticker: str
    company_y_ticker: str
    transaction_type: TransactionType = TransactionType.merger
    valuation_range_low: float = Field(ge=0.0)
    valuation_range_high: float = Field(ge=0.0)
    deal_terms: str = ""
    esg_clauses: bool = True
    due_diligence_notes: str = ""
