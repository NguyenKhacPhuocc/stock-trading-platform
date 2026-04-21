from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os

app = FastAPI(
    title="Stock AI Service",
    description="Service phân tích kỹ thuật và gợi ý xu hướng cổ phiếu",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("BACKEND_URL", "http://localhost:3001")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Schema
# ============================================================

class AnalysisResult(BaseModel):
    symbol: str
    signal: str           # "bullish" | "bearish" | "sideways"
    confidence: float     # 0.0 – 1.0
    summary: str
    indicators: dict

class IndicatorsResult(BaseModel):
    symbol: str
    sma_20: Optional[float]
    sma_50: Optional[float]
    ema_12: Optional[float]
    ema_26: Optional[float]
    rsi_14: Optional[float]
    macd: Optional[float]
    macd_signal: Optional[float]

# ============================================================
# Endpoints
# ============================================================

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/analyze/{symbol}", response_model=AnalysisResult)
def analyze(symbol: str):
    """
    Phân tích xu hướng cổ phiếu dựa trên dữ liệu giá lịch sử.
    Phase 4: logic rule-based từ indicators. Có thể mở rộng sang ARIMA/LSTM sau.
    """
    symbol = symbol.upper()

    # TODO Phase 4: gọi DB (hoặc nhận data từ NestJS) để lấy PriceHistory
    # Tạm thời trả về placeholder
    return AnalysisResult(
        symbol=symbol,
        signal="sideways",
        confidence=0.0,
        summary=f"Chưa có đủ dữ liệu để phân tích {symbol}. Implement Phase 4.",
        indicators={},
    )


@app.get("/indicators/{symbol}", response_model=IndicatorsResult)
def get_indicators(symbol: str):
    """
    Trả về các chỉ báo kỹ thuật: SMA, EMA, RSI, MACD.
    Phase 4: tính từ PriceHistory thực tế.
    """
    symbol = symbol.upper()

    # TODO Phase 4: tính chỉ báo thực tế từ dữ liệu
    return IndicatorsResult(
        symbol=symbol,
        sma_20=None,
        sma_50=None,
        ema_12=None,
        ema_26=None,
        rsi_14=None,
        macd=None,
        macd_signal=None,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
