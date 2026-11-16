"""
Rnld Forex AI — FastAPI Backend
Fetches real forex data and serves it to the frontend.
"""

import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# -------------------------------------------------
# Config
# -------------------------------------------------
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")

# Choose provider: "twelve" | "finnhub" | "alpha"
DATA_PROVIDER = os.getenv("DATA_PROVIDER", "twelve").lower()

app = FastAPI(
    title="Rnld Forex AI API",
    description="Live forex data backend for Rnld Forex AI",
    version="1.0.0",
)

# Allow frontend to call this API (important!)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------
# Response Models
# -------------------------------------------------
class PriceResponse(BaseModel):
    symbol: str
    price: float
    timestamp: str
    provider: str


class Candle(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[float] = None


class CandlesResponse(BaseModel):
    symbol: str
    interval: str
    candles: list[Candle]
    provider: str


class HealthResponse(BaseModel):
    status: str
    provider: str
    api_key_configured: bool
    time: str


# -------------------------------------------------
# Helper: Symbol formatting
# -------------------------------------------------
def format_symbol(symbol: str, provider: str) -> str:
    """Convert EURUSD → EUR/USD or EUR_USD depending on provider."""
    symbol = symbol.upper().replace("/", "").replace("_", "")
    if len(symbol) != 6:
        raise HTTPException(status_code=400, detail="Symbol must be 6 characters, e.g. EURUSD")

    base, quote = symbol[:3], symbol[3:]

    if provider == "twelve":
        return f"{base}/{quote}"
    elif provider == "finnhub":
        return f"OANDA:{base}_{quote}"
    elif provider == "alpha":
        return f"{base}/{quote}"
    return f"{base}/{quote}"


# -------------------------------------------------
# Twelve Data
# -------------------------------------------------
async def twelve_get_price(symbol: str) -> float:
    if not TWELVE_DATA_API_KEY:
        raise HTTPException(status_code=500, detail="TWELVE_DATA_API_KEY is not set in .env")

    url = "https://api.twelvedata.com/price"
    params = {"symbol": symbol, "apikey": TWELVE_DATA_API_KEY}

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, params=params)
        data = r.json()

    if "price" not in data:
        raise HTTPException(status_code=502, detail=f"Twelve Data error: {data}")
    return float(data["price"])


async def twelve_get_candles(symbol: str, interval: str, limit: int) -> list[dict]:
    if not TWELVE_DATA_API_KEY:
        raise HTTPException(status_code=500, detail="TWELVE_DATA_API_KEY is not set in .env")

    # Map frontend intervals to Twelve Data
    interval_map = {
        "1H": "1h",
        "4H": "4h",
        "1D": "1day",
        "1W": "1week",
        "1h": "1h",
        "4h": "4h",
        "1d": "1day",
        "1w": "1week",
    }
    td_interval = interval_map.get(interval, "1h")

    url = "https://api.twelvedata.com/time_series"
    params = {
        "symbol": symbol,
        "interval": td_interval,
        "outputsize": limit,
        "apikey": TWELVE_DATA_API_KEY,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        data = r.json()

    if "values" not in data:
        raise HTTPException(status_code=502, detail=f"Twelve Data error: {data}")

    candles = []
    for item in reversed(data["values"]):  # oldest → newest
        candles.append({
            "time": item["datetime"],
            "open": float(item["open"]),
            "high": float(item["high"]),
            "low": float(item["low"]),
            "close": float(item["close"]),
            "volume": float(item.get("volume", 0) or 0),
        })
    return candles


# -------------------------------------------------
# Finnhub (backup option)
# -------------------------------------------------
async def finnhub_get_price(symbol: str) -> float:
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=500, detail="FINNHUB_API_KEY is not set in .env")

    # Finnhub forex quote
    url = "https://finnhub.io/api/v1/quote"
    params = {"symbol": symbol, "token": FINNHUB_API_KEY}

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, params=params)
        data = r.json()

    if "c" not in data or data["c"] == 0:
        raise HTTPException(status_code=502, detail=f"Finnhub error: {data}")
    return float(data["c"])


# -------------------------------------------------
# Routes
# -------------------------------------------------
@app.get("/", response_model=HealthResponse)
async def root():
    return {
        "status": "ok",
        "provider": DATA_PROVIDER,
        "api_key_configured": bool(
            (DATA_PROVIDER == "twelve" and TWELVE_DATA_API_KEY)
            or (DATA_PROVIDER == "finnhub" and FINNHUB_API_KEY)
            or (DATA_PROVIDER == "alpha" and ALPHA_VANTAGE_API_KEY)
        ),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return await root()


@app.get("/api/price/{symbol}", response_model=PriceResponse)
async def get_price(symbol: str):
    """
    Get current price for a pair.
    Example: /api/price/EURUSD
    """
    formatted = format_symbol(symbol, DATA_PROVIDER)

    try:
        if DATA_PROVIDER == "twelve":
            price = await twelve_get_price(formatted)
        elif DATA_PROVIDER == "finnhub":
            price = await finnhub_get_price(formatted)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {DATA_PROVIDER}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch price: {str(e)}")

    return {
        "symbol": symbol.upper(),
        "price": price,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "provider": DATA_PROVIDER,
    }


@app.get("/api/candles/{symbol}", response_model=CandlesResponse)
async def get_candles(
    symbol: str,
    interval: str = Query("1H", description="1H, 4H, 1D, 1W"),
    limit: int = Query(60, ge=10, le=500),
):
    """
    Get OHLCV candles.
    Example: /api/candles/EURUSD?interval=1H&limit=60
    """
    formatted = format_symbol(symbol, DATA_PROVIDER)

    try:
        if DATA_PROVIDER == "twelve":
            candles = await twelve_get_candles(formatted, interval, limit)
        else:
            raise HTTPException(
                status_code=400,
                detail="Candles currently only supported with Twelve Data. Set DATA_PROVIDER=twelve",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch candles: {str(e)}")

    return {
        "symbol": symbol.upper(),
        "interval": interval,
        "candles": candles,
        "provider": DATA_PROVIDER,
    }


@app.get("/api/pairs")
async def list_pairs():
    """Return the supported major pairs."""
    return {
        "pairs": [
            "EURUSD", "GBPUSD", "USDJPY", "AUDUSD",
            "USDCAD", "USDCHF", "NZDUSD", "EURGBP",
            "EURJPY", "GBPJPY",
        ]
    }


# -------------------------------------------------
# Run with: uvicorn main:app --reload --port 8000
# -------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
