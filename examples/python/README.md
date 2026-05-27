# Python Quickstarts

## TealCohere RAG Quickstart

`cohere_quickstart.py` demonstrates a small retrieval-augmented generation
flow with Cohere and TealTiger.

It shows how to:

- configure `TealCohere`
- embed local documents with Cohere Embed
- search the local document embeddings for relevant context
- generate an answer with Cohere Chat and selected RAG documents
- enable PII and prompt-injection guardrails
- enable cost tracking, budget checks, and print a cost summary

### Setup

Install the Python package and Cohere dependency from the repository root:

```bash
pip install -e packages/tealtiger-python
pip install cohere
```

Set your Cohere API key:

```bash
export COHERE_API_KEY=your-cohere-api-key
```

On Windows PowerShell:

```powershell
$env:COHERE_API_KEY = "your-cohere-api-key"
```

Run the example:

```bash
python examples/python/cohere_quickstart.py
```

The script prints the retrieved document titles, model answer, guardrail
summary, budget check result, and cost summary.
