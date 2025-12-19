"""
Job and Image Pydantic models with JobStatus enum.
Following fastapi-background-worker skill patterns.
"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class JobStatus(str, Enum):
    """Job status lifecycle as defined in PRD."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COOLDOWN = "COOLDOWN"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUSED = "REFUSED"  # For policy violations


class AspectRatio(str, Enum):
    """Supported aspect ratios for image generation."""
    SQUARE = "1:1"
    LANDSCAPE = "16:9"
    PORTRAIT = "9:16"
    STANDARD = "4:3"
    TALL = "3:4"


class OutputFormat(str, Enum):
    """Supported output formats."""
    WEBP = "webp"
    PNG = "png"
    JPEG = "jpeg"


class ImageCreate(BaseModel):
    """Request model for creating an image in a job."""
    individual_prompt: Optional[str] = None


class ImageResponse(BaseModel):
    """Response model for an image."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    status: JobStatus = JobStatus.PENDING
    original_url: Optional[str] = None
    result_url: Optional[str] = None
    individual_prompt: Optional[str] = None
    retry_count: int = 0
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JobCreate(BaseModel):
    """Request model for creating a new job."""
    module_id: str
    global_prompt: Optional[str] = None
    aspect_ratio_override: Optional[AspectRatio] = None


class JobResponse(BaseModel):
    """Response model for a job."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    module_id: str
    global_prompt: Optional[str] = None
    aspect_ratio_override: Optional[AspectRatio] = None
    status: JobStatus = JobStatus.PENDING
    total_images: int = 0
    completed_images: int = 0
    failed_images: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JobWithImages(JobResponse):
    """Job response with embedded images."""
    images: list[ImageResponse] = []
