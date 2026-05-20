"""
Enable the generate_image tool for an agent.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.db.session import SessionLocal
from app.models.agent import AgentTool
from sqlalchemy import select

AGENT_ID = 1  # Change this to your agent ID
TOOL_KEY = "generate_image"

db = SessionLocal()
try:
    # Check if already enabled
    existing = db.scalar(
        select(AgentTool).where(
            AgentTool.agent_id == AGENT_ID,
            AgentTool.tool_key == TOOL_KEY
        )
    )

    if existing:
        if existing.enabled:
            print(f"✓ Tool '{TOOL_KEY}' is already enabled for agent {AGENT_ID}")
        else:
            print(f"+ Enabling tool '{TOOL_KEY}' for agent {AGENT_ID}...")
            existing.enabled = True
            db.commit()
            print("✓ Done!")
    else:
        print(f"+ Adding tool '{TOOL_KEY}' to agent {AGENT_ID}...")
        db.add(AgentTool(
            agent_id=AGENT_ID,
            tool_key=TOOL_KEY,
            enabled=True,
            config="{}"
        ))
        db.commit()
        print("✓ Done! generate_image tool is now enabled for this agent.")

    print("\nNext: Restart your backend and ask the agent to create an image!")

finally:
    db.close()
