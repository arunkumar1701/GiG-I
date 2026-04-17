# 🧪 Performance Testing Plan

## Quick Smoke Tests (Run After Deployment)

### Test 1: Quote Calculation Speed ⚡
```bash
# Should respond in <2 seconds
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  "https://gig-i-a4fea.web.app/api/quote/1" 

# Expected response time: <100ms
# Even if APIs are slow, should never timeout
```

**Success Criteria:**
- ✅ Response arrives in <2 seconds
- ✅ Either has live data OR shows fallback pricing
- ✅ No error 503 or timeout errors

---

### Test 2: Registration Speed 🏃
```bash
# Time how long registration takes
POST /api/register
Headers: Content-Type: application/json

{
  "name": "Speed Test Worker",
  "city": "Chennai",
  "zone": "Zone A",
  "platform": "Swiggy",
  "weekly_income": 5800,
  "phone": "9876543210"
}

# Expected response time: <2 seconds
# Before fix: 3-5 seconds
```

**Success Criteria:**
- ✅ Response arrives in <2 seconds
- ✅ Returns JWT tokens successfully
- ✅ User created in database

---

### Test 3: Fraud Simulation Still Works 🔴
```bash
# Verify fraud test mode still functional
POST /api/simulate-event/{user_id}
Headers: Authorization: Bearer <token>

{
  "event_type": "trip",
  "event_data": {...},
  "fraud_test_mode": true,
  "fraud_device_claims": 0.8,
  "fraud_ip_claims": 0.7,
  "fraud_upi_claims": 0.9
}

# Should return FRS score 0.75+
```

**Success Criteria:**
- ✅ FRS score increases with fraud parameters
- ✅ Returns event_id successfully
- ✅ No regression from previous implementation

---

### Test 4: UI Responsiveness ✨
**In Browser (https://gig-i-a4fea.web.app):**

1. **Login Page Load**: <1s ✓
2. **Dashboard Load**: <2s ✓
3. **Calculate Premium Button**: Response <2s ✓
4. **Fraud Simulation Controls**: Load instantly ✓
5. **Admin Dashboard**: Fraud parameters update smoothly ✓

---

## Expected Performance Metrics

### Before Optimization ❌
```
Quote Calculation: 20-30 seconds (hangs if API slow)
Registration: 3-5 seconds
Weather API: 8 second timeout
Forecast API: 10 second timeout
AQI API: 6 second timeout
```

### After Optimization ✅
```
Quote Calculation: <100ms (or <2s with fallback)
Registration: <1 second
Weather API: 3 second timeout
Forecast API: 4 second timeout
AQI API: 2.5 second timeout
```

---

## Deployment Verification Checklist

- [ ] Backend deployed (gcloud builds submit exit 0)
- [ ] Frontend deployed (firebase deploy exit 0)
- [ ] Backend pod is running (check Cloud Run)
- [ ] Frontend accessible at https://gig-i-a4fea.web.app
- [ ] API responding at https://gig-i-a4fea.web.app/api/docs

---

## Fallback Verification

### Quote Calculation Fallback
Test by stopping external APIs or blocking them:
```
Expected: Premium calculated as income * 0.03
Example: ₹5800/week → ₹174 premium (instantly)
No timeout error shown to user
```

### Registration Fallback
No fallback needed here - just faster processing.

---

## Monitoring in Production

### Logs to Watch For
```bash
# These indicate timeouts were triggered
WARN: weather_service timeout, using fallback
WARN: forecast_service timeout, using fallback
WARN: aqi_service timeout, using fallback

# Should see these rarely (API should be fast)
```

### Key Metrics
- Quote endpoint p99 latency: <2s
- Registration endpoint p99 latency: <2s
- Timeout fallback rate: <5% of requests

---

## If Issues Occur

### Quote still timing out?
1. Check if external APIs (OpenWeatherMap, data.gov.in) are down
2. Verify network connectivity from Cloud Run
3. Check Cloud Run logs for timeout messages

### Registration still slow?
1. Check database connection health
2. Verify OTP service isn't bottleneck
3. Monitor CPU/memory on Cloud Run instance

### Fraud simulation not working?
1. Verify fraud_test_mode parameter is being passed
2. Check AI engine logs for model load issues
3. Ensure XGBoost model file is in Cloud Run container

---

## Next Steps After Testing

1. ✅ Verify all 4 smoke tests pass
2. ✅ Monitor production logs for 1-2 hours
3. ✅ Check error rates in Cloud Logging
4. ✅ Get user feedback on responsiveness
5. ✅ Document any new issues found

---

**Test Date**: ___________  
**Tester**: ___________  
**Status**: ___________  

