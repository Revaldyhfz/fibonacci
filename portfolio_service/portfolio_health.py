# portfolio_service/health_routes.py - Add these routes to main.py

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import os

def add_health_routes(app: FastAPI):
    """Add health check routes to FastAPI app"""
    
    @app.get("/health")
    def health_check():
        """Basic health check"""
        return {
            "status": "healthy",
            "service": "portfolio-service",
            "version": "1.0.0"
        }
    
    @app.get("/ready")
    def readiness_check():
        """Readiness check"""
        try:
            # Can add external API checks here if needed
            return {
                "status": "ready",
                "external_apis": "available"
            }
        except Exception as e:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not ready",
                    "error": str(e)
                }
            )
    
    @app.get("/live")
    def liveness_check():
        """Liveness check"""
        return {
            "status": "alive",
            "service": "portfolio-service"
        }

# CORS Configuration Fix
# Replace the hardcoded CORS origins with environment variable:
#
# BEFORE:
# allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"]
#
# AFTER:
# import os
# ALLOWED_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=ALLOWED_ORIGINS,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
