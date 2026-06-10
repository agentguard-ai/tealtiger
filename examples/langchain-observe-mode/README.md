# LangChain Observe-Mode Quickstart

This example demonstrates TealTiger’s zero-config observe flow (`REPORT_ONLY`) with
LangChain.

- no custom policy files are required
- callback-based governance visibility is enabled with `TealTigerCallbackHandler`
- output prints observed tool calls, cost estimates, and redacted fields

## Run

```bash
python examples/langchain-observe-mode/observe_example.py
```

Environment:

```bash
pip install langchain langchain-openai langchain_tealtiger
export OPENAI_API_KEY="sk-..."
```

Expected output includes:

- tool calls observed by the handler
- cost and token accounting in the audit rows
- detected PII in the `audit_trail` output (redacted report mode)

## Notes

- This example is intentionally in `REPORT_ONLY` mode so it does not block
  decisions yet.
- If your installed callback interface differs, check the constructor arguments
  for your `TealTigerCallbackHandler` version and pass the equivalent enum/value.
