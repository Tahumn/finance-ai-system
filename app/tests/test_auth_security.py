import pytest
from app.auth.security import hash_password, verify_password, create_access_token, decode_token

def test_password_hashing():
    password = "secret_password"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False

def test_jwt_token_flow():
    subject = "user_123"
    email = "test@example.com"
    token = create_access_token(subject=subject, email=email)
    
    assert isinstance(token, str)
    
    decoded = decode_token(token)
    assert decoded is not None
    assert decoded["sub"] == subject
    assert decoded["email"] == email
    assert "exp" in decoded

def test_decode_invalid_token():
    assert decode_token("invalid.token.string") is None
