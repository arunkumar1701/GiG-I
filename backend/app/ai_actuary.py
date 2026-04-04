from statsmodels.tsa.arima.model import ARIMA
from typing import Tuple

class RiskEngine:
    def __init__(self, platform_margin_inr: float = 25.0):
        self.margin = platform_margin_inr

    def calculate_premium(self, avg_hourly_wage: float, zone_id: str) -> Tuple[float, float]:
        spark_historical_hours = [1.2, 0.5, 3.0, 0.0, 2.1, 0.4, 0.0, 1.5, 2.2, 0.0]
        model = ARIMA(spark_historical_hours, order=(1, 0, 1))
        forecast = model.fit().forecast(steps=7)
        predicted_lost_hours = max(0.0, sum(forecast))
        weekly_premium = (predicted_lost_hours * avg_hourly_wage) + self.margin
        return round(weekly_premium, 2), round(predicted_lost_hours, 2)
