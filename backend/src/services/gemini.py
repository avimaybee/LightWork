"""
Gemini API integration service.
Handles image generation with retry logic and rate limit handling.
Following fastapi-background-worker skill patterns.
"""
import asyncio
import base64
import logging
import os
import time
from typing import Optional

import httpx

from ..models.job import JobStatus

logger = logging.getLogger(__name__)

# Rate limiting constants (from PRD)
RATE_LIMIT_RPM = 7
MIN_INTERVAL_SECONDS = 60.0 / RATE_LIMIT_RPM  # ~8.57 seconds
COOLDOWN_SECONDS = 65
MAX_RETRIES = 3

# Track last request time for rate limiting
_last_request_time: float = 0


class RateLimitError(Exception):
    """Raised when API returns 429 or 503."""
    pass


class SafetyBlockError(Exception):
    """Raised when Gemini refuses due to safety policies."""
    pass


class GeminiError(Exception):
    """General Gemini API error."""
    pass


async def wait_for_rate_limit():
    """
    Wait until the rate limit window has passed.
    Ensures minimum 8.6 second interval between requests.
    """
    global _last_request_time
    
    if _last_request_time > 0:
        elapsed = time.monotonic() - _last_request_time
        if elapsed < MIN_INTERVAL_SECONDS:
            wait_time = MIN_INTERVAL_SECONDS - elapsed
            logger.info(f"Rate limit guard: waiting {wait_time:.2f}s")
            await asyncio.sleep(wait_time)
    
    _last_request_time = time.monotonic()


async def generate_image(
    image_data: bytes,
    prompt: str,
    aspect_ratio: str = "1:1",
    output_format: str = "webp",
    api_key: Optional[str] = None
) -> bytes:
    """
    Send image to Gemini for processing.
    
    Args:
        image_data: Raw bytes of the input image.
        prompt: The complete prompt (system + global + individual).
        aspect_ratio: Output aspect ratio.
        output_format: Output format (webp, png, jpeg).
        api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
    
    Returns:
        Raw bytes of the generated image.
    
    Raises:
        RateLimitError: If 429/503 is returned.
        SafetyBlockError: If content is blocked.
        GeminiError: For other API errors.
    """
    if api_key is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise GeminiError("GEMINI_API_KEY not set")
    
    # Wait for rate limit
    await wait_for_rate_limit()
    
    # Encode image to base64
    image_b64 = base64.b64encode(image_data).decode("utf-8")
    
    # Build request payload for Gemini 2.5 Flash Image
    # Using the gemini-2.5-flash-preview-image model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image:generateContent"
    
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/webp",
                            "data": image_b64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["image", "text"],
            "imageMimeType": f"image/{output_format}",
        }
    }
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            
            if response.status_code == 429 or response.status_code == 503:
                logger.warning(f"Rate limit hit: {response.status_code}")
                raise RateLimitError(f"API returned {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Gemini API error: {response.status_code} - {error_text}")
                
                # Check for safety block
                if "SAFETY" in error_text.upper() or "BLOCKED" in error_text.upper():
                    raise SafetyBlockError("Content blocked by safety filters")
                
                raise GeminiError(f"API error {response.status_code}: {error_text}")
            
            result = response.json()
            
            # Extract image from response
            candidates = result.get("candidates", [])
            if not candidates:
                raise GeminiError("No candidates in response")
            
            parts = candidates[0].get("content", {}).get("parts", [])
            for part in parts:
                if "inlineData" in part:
                    image_b64_result = part["inlineData"]["data"]
                    return base64.b64decode(image_b64_result)
            
            raise GeminiError("No image in response")
            
        except httpx.TimeoutException:
            logger.error("Gemini API timeout")
            raise GeminiError("API request timed out")
        except httpx.RequestError as e:
            logger.error(f"Request error: {e}")
            raise GeminiError(f"Request failed: {e}")


def get_rate_limit_status() -> dict:
    """
    Get current rate limit status for API health display.
    
    Returns:
        Dictionary with rate limit info.
    """
    global _last_request_time
    
    if _last_request_time == 0:
        time_since_last = None
        can_request = True
    else:
        time_since_last = time.monotonic() - _last_request_time
        can_request = time_since_last >= MIN_INTERVAL_SECONDS
    
    return {
        "rpm_limit": RATE_LIMIT_RPM,
        "min_interval_seconds": MIN_INTERVAL_SECONDS,
        "time_since_last_request": time_since_last,
        "can_request_now": can_request,
        "cooldown_seconds": COOLDOWN_SECONDS,
    }
