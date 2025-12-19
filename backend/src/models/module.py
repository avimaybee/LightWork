"""
WorkflowModule Pydantic model for JSON schema validation.
Following workflow-module-schema skill patterns.
"""
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AspectRatio(str, Enum):
    """Supported aspect ratios."""
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


class ModuleParameters(BaseModel):
    """Parameters for a workflow module."""
    aspect_ratio: AspectRatio
    output_format: OutputFormat


class WorkflowModule(BaseModel):
    """
    A workflow module definition.
    Loaded from modules.json at startup.
    """
    id: str = Field(..., pattern=r"^[a-z0-9-]+$", description="Unique kebab-case identifier")
    name: str = Field(..., description="Human-readable display name")
    icon: str = Field(..., description="Lucide icon name")
    description: Optional[str] = Field(None, description="Module description")
    category: Optional[str] = Field(None, description="Module category for grouping")
    system_instruction: str = Field(..., description="Core prompt defining AI persona and task")
    parameters: ModuleParameters
    user_prompt_placeholder: Optional[str] = Field(None, description="Placeholder for per-image prompt field")
