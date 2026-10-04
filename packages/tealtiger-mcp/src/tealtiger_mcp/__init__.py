"""TealTiger MCP Server — Guardrails, cost tracking, and budget enforcement for MCP clients."""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

# Derived from the installed distribution rather than hardcoded.
#
# This previously duplicated the `version` field in pyproject.toml, and the two
# were free to drift: PyPI served 1.0.0 while `main` carried three unpublished
# user-visible changes and both version strings still read 1.0.0. Reading the
# installed metadata means __version__ cannot disagree with what was actually
# installed. The same fix was applied to the `tealtiger` core in 1.5.0, after
# PyPI served 1.4.1 while the package reported 1.4.0.
#
# importlib.metadata is stdlib from 3.8 and this package requires >=3.10, so no
# fallback import guard is needed.
try:
    __version__ = _pkg_version("tealtiger-mcp")
except PackageNotFoundError:  # pragma: no cover - running from a source tree
    __version__ = "0.0.0+unknown"

__all__ = ["__version__"]
