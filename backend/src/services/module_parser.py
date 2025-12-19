"""
Module parser service.
Loads and validates workflow modules from modules.json.
Following workflow-module-schema skill patterns.
"""
import json
import logging
from pathlib import Path
from typing import Optional

from ..models.module import WorkflowModule

logger = logging.getLogger(__name__)

# Cache for loaded modules
_modules_cache: dict[str, WorkflowModule] = {}


def load_modules(modules_path: Optional[Path] = None) -> dict[str, WorkflowModule]:
    """
    Load and validate all modules from modules.json.
    Modules are cached after first load.
    
    Args:
        modules_path: Optional path to modules.json. 
                     Defaults to backend/modules.json.
    
    Returns:
        Dictionary mapping module ID to validated WorkflowModule.
    
    Raises:
        FileNotFoundError: If modules.json doesn't exist.
        ValidationError: If any module fails validation.
    """
    global _modules_cache
    
    if _modules_cache:
        return _modules_cache
    
    if modules_path is None:
        # Default to modules.json in backend root
        modules_path = Path(__file__).parent.parent.parent / "modules.json"
    
    if not modules_path.exists():
        raise FileNotFoundError(f"Modules file not found: {modules_path}")
    
    with open(modules_path, "r", encoding="utf-8") as f:
        raw_modules = json.load(f)
    
    for raw_module in raw_modules:
        try:
            module = WorkflowModule.model_validate(raw_module)
            _modules_cache[module.id] = module
            logger.info(f"Loaded module: {module.id} ({module.name})")
        except Exception as e:
            logger.error(f"Failed to validate module {raw_module.get('id', 'unknown')}: {e}")
            raise
    
    logger.info(f"Successfully loaded {len(_modules_cache)} modules")
    return _modules_cache


def get_module(module_id: str) -> Optional[WorkflowModule]:
    """
    Get a specific module by ID.
    
    Args:
        module_id: The unique module identifier.
    
    Returns:
        The WorkflowModule if found, None otherwise.
    """
    modules = load_modules()
    return modules.get(module_id)


def get_all_modules() -> list[WorkflowModule]:
    """
    Get all available modules.
    
    Returns:
        List of all WorkflowModules.
    """
    modules = load_modules()
    return list(modules.values())


def build_full_prompt(
    module: WorkflowModule,
    global_prompt: Optional[str] = None,
    individual_prompt: Optional[str] = None
) -> str:
    """
    Build the complete prompt for Gemini API.
    Combines system instruction + global prompt + individual prompt.
    
    Following the prompt injection strategy from workflow-module-schema skill:
    1. system_instruction (Module-level persona)
    2. global_prompt (User-defined batch instructions)
    3. individual_prompt (Per-item override)
    
    Args:
        module: The workflow module to use.
        global_prompt: Optional batch-wide instructions.
        individual_prompt: Optional per-image instructions.
    
    Returns:
        The assembled prompt string.
    """
    parts = [module.system_instruction]
    
    if global_prompt:
        parts.append(f"Additionally, for this batch: {global_prompt}")
    
    if individual_prompt:
        parts.append(f"For this specific image: {individual_prompt}")
    
    return "\n\n".join(parts)
