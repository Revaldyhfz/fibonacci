# analytics_service/health_routes.py - Add these routes to main.py

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import psycopg2
import os

def add_health_routes(app: FastAPI):
    """Add health check routes to FastAPI app"""
    
    @app.get("/health")
    def health_check():
        """Basic health check"""
        return {
            "status": "healthy",
            "service": "analytics-service",
            "version": "1.0.0"
        }
    
    @app.get("/ready")
    def readiness_check():
        """Readiness check with database connectivity"""
        try:
            # Test database connection
            DB_NAME = os.getenv("DB_NAME", "fibonacci")
            DB_USER = os.getenv("DB_USER", "postgres")
            DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
            DB_HOST = os.getenv("DB_HOST", "localhost")
            DB_PORT = os.getenv("DB_PORT", "5432")
            
            conn = psycopg2.connect(
                dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
                host=DB_HOST, port=DB_PORT
            )
            conn.close()
            
            return {
                "status": "ready",
                "database": "connected"
            }
        except Exception as e:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not ready",
                    "database": "disconnected",
                    "error": str(e)
                }
            )
    
    @app.get("/live")
    def liveness_check():
        """Liveness check"""
        return {
            "status": "alive",
            "service": "analytics-service"
        }

# Usage: Add to analytics_service/main.py after app = FastAPI(...)
# from .health_routes import add_health_routes
# add_health_routes(app)
