# TealTiger Policy Pack — GitHub MCP Server

This policy pack classifies GitHub MCP tools and applies strict baseline
governance for repository, issue, pull request, and review workflows.

## Use

Apply to an agent with:

```bash
tealtiger policy apply policy-packs/github-mcp/policy.yaml --agent <agent-id>
```

## Risk Model

The pack classifies tools into three categories:

- `READ` — safe inventory or query operations
- `MUTATING` — creates/updates state in small scope
- `DESTRUCTIVE` — high-impact operations that can alter branch history or
  repository state broadly

## Tools

### Read-only

`add_comment_to_pending_review`, `add_issue_comment`, `assign_copilot_to_issue` are
kept as mutating, while read-only tools include:

- `get_commit`, `get_file_contents`, `get_label`, `get_latest_release`,
  `get_me`, `get_release_by_tag`, `get_tag`, `get_team_members`, `get_teams`,
  `issue_read`, `list_branches`, `list_commits`, `list_issue_types`,
  `list_issues`, `list_pull_requests`, `list_releases`, `list_tags`,
  `pull_request_read`, `search_code`, `search_issues`,
  `search_pull_requests`, `search_repositories`, `search_users`.

### Mutating / Destructive

- `create_branch`, `create_or_update_file`, `issue_write`, `pull_request_review_write`,
  `create_pull_request`, `request_copilot_review`, `update_pull_request`,
  `sub_issue_write`, `assign_copilot_to_issue`, `add_comment_to_pending_review`.
- Destructive tools: `create_repository`, `delete_file`, `fork_repository`,
  `merge_pull_request`, `push_files`, `update_pull_request_branch`.

## Default Guardrail Behavior

- `create_repository`, `fork_repository`, `merge_pull_request`,
  `update_pull_request_branch`, `push_files`, and `delete_file` are `DENY` by
  default.
- Sensitive writes (`create_or_update_file`, `create_pull_request`, `issue_write`)
  require explicit approval in this pack.

## Why this policy

GitHub operations can touch sensitive code and release flow. The strict defaults
help prevent uncontrolled file edits, branch changes, and merges while still
allowing read/search workflows to proceed.

## Example TEEC-style Receipt

```json
{
  "tool": "push_files",
  "action": "DENY",
  "reason": "Push is blocked by default in this baseline pack.",
  "policy": "policy-packs/github-mcp/policy.yaml",
  "agent": "<agent-id>"
}
```

## Customization

If your org has controlled bot workflows, loosen a rule by switching selected
`REQUIRE_APPROVAL` actions to `ALLOW` and keep `merge_pull_request` denied by
default unless there is explicit process approval.
