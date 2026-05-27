# Python Quickstarts

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
