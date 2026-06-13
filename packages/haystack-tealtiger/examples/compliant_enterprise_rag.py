"""Compliant enterprise RAG pipeline with TealTiger PII redaction.

Run with:
    pip install haystack-ai tealtiger-haystack
    export OPENAI_API_KEY=...
    python examples/compliant_enterprise_rag.py
"""

from __future__ import annotations

from haystack import Document, Pipeline
from haystack.components.builders import PromptBuilder
from haystack.components.generators import OpenAIGenerator
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.utils import Secret

from haystack_integrations.components.connectors.tealtiger import TealTigerPIIRedactor

PROMPT_TEMPLATE = """
Answer the question using only the sanitized context.

Context:
{% for document in documents %}
- {{ document.content }}
{% endfor %}

Question: {{ question }}
Answer:
"""


def build_pipeline() -> Pipeline:
    """Build a RAG pipeline that redacts retrieved documents before generation."""
    document_store = InMemoryDocumentStore()
    document_store.write_documents(
        [
            Document(
                content=(
                    "Customer Jane Doe can be reached at jane@example.com. "
                    "Her support ticket references SSN 123-45-6789."
                )
            ),
            Document(
                content=(
                    "Enterprise policy says support agents must never send raw "
                    "PII or API keys to an LLM generator."
                )
            ),
        ]
    )

    pipeline = Pipeline()
    pipeline.add_component("retriever", InMemoryBM25Retriever(document_store=document_store))
    pipeline.add_component("pii_redactor", TealTigerPIIRedactor(action="redact"))
    pipeline.add_component(
        "prompt",
        PromptBuilder(
            template=PROMPT_TEMPLATE,
            required_variables=["documents", "question"],
        ),
    )
    pipeline.add_component(
        "generator",
        OpenAIGenerator(api_key=Secret.from_env_var("OPENAI_API_KEY")),
    )

    pipeline.connect("retriever.documents", "pii_redactor.documents")
    pipeline.connect("pii_redactor.clean_documents", "prompt.documents")
    pipeline.connect("prompt.prompt", "generator.prompt")
    return pipeline


if __name__ == "__main__":
    rag = build_pipeline()
    result = rag.run(
        {
            "retriever": {"query": "How should support handle Jane's ticket?", "top_k": 3},
            "prompt": {"question": "How should support handle Jane's ticket?"},
        }
    )

    print(result["generator"]["replies"][0])
    print(result["pii_redactor"]["summary"])
