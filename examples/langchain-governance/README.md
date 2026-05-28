# LangChain Governance Example

This example shows how to add TealTiger governance to a LangChain tool-calling agent with a small wrapper around each tool.

It demonstrates:

- a LangChain agent with two tools;
- a TealEngine policy evaluation before each tool call;
- an `ALLOW` decision for the read-only `search_docs` tool;
- a `DENY` decision for the destructive `delete_customer` tool;
- blocked tool execution when TealTiger returns `DENY`;
- cost tracking across the agent run with `CostTracker`, `BudgetManager`, and `InMemoryCostStorage`.

## How It Works

LangChain owns agent orchestration and tool selection. TealTiger owns the governance decision before each tool body runs.

The example uses this flow:

1. Create a `TealEngine` policy that allows `search_docs` and denies `delete_customer`.
2. Create a LangChain tool-calling agent with both tools available.
3. Wrap each tool body with `TealEngine.evaluateWithMode(...)`.
4. Execute the tool only when the decision action is `ALLOW`.
5. Return a blocked result to the agent when the decision action is `DENY`.
6. Record LangChain model token usage with TealTiger cost tracking.
7. Print the final agent response and cost summary.

## Run

From the repository root, install the example dependencies:

```bash
npm install tealtiger@1.3.0 langchain @langchain/openai @langchain/core zod ts-node typescript
```

Set an OpenAI key:

```bash
export OPENAI_API_KEY="sk-..."
```

Copy `.env.example` in this directory if you prefer loading environment
variables from a file, and replace only the placeholder values.

On PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

Run the example:

```bash
npx ts-node examples/langchain-governance/index.ts
```

Optional:

```bash
export OPENAI_MODEL="gpt-4o-mini"
```

## Expected Output

The output includes two governance decisions:

1. `search_docs` is allowed because it is explicitly permitted by the TealEngine policy.
2. `delete_customer` is denied because it is explicitly blocked by the TealEngine policy.

The important lines look like:

```text
[TealTiger] ALLOW tool=search_docs reasons=POLICY_COMPLIANT
[TealTiger] DENY tool=delete_customer reasons=POLICY_VIOLATION,TOOL_NOT_ALLOWED
```

The denied tool body is not executed. The agent receives a blocked tool result instead, then the example prints a cost summary for the run.

## Why This Matters

LangChain can decide which tools an agent wants to call, but production systems still need a deterministic control point before side effects happen. Wrapping tool execution with TealEngine keeps that boundary explicit: the agent may request a tool call, but TealTiger decides whether the call is allowed before the tool body runs.
