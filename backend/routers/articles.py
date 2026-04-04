"""SELVAM - Articles Router"""
from fastapi import APIRouter
from backend.models.schemas import ArticleAnalysisRequest
from backend.services.llm_service import analyze_article

router = APIRouter()

@router.post("/analyze-links")
async def analyze_links(req: ArticleAnalysisRequest):
    results = []
    total_delta = 0
    for url in req.urls[:8]:
        art = await analyze_article(url, req.company_x_ticker, req.company_y_ticker)
        results.append({**art, "url": url})
        total_delta += art.get("score_delta", 0)

    new_score = None
    if req.baseline_merger_score is not None:
        new_score = min(95, max(5, req.baseline_merger_score + total_delta))

    main_causes = []
    for r in results:
        if abs(r.get("score_delta", 0)) > 3:
            main_causes.append(f"{r.get('event_type', 'Event')}: {r.get('strategic_implication', '')[:80]}")

    return {
        "baseline_score": req.baseline_merger_score,
        "new_score": new_score,
        "total_delta": round(total_delta, 2),
        "articles": results,
        "main_causes": main_causes[:5],
        "summary": f"Analyzed {len(results)} articles. Net score impact: {total_delta:+.1f} points."
    }
