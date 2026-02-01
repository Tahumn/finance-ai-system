from app.auth import schemas


def register_user(user: schemas.UserCreate):
    # Mocked register; replace with hashing + DB insert
    return {"user_id": 1, "email": user.email}


def authenticate_user(user: schemas.UserLogin):
    # Mocked auth; replace with DB lookup + password verify
    return {"access_token": "mock-jwt", "token_type": "bearer"}

