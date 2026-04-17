"""Debug script to test failing endpoints."""
import requests, json

BASE = "http://127.0.0.1:8000"
r = requests.post(f"{BASE}/login", json={"phone": "+919876543210"}, timeout=10)
d = r.json()
token = d.get("access_token")
user_id = d.get("user_id")
headers = {"Authorization": f"Bearer {token}"}

# Test 1: GET /user/{id} -> actual route is /user/{user_id}/dashboard
print("--- Test 1: /user/{id} ---")
r2 = requests.get(f"{BASE}/user/{user_id}", headers=headers, timeout=5)
print(f"  /user/{user_id} -> {r2.status_code}")
r3 = requests.get(f"{BASE}/user/{user_id}/dashboard", headers=headers, timeout=5)
print(f"  /user/{user_id}/dashboard -> {r3.status_code}")
if r3.status_code == 200:
    d3 = r3.json()
    um = d3.get("user_meta", {})
    print(f"  name={um.get('full_name')} zone={um.get('zone')}")

print()

# Test 2: POST /policy/buy -> actual routes: /quote/{id} then /policy/create
print("--- Test 2: /policy/buy ---")
r4 = requests.post(f"{BASE}/policy/buy", headers=headers, json={"user_id": user_id, "zone": "Zone A"}, timeout=10)
print(f"  /policy/buy -> {r4.status_code} {r4.json()}")

r5 = requests.get(f"{BASE}/quote/{user_id}", headers=headers, timeout=10)
print(f"  /quote/{user_id} -> {r5.status_code} premium={r5.json().get('premium')}")

print()

# Test 3: GET /policy/{user_id} -> actual is /policies/{user_id}
print("--- Test 3: /policy/{user_id} ---")
r6 = requests.get(f"{BASE}/policy/{user_id}", headers=headers, timeout=5)
print(f"  /policy/{user_id} -> {r6.status_code} {r6.json()}")
r7 = requests.get(f"{BASE}/policies/{user_id}", headers=headers, timeout=5)
print(f"  /policies/{user_id} -> {r7.status_code}")
if r7.status_code == 200:
    data = r7.json()
    print(f"  count={len(data.get('policies', []))}")

print()

# Test 4: GET /claims/{user_id}
print("--- Test 4: /claims/{user_id} ---")
r8 = requests.get(f"{BASE}/claims/{user_id}", headers=headers, timeout=5)
print(f"  /claims/{user_id} -> {r8.status_code}")

# Test wallet balance field name
print()
print("--- Wallet field check ---")
rw = requests.get(f"{BASE}/wallet/{user_id}", headers=headers, timeout=5)
if rw.status_code == 200:
    wd = rw.json()
    print(f"  Keys: {list(wd.keys())}")
    print(f"  balanceTokens={wd.get('balanceTokens')} balance={wd.get('balance')}")
