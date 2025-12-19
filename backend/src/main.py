"""
BananaBatch API - Main FastAPI Application.

A "Set & Forget" batch image processing pipeline using Gemini 2.5 Flash Image.
Runs on Cloudflare Python Workers with D1/R2 bindings.
"""
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import jobs_router, images_router, modules_router, download_router
from .services import load_modules, start_worker, stop_worker, get_rate_limit_status
from .routes.images import get_next_pending_image, update_image_status, get_image_data

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Starts the Banana Worker on startup and stops it on shutdown.
    """
    # Startup
    logger.info("🍌 BananaBatch API starting up...")
    
    # Load workflow modules
    try:
        modules = load_modules()
        logger.info(f"Loaded {len(modules)} workflow modules")
    except Exception as e:
        logger.error(f"Failed to load modules: {e}")
        raise
    
    # Start the background worker
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        start_worker(
            get_next_pending=get_next_pending_image,
            update_status=update_image_status,
            get_image_data=get_image_data,
            api_key=api_key,
        )
        logger.info("🍌 Banana Worker started")
    else:
        logger.warning("⚠️ GEMINI_API_KEY not set - worker not started")
    
    yield
    
    # Shutdown
    logger.info("🍌 BananaBatch API shutting down...")
    await stop_worker()
    logger.info("🍌 Goodbye!")


# Create FastAPI app
app = FastAPI(
    title="BananaBatch API",
    description="A 'Set & Forget' batch image processing pipeline using Gemini 2.5 Flash Image",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(jobs_router)
app.include_router(images_router)
app.include_router(modules_router)
app.include_router(download_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": "BananaBatch API",
        "version": "0.1.0",
        "status": "healthy",
        "emoji": "🍌",
    }


@app.get("/health")
async def health():
    """Detailed health check with rate limit status."""
    from .services import is_worker_running
    
    return {
        "status": "healthy",
        "worker_running": is_worker_running(),
        "rate_limit": get_rate_limit_status(),
    }


# For Cloudflare Workers ASGI compatibility
# The worker runtime will call this app directly
