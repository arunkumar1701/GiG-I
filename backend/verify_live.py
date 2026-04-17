import requests

B = 'https://gig-i-backend-104692629504.asia-south1.run.app'

print('1. Health check...')
r = requests.get(B + '/health', timeout=15)
h = r.json()
print('   Status:', h.get('status'), '| DB:', h.get('database'), '| ENV:', h.get('environment'))

print()
print('2. Test registration (new phone)...')
r2 = requests.post(B + '/register', json={
    'name': 'Test Worker', 'city': 'Chennai', 'zone': 'Zone A',
    'platform': 'Zomato', 'weekly_income': 3000,
    'phone': '9123456780', 'vehicle_type': 'Bike'
}, timeout=15)
print('   HTTP:', r2.status_code)
if r2.status_code == 200:
    d = r2.json()
    print('   Keys returned:', list(d.keys()))
    print('   user_id:', d.get('user_id'))
elif r2.status_code == 409:
    print('   409 - phone already registered (OK, previous test)')
else:
    print('   ERROR:', r2.text[:400])

print()
print('3. Bad phone rejection test...')
r3 = requests.post(B + '/register', json={
    'name': 'X', 'city': 'C', 'zone': 'Zone A',
    'platform': 'Zomato', 'weekly_income': 1000,
    'phone': '123'
}, timeout=15)
print('   HTTP:', r3.status_code, '(expected 422)')
detail = r3.json().get('detail', '')
if isinstance(detail, list):
    print('   Validation error:', detail[0].get('msg', ''))
else:
    print('   Detail:', str(detail)[:200])
