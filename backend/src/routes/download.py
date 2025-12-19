"""
Download API routes.
ZIP export functionality for completed images.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io
import zipfile

from ..models.job import JobStatus

router = APIRouter(prefix="/jobs/{job_id}", tags=["download"])


@router.get("/download")
async def download_zip(job_id: str):
    """
    Download all completed images as a ZIP file.
    
    Creates a ZIP archive containing all COMPLETED images from the job
    and streams it to the user.
    """
    from .jobs import get_job_by_id
    from .images import get_images_for_job, _result_data_store
    
    job = get_job_by_id(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    
    images = await get_images_for_job(job_id)
    completed_images = [img for img in images if img.status == JobStatus.COMPLETED]
    
    if not completed_images:
        raise HTTPException(status_code=404, detail="No completed images to download")
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, image in enumerate(completed_images, 1):
            if image.id in _result_data_store:
                filename = f"banana_{i:04d}.webp"
                zf.writestr(filename, _result_data_store[image.id])
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=bananabatch_{job_id[:8]}.zip"
        }
    )
