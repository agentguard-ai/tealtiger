# Postgres MCP Policy Pack

This policy pack governs Postgres MCP tool calls. It classifies common Postgres MCP tools and blocks destructive SQL passed to `execute_sql` before the query reaches the database.

Use it when an agent needs database visibility but should not be able to drop tables, erase data, or change database permissions without review.

## Files

- `tool-catalog.json` lists common Postgres MCP tools and their risk levels.
- `policy.yaml` contains argument-level regex rules for `execute_sql`.
- `README.md` explains what is blocked, what requires approval, and how to customize the pack.

## Use

Apply the policy pack to agents that can call Postgres MCP tools:

```bash
tealtiger policy apply policy-packs/postgres-mcp/policy.yaml --agent <agent-id>
```

## Tool Classification

Read-only tools are classified as `READ`:

- `list_tables`
- `list_schemas`
- `describe_table`
- `get_table_schema`
- `list_columns`
- `list_indexes`
- `list_constraints`
- `explain_query`

The raw SQL executor is classified as `DESTRUCTIVE`:

- `execute_sql`

`execute_sql` is high risk because one tool call can read, modify, delete, reconfigure, or grant access depending on the SQL text.

## Blocked Queries

These queries are denied by default:

```sql
DROP TABLE users;
DROP SCHEMA analytics;
TRUNCATE orders;
DELETE FROM payments;
ALTER TABLE customers DROP COLUMN email;
ALTER SYSTEM SET log_statement = 'all';
COPY users TO PROGRAM 'cat > /tmp/users.csv';
CREATE EXTENSION file_fdw;
```

The pack includes more than five regex-based deny rules covering:

- `DROP` statements
- `TRUNCATE`
- `DELETE FROM`
- `ALTER TABLE ... DROP`
- `ALTER SYSTEM`
- `COPY ... PROGRAM`
- `CREATE EXTENSION`

## Queries Requiring Approval

Permission and role-management operations require human approval:

```sql
GRANT SELECT ON users TO analyst;
REVOKE ALL ON payments FROM app_user;
CREATE ROLE reporting_user;
ALTER ROLE app_user WITH CREATEDB;
DROP ROLE old_app_user;
CREATE USER dashboard_user;
ALTER USER dashboard_user WITH PASSWORD 'new-password';
DROP USER dashboard_user;
```

These queries are not always destructive, but they can change who has access to data or administrative capabilities.

## Allowed Queries

Read-only queries are allowed unless your local policy adds stricter controls:

```sql
SELECT * FROM users LIMIT 10;
SELECT id, email FROM customers WHERE id = 123;
SELECT COUNT(*) FROM orders WHERE status = 'pending';
EXPLAIN SELECT * FROM invoices WHERE created_at > now() - interval '7 days';
```

## Customization

Edit `policy.yaml` to fit your environment.

Common customizations:

- Narrow `DELETE FROM` to allow deletes only in development databases.
- Add table-specific deny rules for sensitive tables such as `users`, `payments`, or `audit_logs`.
- Add `REQUIRE_APPROVAL` rules for `UPDATE`, `INSERT`, or migration commands.
- Remove `CREATE EXTENSION` from `DENY` if extensions are managed by a separate approval workflow.

Example table-specific rule:

```yaml
- tool: execute_sql
  when:
    args.query:
      pattern: "(?i)\\bSELECT\\b.*\\bFROM\\s+(users|payments)\\b"
  action: REQUIRE_APPROVAL
  reason: "Sensitive table access requires human approval"
```

## Notes

Regex rules are a deterministic safety layer, not a complete SQL parser. For production systems, combine this policy pack with least-privilege database roles, read-only credentials for analysis agents, backups, and database-level audit logging.
