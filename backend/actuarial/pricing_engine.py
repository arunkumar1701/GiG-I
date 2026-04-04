import random
from typing import List, Tuple
from statsmodels.tsa.arima.model import ARIMA

class ParametricPricer:
    def __init__(self, platform_margin: float = 15.0):
        self.platform_margin = platform_margin

    def _ingest_spark_data(self, zone_id: str) -> List[float]:
        return [random.uniform(0.0, 3.5) for _ in range(30)]

    def generate_quote(self, avg_hourly_wage: float, zone_id: str) -> Tuple[float, float]:
        historical_h = self._ingest_spark_data(zone_id)
        model = ARIMA(historical_h, order=(1, 0, 0))
        fit_model = model.fit()
        forecast = fit_model.forecast(steps=7)
        h_forecast = max(0.0, sum(forecast))
        premium = (h_forecast * avg_hourly_wage) + self.platform_margin
        return round(premium, 2), round(h_forecast, 2)
