# Recipe A: Compliant Enterprise RAG Pipeline

Use `TealTigerPIIRedactor` between a Haystack document retriever and an LLM
generator so retrieved customer records are sanitized before they enter the
prompt.

This recipe is useful when vector stores or document stores contain dirty data
such as email addresses, phone numbers, SSNs, credit card numbers, or API keys.
The retriever can still find the right documents, but the LLM only receives
redacted content.

## Install

```bash
pip install haystack-ai tealtiger-haystack
```

## Pipeline

```python
from haystack import Document, Pipeline
from haystack.components.builders import PromptBuilder
from haystack.components.generators import OpenAIGenerator
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.utils import Secret
from haystack_integrations.components.connectors.tealtiger import TealTigerPIIRedactor

document_store = InMemoryDocumentStore()
document_store.write_documents([
    Document(content="Jane's email is jane@example.com and SSN is 123-45-6789."),
    Document(content="Support policy says never send raw PII to an LLM."),
])

prompt_template = """
Answer using only the sanitized context.

Context:
{% for document in documents %}
- {{ document.content }}
{% endfor %}

Question: {{ question }}
Answer:
"""

pipeline = Pipeline()
pipeline.add_component("retriever", InMemoryBM25Retriever(document_store=document_store))
pipeline.add_component("pii_redactor", TealTigerPIIRedactor(action="redact"))
pipeline.add_component(
    "prompt",
    PromptBuilder(
        template=prompt_template,
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

result = pipeline.run({
    "retriever": {"query": "How should support handle Jane's ticket?", "top_k": 3},
    "prompt": {"question": "How should support handle Jane's ticket?"},
})
```

## Redact Or Flag

`TealTigerPIIRedactor(action="redact")` replaces detected values with
`[REDACTED]`. Use this mode for production RAG paths where the generator should
not see raw PII.

`TealTigerPIIRedactor(action="flag")` leaves content unchanged and records
findings in each document's `meta["tealtiger_pii"]`. Use this mode for audit
or migration runs before enforcing redaction.

Each run returns:

```python
{
    "clean_documents": [...],
    "summary": {
        "action": "redact",
        "documents_processed": 2,
        "findings_total": 2,
        "findings": [
            {"type": "email", "start": 16, "end": 32, "replacement": "[REDACTED]"},
            {"type": "ssn", "start": 44, "end": 55, "replacement": "[REDACTED]"},
        ],
    },
}
```

The component works with `InMemoryDocumentStore`, BM25 retrievers, and vector
database retrievers because it only depends on Haystack's standard
`List[Document]` retriever output.
