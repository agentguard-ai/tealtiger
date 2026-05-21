# MCP Governance Example

This example shows how to govern Model Context Protocol (MCP) tool calls with TealTiger's `TealRegistry`.

It demonstrates:

- a mock MCP server with four tools;
- approved MCP tool definitions registered as `tools` catalog entries in `TealRegistry`;
- allowlist enforcement for a live tool that was not approved;
- definition-drift detection when a live tool definition hash no longer matches the approved hash;
- a denied decision containing the `MCP_DEFINITION_DRIFT` reason code.

## How It Works

MCP tools are defined by `name`, `description`, and `inputSchema`. Those fields are security-sensitive because an attacker or compromised integration can change a description or schema to alter agent behavior.

The example uses this flow:

1. Build an MCP server with approved tool definitions.
2. Hash each approved definition deterministically.
3. Store each approved hash in `TealRegistry` as a `tools` catalog entry.
4. Before a tool call executes, hash the live MCP definition.
5. Deny the call if the tool is not allowlisted.
6. Deny the call with `MCP_DEFINITION_DRIFT` if the live hash differs from the approved hash.
7. Execute the tool only when the allowlist and hash checks pass.

## Run

Initialize the TypeScript SDK package dependencies, then run the example through `ts-node`:

```bash
cd packages/tealtiger-sdk
npm install
npx ts-node ../../examples/mcp-governance/index.ts
```

## Expected Output

The output includes three decisions:

1. `search_docs` is allowed because it is registered and its live definition matches the approved hash.
2. `lookup_customer` is denied with `MCP_DEFINITION_DRIFT` after its live description changes.
3. `delete_customer` is denied with `TOOL_NOT_ALLOWLISTED` because it was added to the MCP server after registry approval.

## Why This Matters

MCP definition drift is different from a normal runtime argument violation. The tool name may still look familiar, but the live definition can change the instructions or schema seen by an agent. Keeping approved definition hashes in `TealRegistry` gives platform teams a simple control point for blocking changed or unapproved tools before execution.
