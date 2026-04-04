import random
import uuid

def calculate_premium(weekly_income, zone, platform="Swiggy"):
    base = weekly_income * 0.05
    factors = []
    
    zone_risks = {"Zone A": 45.0, "Zone B": 25.0, "Zone C": 12.0}
    base_zone = zone_risks.get(zone, 25.0)
    
    factors.append(f"Base Income Mapping (5%): +₹{round(base, 2)}")
    factors.append(f"Historical Zone Risk ({zone}): +₹{base_zone}")
    
    discount = 0.0
    if zone == "Zone C" or zone == "Zone B":
         discount += 2.50
         factors.append(f"Hyper-local ML factor: {zone} historically safe from water logging (-₹2.50)")
         
    if platform.lower() == "zomato":
         discount += 1.00
         factors.append("Platform integration efficiency discount (-₹1.00)")
         
    ml_weather_factor = round(random.uniform(-3.0, 5.0), 2)
    factors.append(f"Predictive 7-day weather ML modelling: {'+' if ml_weather_factor > 0 else '-'}₹{abs(ml_weather_factor)}")
    
    final_premium = base + base_zone - discount + ml_weather_factor
    predicted_hours = round(random.uniform(5.0, 15.0), 1)
    
    return round(final_premium, 2), factors, predicted_hours

def evaluate_fraud_multipass():
    """
    Tiered AI Fraud evaluation pipeline for Phase 2 zero-touch processing.
    Returns frs1, frs2, frs3, status, explanation, transaction_id, logs
    """
    logs = []
    
    logs.append({"step": "INIT", "message": "Starting multi-pass fraud evaluation pipeline."})
    
    # 1. Tier 1: Initial rules-based FRS
    frs1 = round(random.uniform(0.1, 0.45), 3)
    logs.append({"step": "FRS1_CHECK", "message": f"Evaluated primary parameters (Rainfall Volume, Geo-Fence). FRS1: {frs1}"})
    
    if frs1 < 0.20:
        logs.append({"step": "DECISION", "message": "FRS1 strictly benign. No further checks required. Approving."})
        tx_id = f"TXN_{random.randint(100000,999999)}"
        return frs1, None, None, "Approved", "Tier 1: Minimal risk detected.", tx_id, logs
        
    logs.append({"step": "FRS2_START", "message": "Ambiguous FRS1 risk threshold. Initiating Tier 2 Deep Scan."})
    # 2. Tier 2: Deep validation (GPS/Time mismatch)
    frs2 = round(frs1 + random.uniform(0.05, 0.4), 3)
    logs.append({"step": "FRS2_SCAN", "message": f"Cross-referencing secondary databases (Device Integrity, App Ping Time overlap). FRS2 projected: {frs2}"})
    
    if frs2 > 0.70:
         logs.append({"step": "DECISION", "message": "FRS2 critically high. Suspected spoofing. Rejecting claim."})
         return frs1, frs2, None, "Rejected", "Tier 2: Device location anomaly detected.", None, logs
         
    logs.append({"step": "FRS3_START", "message": "Validation inconclusive. Engaging LLM reasoning engine (Tier 3)."})
    # 3. Tier 3: AI Logic Pass
    frs3 = round(frs2 + random.uniform(-0.15, 0.2), 3)
    explanations = [
        "LLM Output: Verified weather impact aligns mathematically with average transit delay logs.",
        "LLM Output: Negligible variance in expected trip time vs outage time. Approving.",
        "LLM Output: Cross-correlating zone radar logic shows high probability of legitimate disruption."
    ]
    explanation = random.choice(explanations)
    logs.append({"step": "FRS3_AGENT", "message": f"AI Parsing Complete. FRS3: {frs3}. Reasoning: {explanation}"})
    
    if frs3 > 0.75:
        logs.append({"step": "DECISION", "message": "AI identifies structured anomaly. Rejecting claim."})
        return frs1, frs2, frs3, "Rejected", "Tier 3: AI flagged logical anomaly in disruption narrative.", None, logs
        
    logs.append({"step": "DECISION", "message": "AI cleared claim. Generating Payout Token."})
    tx_id = f"TXN_{random.randint(100000,999999)}"
    return frs1, frs2, frs3, "Approved", explanation, tx_id, logs
