# Python Quickstarts

## LlamaIndex RAG Integration

`llamaindex_integration.py` shows how to add TealTiger governance to a
LlamaIndex retrieval-augmented generation flow. It demonstrates:

- checking user queries with TealTiger before they reach the retriever;
- blocking PII or secret-shaped queries before retrieval;
- using `TealOpenAI` as the governed LLM client for LlamaIndex generation;
- keeping the example syntax-checkable without LlamaIndex installed.

### Setup

Install the Python package and LlamaIndex dependencies:

```bash
pip install tealtiger llama-index openai
```

Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your-openai-api-key
```

On Windows PowerShell:

```powershell
$env:OPENAI_API_KEY = "your-openai-api-key"
```

Run the example from the TealTiger repository root:

```bash
python examples/python/llamaindex_integration.py
```

## TealMistral Quickstart

`mistral_quickstart.py` shows how to create a guarded Mistral AI chat client with TealTiger. It demonstrates:

- creating a `TealMistral` client with `MISTRAL_API_KEY`;
- registering PII detection in redact mode;
- registering prompt-injection detection in block mode;
- adding a daily budget with alert thresholds;
- making a Mistral chat request;
- printing guardrail results, token usage, request cost, and a cost summary.

### Setup

Install the Python package with the Mistral extra dependency available in your environment:

```bash
pip install tealtiger mistralai
```

Set your Mistral API key:

```bash
export MISTRAL_API_KEY=your-mistral-api-key
```

On Windows PowerShell:

```powershell
$env:MISTRAL_API_KEY = "your-mistral-api-key"
```

Run the quickstart from the TealTiger repository root:

```bash
python examples/python/mistral_quickstart.py
```

### Notes

- The example uses `mistral-small` to keep the first run cost-conscious.
- The prompt-injection check is demonstrated as a local preflight guardrail check so it does not require a second model call.
- The example uses placeholder environment-variable values only. Do not commit real API keys.

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
