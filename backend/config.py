import os


class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://postgres:1234@localhost:5432/crm_car_wash"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-very-secret-key")
    JWT_EXPIRATION_HOURS = 24 * 7
