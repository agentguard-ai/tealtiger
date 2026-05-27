# Policy Examples

This directory contains small TealEngine policy examples that can be copied,
validated, and adapted for common agent-governance patterns.

Validate any example from the repository root:

```bash
npm run validate:policy -- examples/policies/customer-support.json
```

## Examples

| Policy | Use when | Main controls |
| --- | --- | --- |
| [`customer-support.json`](./customer-support.json) | A support agent can chat with customers and search help content but must not delete or export customer data. | Allows chat/search, denies delete/export tools, enables PII redaction and moderated output. |
| [`code-assistant.json`](./code-assistant.json) | A development assistant can read and edit sandbox files and run tests under constrained execution rules. | Requires sandboxed code execution, blocks risky functions and shell patterns, limits file sizes and test runs. |
| [`data-analyst.json`](./data-analyst.json) | An analyst agent can query approved tables and read reports without changing source data. | Allows read/query tools, denies writes/deletes, caps rows, blocks PII export, and limits cost to $10/day. |
| [`minimal.json`](./minimal.json) | You need the smallest valid policy as a starting point for custom governance. | Allows one chat tool and leaves other policy areas unset. |

## Adapting these policies

- Replace `agentId`, `role`, and permission strings with names used by your
  application.
- Keep denied tools explicit when the risk matters, such as destructive writes
  or bulk exports.
- Validate edited JSON before using it in CI/CD or runtime policy enforcement.
