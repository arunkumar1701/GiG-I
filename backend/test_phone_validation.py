"""Quick phone validation test"""
from schemas import _validate_indian_mobile, UserCreate
from pydantic import ValidationError

print("=== Phone Validation Tests ===\n")

# Valid cases
valid = [
    ("9876543210",   "9876543210"),   # plain 10-digit
    ("+919876543210","9876543210"),   # +91 prefix
    ("919876543210", "9876543210"),   # 91 prefix no +
    ("6543210987",   "6543210987"),   # starts with 6
    ("7777777777",   "7777777777"),   # starts with 7
    ("8888888888",   "8888888888"),   # starts with 8
    (None,           None),           # optional field
]
print("Valid inputs:")
for inp, expected in valid:
    result = _validate_indian_mobile(inp)
    tag = "PASS" if result == expected else "FAIL"
    print(f"  [{tag}]  {inp!r}  ->  {result!r}")

# Invalid cases
invalid = [
    "123456789",       # 9 digits
    "12345678901",     # 11 digits
    "5876543210",      # starts with 5
    "0987654321",      # starts with 0
    "+441234567890",   # UK number
    "abcdefghij",      # non-numeric
    "98765432",        # 8 digits
    "9876 543210",     # spaces (12 chars, invalid after strip)
]
print("\nInvalid inputs (should all raise ValueError):")
for inp in invalid:
    try:
        result = _validate_indian_mobile(inp)
        print(f"  [FAIL]  {inp!r} -> should raise, got {result!r}")
    except ValueError as e:
        print(f"  [PASS]  {inp!r} -> {e}")

# Pydantic schema test
print("\nPydantic schema level:")
try:
    u = UserCreate(name="T", city="C", zone="Zone A",
                   platform="Zomato", weekly_income=1000, phone="123")
    print("  [FAIL]  Should have raised ValidationError")
except ValidationError as e:
    msg = e.errors()[0]["msg"]
    print(f"  [PASS]  ValidationError: {msg}")

try:
    u = UserCreate(name="T", city="C", zone="Zone A",
                   platform="Zomato", weekly_income=1000, phone="9876543210")
    print(f"  [PASS]  Valid phone stored as: {u.phone!r}")
except ValidationError as e:
    print(f"  [FAIL]  {e}")

# Emergency contact validation
try:
    u = UserCreate(name="T", city="C", zone="Zone A",
                   platform="Zomato", weekly_income=1000, emergency_contact="invalid")
    print("  [FAIL]  emergency_contact should have raised")
except ValidationError as e:
    msg = e.errors()[0]["msg"]
    print(f"  [PASS]  emergency_contact ValidationError: {msg}")

print()
print("=== All tests done ===")
