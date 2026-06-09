# AWS MCP Policy Pack

This policy pack governs a consolidated AWS MCP toolset with emphasis on S3, EC2, and IAM operations.
It classifies high-risk infrastructure actions and blocks destructive patterns by default.

Use it when an agent needs to call AWS tooling but must not:

- terminate production compute,
- delete production storage resources, or
- mutate IAM permissions without explicit approval.

## Files

- `tool-catalog.json` lists AWS MCP tools and risk levels.
- `policy.yaml` contains argument-level deny/approval rules.
- `README.md` documents scope, default behavior, and customization points.

## Use

Apply the policy pack to an agent:

```bash
tealtiger policy apply policy-packs/aws-mcp/policy.yaml --agent <agent-id>
```

## Tool Classification

This pack uses three risk levels:

- `READ`: inventory and metadata operations.
- `MUTATING`: state changes that are reversible and scoped.
- `DESTRUCTIVE`: delete / terminate / irreversible permission operations.

## Governance Rules

The pack includes the following safety gates:

- `DENY` for bucket/resource deletion and instance termination on names that look like production.
- `DENY` for policy and principal deletion operations by default.
- `REQUIRE_APPROVAL` for instance starts/stops, IAM attachment operations, and role/user provisioning.

### Production Pattern Guard

Rules use argument-level conditions. Example:

```yaml
- tool: terminate_instances
  when:
    args.instance_id:
      pattern: "(?i)^prod-"
  action: DENY
```

## Notes

This is a baseline governance pack and should be narrowed for your environment:

- add exact account/region scoping to avoid over-broad deny,
- split by read-only and write-capable tool profiles,
- and align tool names to your deployed AWS MCP endpoint.
