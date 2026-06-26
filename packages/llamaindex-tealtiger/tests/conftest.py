"""Test configuration — mock llama_index.core before any test imports."""

import sys
from enum import Enum
from unittest.mock import MagicMock


class MockCBEventType(str, Enum):
    """Mock of llama_index.core.callbacks.CBEventType."""

    LLM = "llm"
    EMBEDDING = "embedding"
    RETRIEVE = "retrieve"
    QUERY = "query"
    FUNCTION_CALL = "function_call"


class MockBaseCallbackHandler:
    """Mock of llama_index.core.callbacks.base_handler.BaseCallbackHandler."""

    def __init__(
        self, event_starts_to_ignore=None, event_ends_to_ignore=None
    ):
        pass

    def start_trace(self, trace_id=None):
        pass

    def end_trace(self, trace_id=None, trace_map=None):
        pass


# Pre-populate sys.modules BEFORE any test imports llamaindex_tealtiger
_mock_callbacks = MagicMock()
_mock_callbacks.CBEventType = MockCBEventType
_mock_callbacks.CallbackManager = MagicMock()

_mock_base_handler = MagicMock()
_mock_base_handler.BaseCallbackHandler = MockBaseCallbackHandler

sys.modules.setdefault("llama_index", MagicMock())
sys.modules.setdefault("llama_index.core", MagicMock())
sys.modules["llama_index.core.callbacks"] = _mock_callbacks
sys.modules["llama_index.core.callbacks.base_handler"] = _mock_base_handler
