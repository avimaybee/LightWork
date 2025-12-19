"""
The "Banana Worker" - Background job processing loop.
Processes images from the queue with rate limiting and retry logic.
Following fastapi-background-worker skill patterns.
"""
import asyncio
import logging
from typing import Optional, Callable, Awaitable

from ..models.job import JobStatus, ImageResponse
from .gemini import (
    generate_image,
    RateLimitError,
    SafetyBlockError,
    GeminiError,
    COOLDOWN_SECONDS,
    MAX_RETRIES,
)
from .module_parser import get_module, build_full_prompt

logger = logging.getLogger(__name__)

# Global worker task reference
_worker_task: Optional[asyncio.Task] = None
_should_stop = False


# Type for database callbacks (injected by main app)
GetNextPendingImageCallback = Callable[[], Awaitable[Optional[tuple[ImageResponse, str, str, Optional[str]]]]]
UpdateImageStatusCallback = Callable[[str, JobStatus, Optional[str], Optional[bytes]], Awaitable[None]]
GetImageDataCallback = Callable[[str], Awaitable[bytes]]


async def run_worker_loop(
    get_next_pending: GetNextPendingImageCallback,
    update_status: UpdateImageStatusCallback,
    get_image_data: GetImageDataCallback,
    api_key: str,
):
    """
    Main worker loop that processes images from the queue.
    
    This runs continuously in the background, processing one image at a time
    with proper rate limiting (8.6s between requests) and retry logic.
    
    Args:
        get_next_pending: Callback to fetch next pending image from DB.
                         Returns (image, module_id, global_prompt, individual_prompt) or None.
        update_status: Callback to update image status in DB.
        get_image_data: Callback to fetch image bytes from R2.
        api_key: Gemini API key.
    """
    global _should_stop
    _should_stop = False
    
    logger.info("🍌 Banana Worker started")
    
    while not _should_stop:
        try:
            # Fetch next pending image
            result = await get_next_pending()
            
            if result is None:
                # No work to do, wait and poll again
                await asyncio.sleep(5)
                continue
            
            image, module_id, global_prompt, individual_prompt = result
            
            logger.info(f"Processing image {image.id} with module {module_id}")
            
            # Update status to PROCESSING
            await update_status(image.id, JobStatus.PROCESSING, None, None)
            
            # Get the module and build prompt
            module = get_module(module_id)
            if module is None:
                logger.error(f"Module not found: {module_id}")
                await update_status(image.id, JobStatus.FAILED, f"Module not found: {module_id}", None)
                continue
            
            full_prompt = build_full_prompt(module, global_prompt, individual_prompt)
            
            # Get image data from storage
            image_data = await get_image_data(image.id)
            
            # Process with retry logic
            success = False
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    result_bytes = await generate_image(
                        image_data=image_data,
                        prompt=full_prompt,
                        aspect_ratio=module.parameters.aspect_ratio.value,
                        output_format=module.parameters.output_format.value,
                        api_key=api_key,
                    )
                    
                    # Success!
                    await update_status(image.id, JobStatus.COMPLETED, None, result_bytes)
                    logger.info(f"✅ Image {image.id} completed successfully")
                    success = True
                    break
                    
                except RateLimitError:
                    logger.warning(f"🛑 Rate limit hit for image {image.id}. Cooling down...")
                    await update_status(image.id, JobStatus.COOLDOWN, "Rate limit - cooling down", None)
                    await asyncio.sleep(COOLDOWN_SECONDS)
                    # Don't count this as an attempt - retry
                    
                except SafetyBlockError as e:
                    logger.warning(f"🚫 Image {image.id} blocked by safety filters")
                    await update_status(image.id, JobStatus.REFUSED, str(e), None)
                    success = True  # Don't retry safety blocks
                    break
                    
                except GeminiError as e:
                    logger.error(f"Attempt {attempt}/{MAX_RETRIES} failed for image {image.id}: {e}")
                    if attempt == MAX_RETRIES:
                        await update_status(image.id, JobStatus.FAILED, str(e), None)
                    else:
                        # Wait before retry
                        await asyncio.sleep(5)
            
            if not success and image.retry_count >= MAX_RETRIES:
                logger.error(f"❌ Image {image.id} failed after {MAX_RETRIES} attempts")
                
        except asyncio.CancelledError:
            logger.info("🍌 Banana Worker shutting down...")
            break
        except Exception as e:
            logger.exception(f"Unexpected error in worker loop: {e}")
            await asyncio.sleep(5)  # Avoid tight loop on errors
    
    logger.info("🍌 Banana Worker stopped")


def start_worker(
    get_next_pending: GetNextPendingImageCallback,
    update_status: UpdateImageStatusCallback,
    get_image_data: GetImageDataCallback,
    api_key: str,
) -> asyncio.Task:
    """
    Start the background worker task.
    
    Returns:
        The asyncio Task running the worker.
    """
    global _worker_task
    
    if _worker_task is not None and not _worker_task.done():
        logger.warning("Worker already running")
        return _worker_task
    
    _worker_task = asyncio.create_task(
        run_worker_loop(get_next_pending, update_status, get_image_data, api_key)
    )
    return _worker_task


async def stop_worker():
    """Stop the background worker gracefully."""
    global _worker_task, _should_stop
    
    _should_stop = True
    
    if _worker_task is not None:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None


def is_worker_running() -> bool:
    """Check if the worker is currently running."""
    return _worker_task is not None and not _worker_task.done()
