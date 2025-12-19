"""
Jobs API routes.
CRUD operations for batch processing jobs.
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
import uuid

from ..models.job import (
    JobCreate,
    JobResponse,
    JobWithImages,
    JobStatus,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])

# In-memory store for demo (will be replaced with D1 in production)
_jobs_store: dict[str, JobResponse] = {}


@router.post("/", response_model=JobResponse)
async def create_job(job: JobCreate) -> JobResponse:
    """
    Create a new batch processing job.
    
    Returns a Job ID (UUID v4) that the client should save to LocalStorage
    for session recovery.
    """
    job_id = str(uuid.uuid4())
    
    new_job = JobResponse(
        id=job_id,
        module_id=job.module_id,
        global_prompt=job.global_prompt,
        aspect_ratio_override=job.aspect_ratio_override,
        status=JobStatus.PENDING,
        total_images=0,
        completed_images=0,
        failed_images=0,
    )
    
    _jobs_store[job_id] = new_job
    return new_job


@router.get("/{job_id}", response_model=JobWithImages)
async def get_job(job_id: str) -> JobWithImages:
    """
    Get job status and all images.
    
    This is the main polling endpoint for the frontend.
    Returns the job with all its images and their current status.
    """
    if job_id not in _jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = _jobs_store[job_id]
    
    # Import here to avoid circular imports
    from .images import get_images_for_job
    images = await get_images_for_job(job_id)
    
    # Calculate counts
    completed = sum(1 for img in images if img.status == JobStatus.COMPLETED)
    failed = sum(1 for img in images if img.status in [JobStatus.FAILED, JobStatus.REFUSED])
    
    return JobWithImages(
        **job.model_dump(),
        total_images=len(images),
        completed_images=completed,
        failed_images=failed,
        images=images,
    )


@router.delete("/{job_id}")
async def delete_job(job_id: str) -> dict:
    """
    Delete a job and all its images.
    
    Called when user clicks "Clear Job" after downloading.
    """
    if job_id not in _jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Import here to avoid circular imports
    from .images import delete_images_for_job
    await delete_images_for_job(job_id)
    
    del _jobs_store[job_id]
    
    return {"status": "deleted", "job_id": job_id}


def get_job_by_id(job_id: str) -> Optional[JobResponse]:
    """Helper to get job for internal use."""
    return _jobs_store.get(job_id)


def update_job_status(job_id: str, status: JobStatus):
    """Helper to update job status."""
    if job_id in _jobs_store:
        _jobs_store[job_id].status = status
