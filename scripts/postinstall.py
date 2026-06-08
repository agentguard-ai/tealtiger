"""
TealTiger First-Import Welcome Message (Python SDK)

Shows once on first `import tealtiger`. Uses ~/.tealtiger/.welcome_shown marker.

Usage in tealtiger/__init__.py:
    from tealtiger._welcome import show_welcome_once
    show_welcome_once()
"""

import os
import sys
from pathlib import Path

_SKIP = (
    os.environ.get("CI")
    or os.environ.get("DOCKER")
    or os.environ.get("TEALTIGER_QUIET")
    or not sys.stderr.isatty()
)

_MARKER = Path.home() / ".tealtiger" / ".welcome_shown"

T = "\033[36m"
G = "\033[32m"
B = "\033[1m"
D = "\033[2m"
R = "\033[0m"

MSG = f"""
{T}{B}  🐯 TealTiger installed successfully!{R}
{D}  ─────────────────────────────────────────────{R}

  {G}Quick start:{R}
    from tealtiger import TealOpenAI
    client = TealOpenAI(api_key="...")

  {G}Docs:{R}        https://github.com/agentguard-ai/tealtiger#quick-start
  {G}Dashboard:{R}   npx tealtiger dashboard
  {G}Discord:{R}     https://discord.gg/X2ePf8QAj

  {T}Got 30 seconds? Tell us what you're building:{R}
  {B}https://tally.so/r/aQzapZ{R}

{D}  Suppress: TEALTIGER_QUIET=1{R}
"""


def show_welcome_once():
    """Show welcome on first import. Marker file prevents repeats."""
    if _SKIP:
        return
    if _MARKER.exists():
        return
    try:
        _MARKER.parent.mkdir(parents=True, exist_ok=True)
        _MARKER.write_text("shown")
    except OSError:
        pass
    print(MSG, file=sys.stderr)
