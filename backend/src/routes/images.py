"""
Images API routes.
Upload, status, and management of images within a job.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
import uuid

from ..models.job import (
    ImageCreate,
    ImageResponse,
    JobStatus,
)

router = APIRouter(prefix="/jobs/{job_id}/images", tags=["images"])

# In-memory store for demo (will be replaced with D1/R2 in production)
_images_store: dict[str, ImageResponse] = {}
_image_data_store: dict[str, bytes] = {}  # image_id -> raw bytes
_result_data_store: dict[str, bytes] = {}  # image_id -> result bytes


@router.post("/", response_model=ImageResponse)
async def upload_image(
    job_id: str,
    file: UploadFile = File(...),
    individual_prompt: Optional[str] = Form(None),
) -> ImageResponse:
    """
    Upload an image to the job queue.
    
    The image will be queued for processing by the Banana Worker.
    """
    from .jobs import get_job_by_id
    
    job = get_job_by_id(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Read file data
    file_data = await file.read()
    
    # Create image record
    image_id = str(uuid.uuid4())
    image = ImageResponse(
        id=image_id,
        job_id=job_id,
        status=JobStatus.PENDING,
        individual_prompt=individual_prompt,
    )
    
    _images_store[image_id] = image
    _image_data_store[image_id] = file_data
    
    return image


@router.get("/", response_model=list[ImageResponse])
async def list_images(job_id: str) -> list[ImageResponse]:
    """Get all images for a job."""
    return [img for img in _images_store.values() if img.job_id == job_id]


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(job_id: str, image_id: str) -> ImageResponse:
    """Get a specific image status."""
    if image_id not in _images_store:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image = _images_store[image_id]
    if image.job_id != job_id:
        raise HTTPException(status_code=404, detail="Image not found in this job")
    
    return image


@router.get("/{image_id}/original")
async def get_original_image(job_id: str, image_id: str):
    """Get the original uploaded image data."""
    from fastapi.responses import Response
    
    if image_id not in _image_data_store:
        raise HTTPException(status_code=404, detail="Image data not found")
    
    return Response(
        content=_image_data_store[image_id],
        media_type="image/webp",
    )


@router.get("/{image_id}/result")
async def get_result_image(job_id: str, image_id: str):
    """Get the processed result image."""
    from fastapi.responses import Response
    
    if image_id not in _result_data_store:
        raise HTTPException(status_code=404, detail="Result not ready")
    
    return Response(
        content=_result_data_store[image_id],
        media_type="image/webp",
    )


# Helper functions for internal use

async def get_images_for_job(job_id: str) -> list[ImageResponse]:
    """Get all images for a job (internal helper)."""
    return [img for img in _images_store.values() if img.job_id == job_id]


async def delete_images_for_job(job_id: str):
    """Delete all images for a job (internal helper)."""
    to_delete = [img_id for img_id, img in _images_store.items() if img.job_id == job_id]
    for img_id in to_delete:
        del _images_store[img_id]
        if img_id in _image_data_store:
            del _image_data_store[img_id]
        if img_id in _result_data_store:
            del _result_data_store[img_id]


async def get_next_pending_image():
    """
    Get the next pending image for the worker.
    
    Returns:
        Tuple of (image, module_id, global_prompt, individual_prompt) or None.
    """
    from .jobs import get_job_by_id
    
    for image in _images_store.values():
        if image.status == JobStatus.PENDING:
            job = get_job_by_id(image.job_id)
            if job:
                return (image, job.module_id, job.global_prompt, image.individual_prompt)
    return None


async def update_image_status(
    image_id: str,
    status: JobStatus,
    error_message: Optional[str],
    result_data: Optional[bytes],
):
    """Update image status (called by worker)."""
    if image_id in _images_store:
        _images_store[image_id].status = status
        if error_message:
            _images_store[image_id].error_message = error_message
        if result_data:
            _result_data_store[image_id] = result_data


async def get_image_data(image_id: str) -> bytes:
    """Get raw image bytes (called by worker)."""
    if image_id not in _image_data_store:
        raise ValueError(f"Image data not found: {image_id}")
    return _image_data_store[image_id]
