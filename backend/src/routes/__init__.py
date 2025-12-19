"""Routes package."""
from .jobs import router as jobs_router
from .images import router as images_router
from .modules import router as modules_router
from .download import router as download_router

__all__ = [
    "jobs_router",
    "images_router",
    "modules_router",
    "download_router",
]
