import jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User

SECRET_KEY = "ENTERPRISE_DEVTRAILS_SECRET"
ALGORITHM = "HS256"
security = HTTPBearer()

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    payload = {"sub": str(user_id), "exp": expire, "role": "delivery_partner"}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        user = db.query(User).filter(User.id == user_id).first()
        if not user: raise HTTPException(status_code=401, detail="User disabled or deleted")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
