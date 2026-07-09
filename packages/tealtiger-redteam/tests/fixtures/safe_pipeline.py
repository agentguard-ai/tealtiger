"""Guarded Haystack pipeline fixture."""

from haystack import Pipeline
from haystack.components.builders import PromptBuilder
from haystack.components.generators import OpenAIGenerator
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack_integrations.components.connectors.tealtiger import (
    TealTigerCircuitBreaker,
    TealTigerGuardComponent,
    TealTigerPIIRedactor,
)

store = InMemoryDocumentStore()
retriever = InMemoryBM25Retriever(document_store=store, top_k=3)
prompt = PromptBuilder(template="Context: {{ documents }} Question: {{ question }}")
generator = OpenAIGenerator(model="gpt-4o-mini", generation_kwargs={"max_tokens": 512})

pipeline = Pipeline()
pipeline.add_component("retriever", retriever)
pipeline.add_component("guard", TealTigerGuardComponent(mode="refer"))
pipeline.add_component("pii_redactor", TealTigerPIIRedactor(action="redact"))
pipeline.add_component(
    "circuit_breaker",
    TealTigerCircuitBreaker(max_cost_per_session=0.50, max_iterations=4),
)
pipeline.add_component("prompt", prompt)
pipeline.add_component("generator", generator)

pipeline.connect("retriever.documents", "pii_redactor.documents")
pipeline.connect("pii_redactor.clean_documents", "prompt.documents")
pipeline.connect("guard.clean_output", "prompt.question")
pipeline.connect("prompt.prompt", "generator.prompt")
pipeline.connect("generator.replies", "circuit_breaker.text")
