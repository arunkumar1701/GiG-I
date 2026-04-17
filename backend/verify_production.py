import requests

BASE = "https://gig-i-backend-104692629504.asia-south1.run.app"
print("=== Cloud Run Production Verification ===\n")

# Health
r = requests.get(f"{BASE}/health", timeout=15)
h = r.json()
print(f"[1] Health:    {h['status']}  scheduler={h['scheduler_running']}  env={h['environment']}")

# Register to test Cloud SQL write
r2 = requests.post(f"{BASE}/register", json={
    "name": "CloudSQL Test",
    "city": "Mumbai",
    "zone": "Zone B",
    "platform": "Zomato",
    "weekly_income": 8000,
    "vehicle_type": "Bike",
    "vehicle_number": "MH01XX0001",
    "plan_tier": "Standard",
    "phone": "+919700000001",
    "upi_id": "cloudtest@upi",
    "bank_name": "ICICI",
    "bank_account_number": "123456789012",
    "ifsc_code": "ICIC0001234",
    "emergency_contact": "+919700000002"
}, timeout=25)
d2 = r2.json()
if r2.status_code == 200:
    print(f"[2] Register:  HTTP 200  user_id={d2.get('user_id')} --> Cloud SQL WRITE OK")
elif r2.status_code == 409:
    print(f"[2] Register:  HTTP 409 (already exists) --> Cloud SQL READ/WRITE OK")
else:
    print(f"[2] Register:  HTTP {r2.status_code}  body={str(d2)[:100]}")

# Login to test Cloud SQL read
r3 = requests.post(f"{BASE}/login", json={"phone": "+919700000001"}, timeout=15)
d3 = r3.json()
print(f"[3] Login:     HTTP {r3.status_code}  user_id={d3.get('user_id')} token={'SET' if d3.get('access_token') else 'MISSING'}")

# Weather
r4 = requests.get(f"{BASE}/weather/live", timeout=12)
zones = list(r4.json().keys()) if r4.status_code == 200 else []
print(f"[4] Weather:   HTTP {r4.status_code}  zones={zones}")

print()
print("=" * 50)
print("Cloud Run URL:  https://gig-i-backend-104692629504.asia-south1.run.app")
print("Cloud SQL:      gig-i-a4fea:asia-south1:gig-i-db (PostgreSQL 15)")
print("DB Name:        gig_i_prod")
print("DB User:        gig_i_user")
