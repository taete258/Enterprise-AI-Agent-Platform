"""
One-shot script to insert the generate_image tool into the running database.
Run once: python add_generate_image_tool.py
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.db.session import SessionLocal, engine, Base
from app.models.tool import Tool
from sqlalchemy import select

TOOL_KEY = "generate_image"
TOOL_SCHEMA = (
    '{"type": "object", "properties": {'
    '"prompt": {"type": "string", "description": "Detailed description of the image to generate in English. Be specific about style, colors, composition, and subject."}, '
    '"size": {"type": "string", "description": "Image dimensions: 1024x1024 (square), 1792x1024 (landscape), or 1024x1792 (portrait)", "enum": ["1024x1024", "1792x1024", "1024x1792"], "default": "1024x1024"}, '
    '"quality": {"type": "string", "description": "Image quality: standard or hd", "enum": ["standard", "hd"], "default": "standard"}, '
    '"model": {"type": "string", "description": "Model to use for image generation. Examples: dall-e-3 (OpenAI), gemini-3.5-flash-image-preview (OpenRouter), openrouter/auto (OpenRouter auto-select)", "default": ""}'
    '}, "required": ["prompt"]}'
)

db = SessionLocal()
try:
    existing = db.scalar(select(Tool).where(Tool.key == TOOL_KEY))
    if existing:
        print(f"✓ Tool '{TOOL_KEY}' already exists (id={existing.id}). Updating...")
        existing.name = "Generate Image"
        existing.description = (
            "Generate an image from a detailed text prompt using DALL-E 3 (OpenAI) or text-to-image models from OpenRouter (e.g., Gemini, etc.). "
            "Use this when the user asks to create, draw, or generate any image or picture. "
            "Returns an image URL to display."
        )
        existing.url = "/api/mock/generate-image"
        existing.method = "GET"
        existing.schema_json = TOOL_SCHEMA
        existing.is_system = False
    else:
        print(f"+ Inserting new tool '{TOOL_KEY}'...")
        db.add(Tool(
            name="Generate Image",
            key=TOOL_KEY,
            description=(
                "Generate an image from a detailed text prompt using DALL-E 3 (OpenAI) or text-to-image models from OpenRouter (e.g., Gemini, etc.). "
                "Use this when the user asks to create, draw, or generate any image or picture. "
                "Returns an image URL to display."
            ),
            type="api",
            url="/api/mock/generate-image",
            method="GET",
            schema_json=TOOL_SCHEMA,
            is_system=False,
        ))
    db.commit()
    print("✓ Done! generate_image tool is now in the database.")
    print("\nNext steps:")
    print("  1. Go to Admin → Tools to confirm it appears.")
    print("  2. Open your agent → enable 'Generate Image' tool.")
    print("  3. Restart the backend if it was already running.")
    print("  4. Ask the agent: 'สร้างภาพแมวกำลังนอนในสวน'")
finally:
    db.close()
