"""SELVAM - Auth Router"""
from fastapi import APIRouter
from backend.models.schemas import UserLogin

router = APIRouter()

@router.post("/login")
async def login(credentials: UserLogin):
    # Simple demo auth - in production use proper JWT
    if credentials.username and credentials.password:
        return {
            "token": f"demo-token-{credentials.username}",
            "username": credentials.username,
            "message": "Login successful"
        }
    return {"error": "Invalid credentials"}

@router.get("/profile")
async def get_profile():
    return {
        "username": "analyst",
        "risk_tolerance": "moderate",
        "time_horizon": "3Y",
        "esg_importance": 0.5
    }
