"""
Modules API routes.
List available workflow modules.
"""
from fastapi import APIRouter, HTTPException

from ..models.module import WorkflowModule
from ..services.module_parser import get_all_modules, get_module

router = APIRouter(prefix="/modules", tags=["modules"])


@router.get("/", response_model=list[WorkflowModule])
async def list_modules() -> list[WorkflowModule]:
    """
    Get all available workflow modules.
    
    Used by the frontend to populate the module dropdown.
    """
    return get_all_modules()


@router.get("/{module_id}", response_model=WorkflowModule)
async def get_module_by_id(module_id: str) -> WorkflowModule:
    """Get a specific module by ID."""
    module = get_module(module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    return module
