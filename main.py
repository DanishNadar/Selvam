"""
SELVAM - Strategic Enterprise Leverage & Valuation Analysis Machine
FastAPI Backend Application
"""

import logging
import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routers import articles, auth, companies, contracts, esg, merger, reports, risk, valuation
from backend.services.errors import UpstreamDataError

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SELVAM API",
    description="Strategic Enterprise Leverage & Valuation Analysis Machine",
    version="1.1.1",
)

cors_origins = (os.getenv("CORS_ORIGINS", "") or os.getenv("CORS_ALLOW_ORIGINS", "")).strip()

# Default to permissive development CORS so the frontend can call the API from
# localhost, LAN IPs, public IPs, or whatever Vite port is currently in use.
# Because this app does not use cookie-based auth, allow_credentials stays False.
allow_origins = ["*"]
allow_origin_regex = None

# If the user explicitly sets CORS origins, honor those instead of the wildcard.
if cors_origins:
    allow_origins = [item.strip() for item in cors_origins.split(",") if item.strip()]
    allow_origin_regex = r"https?://([A-Za-z0-9.-]+|localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(UpstreamDataError)
async def upstream_data_error_handler(_: Request, exc: UpstreamDataError):
    return JSONResponse(
        status_code=502,
        content={
            "detail": exc.message,
            "provider": exc.provider,
            "errors": exc.errors,
        },
    )


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(companies.router, prefix="/companies", tags=["companies"])
app.include_router(valuation.router, prefix="/valuation", tags=["valuation"])
app.include_router(merger.router, prefix="/merger", tags=["merger"])
app.include_router(risk.router, prefix="/risk", tags=["risk"])
app.include_router(articles.router, prefix="/articles", tags=["articles"])
app.include_router(esg.router, prefix="/esg", tags=["esg"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(contracts.router, prefix="/contracts", tags=["contracts"])


@app.get("/")
async def root():
    return {"message": "SELVAM API v1.1.1", "status": "operational"}


@app.get("/health")
async def health():
    configured = {
        key: bool(os.getenv(key, "").strip())
        for key in ["FMP_API_KEY", "FINNHUB_API_KEY", "NEWS_API_KEY", "ANTHROPIC_API_KEY", "ALPHA_VANTAGE_KEY"]
    }
    return {
        "status": "healthy",
        "service": "SELVAM Backend",
        "configured_keys": configured,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
