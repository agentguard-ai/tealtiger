"""Test fallback for environments without the optional Haystack dependency."""

from __future__ import annotations

import importlib.util
import sys
import types
import uuid
from typing import Any, TypeVar

T = TypeVar("T")


if importlib.util.find_spec("haystack") is None:
    haystack = types.ModuleType("haystack")

    class Document:
        """Minimal Haystack Document fallback for adapter tests."""

        def __init__(
            self,
            content: str | None = None,
            meta: dict[str, Any] | None = None,
            id: str | None = None,
            blob: Any | None = None,
            score: float | None = None,
            embedding: list[float] | None = None,
            sparse_embedding: Any | None = None,
        ) -> None:
            self.id = id or uuid.uuid4().hex
            self.content = content
            self.blob = blob
            self.meta = meta or {}
            self.score = score
            self.embedding = embedding
            self.sparse_embedding = sparse_embedding

    class _StructuredLogger:
        def __init__(self, name: str) -> None:
            import logging

            self._logger = logging.getLogger(name)

        def info(self, msg: str, **kwargs: Any) -> None:
            self._logger.info(msg.format(**kwargs))

        def warning(self, msg: str, **kwargs: Any) -> None:
            self._logger.warning(msg.format(**kwargs))

    class _LoggingModule:
        @staticmethod
        def getLogger(name: str) -> _StructuredLogger:
            return _StructuredLogger(name)

    def component(cls: type[T]) -> type[T]:
        return cls

    def output_types(**_types: Any):
        def decorator(fn: T) -> T:
            return fn

        return decorator

    component.output_types = output_types  # type: ignore[attr-defined]
    haystack.Document = Document  # type: ignore[attr-defined]
    haystack.component = component  # type: ignore[attr-defined]
    haystack.logging = _LoggingModule  # type: ignore[attr-defined]
    sys.modules["haystack"] = haystack
