# AIverse Tools API: frontend integration guide

Everything the browser calls goes through the **Gateway**. The Gateway checks the user's JWT, forwards the request to the AI server, and adds the user's identity and a shared secret. The browser never sends `user_id`, never sees Composio credentials, and never talks to the AI server directly.

| What | Browser URL (via Gateway) |
|---|---|
| Tools API | `/api/v1/ai/api/tools/...` |
| Connections (OAuth) | `/api/v1/ai/api/integrations/connections/...` |

Every request needs `Authorization: Bearer <access token>`. Paths below are relative to `/api/v1/ai/api`.

## Error format

Tools API errors always look like this (FastAPI validation errors, status `422`, keep the default shape):

```json
{ "detail": { "code": "ambiguous_connection", "message": "You have 2 active github accounts; choose one with connected_account_id", "candidates": [{ "id": "ca_a", "alias": "work" }] } }
```

Branch on `detail.code`, show `detail.message`. Connection endpoints (`/integrations/...`) return `{ "detail": "text" }`.

| HTTP | `code` | Meaning / what the UI should do |
|---|---|---|
| 400 | `validation_error` | Arguments do not match the tool's schema. Show `message`. |
| 400 | `connection_required` | User has no active account for this toolkit. Start the connect flow. |
| 400 | `connection_toolkit_mismatch` | The chosen account belongs to another toolkit. |
| 404 | `tool_not_found`, `provider_not_found` | Unknown id. |
| 404 | `connection_not_found` | Account does not exist or is not the user's. |
| 404 | `upstream_not_found` | The provider could not find the tool/account. |
| 409 | `ambiguous_connection` | Several accounts match. Let the user pick one from `candidates`, resend with `connected_account_id`. |
| 409 | `connection_inactive` | Account expired or revoked (`connection_status`). Reconnect it. |
| 429 | `rate_limited` | Wait `Retry-After` seconds (also `detail.retry_after`). |
| 401 | (Gateway) | Session expired. The existing client refreshes the token and retries once. |
| 403 | `provider_forbidden` | The provider refused this account/tool. |
| 502 | `provider_authentication_failed`, `discovery_failed`, `provider_error` | Server-side provider problem. Show a generic "try later". It is **never** 401, so it must not log the user out. |
| 503 | `provider_unavailable` | Provider down or not configured. |
| 504 | `provider_timeout` | Provider too slow. Safe to retry reads; ask before retrying executions. |

A tool that ran but failed (for example the target API returned 422) is **not** an HTTP error: you get `200` with `"success": false` and `error`.

## Catalog

### `GET /tools/catalog`
Query: `provider_key`, `toolkit_key`, `category`, `status`, `enabled` (default `true`), `search` (max 100 chars, matched literally against name/slug/id/description/toolkit), `sort` = `name|toolkit|category|updated`, `order` = `asc|desc`, `page` (from 1), `page_size` (1 to 200, default 50).

```json
{
  "items": [{
    "id": "7c0c…", "provider_key": "composio", "external_tool_id": "GITHUB_CREATE_ISSUE",
    "slug": "github_create_issue", "name": "Create Issue", "description": "…",
    "category": "developer tools", "toolkit_key": "github", "execution_type": "hosted",
    "requires_connection": true, "required_parameters": ["owner", "repo", "title"], "parameter_count": 9,
    "version": "20261112_00", "status": "active", "enabled": true, "last_seen_at": "2026-11-18T01:00:00Z"
  }],
  "total": 883, "page": 1, "page_size": 50, "total_pages": 18
}
```
List items are summaries (no schemas). `GET /tools/providers/{provider_key}/catalog` is the same, scoped to one provider.

### `GET /tools/{tool_id}`
Same fields plus `input_schema` (JSON Schema), `output_schema`, `auth_requirements` (`{ "required": true, "scopes": [...] }`), `tool_metadata`. Use `input_schema` to render the argument form.

### `GET /tools/toolkits` / `GET /tools/categories`
`[{ "provider_key": "composio", "toolkit_key": "github", "tool_count": 883, "category": "developer tools" }]` and `[{ "category": "developer tools", "tool_count": 900 }]`. Optional `provider_key`, `search`, `enabled`.

### `GET /tools/providers`
`[{ "provider_key": "composio", "name": "Composio", "status": "active", "enabled": true, "last_synced_at": "…", … }]`.

## Connecting an account (OAuth)

The provider hosts OAuth and stores tokens. AIverse only starts the flow and reports status. No token ever reaches the browser.

1. `POST /integrations/connections` with `{ "toolkit": "github", "callback_url": "https://app.example.com/integrations" }`. The `callback_url` origin must be in the server's allow-list. Response: `{ "id": "ca_…", "status": "INITIATED", "redirect_url": "https://connect.composio.dev/…" }`.
2. Save `id` (for example in `sessionStorage`), then `window.location.assign(redirect_url)`.
3. The user returns to `callback_url`. Poll `GET /integrations/connections/{id}` every ~2 s until `status` is `ACTIVE` (done) or `FAILED` / `EXPIRED` / `INACTIVE` / `REVOKED` (show `status_reason`). Stop after about 90 s.
4. `GET /integrations/connections?toolkit=github&status=ACTIVE` lists the user's accounts. `DELETE /integrations/connections/{id}` revokes one.

Connection object: `{ id, status, status_reason, alias, toolkit: { slug }, auth_config_id, auth_scheme, created_at, updated_at, is_disabled }`. Other users' connections are invisible (`404`).
Auth-config endpoints (`/integrations/auth-configs…`) are administrative: MASTER only.

## Running a tool

### `POST /tools/execute`
```json
{ "tool_id": "7c0c…", "arguments": { "owner": "aiverse", "repo": "platform", "title": "Bug" }, "connected_account_id": "ca_a" }
```
`connected_account_id` is **optional**. The server chooses the account:

| Situation | Result |
|---|---|
| Tool needs no connection | Runs without one |
| You send an id | Must be the caller's, `ACTIVE`, and for the tool's toolkit, else `404` / `409` / `400` |
| You omit it, exactly one active account for the toolkit | That account is used |
| None | `400 connection_required` |
| Several | `409 ambiguous_connection` with `candidates` |

Response (`200`):
```json
{ "success": true, "data": { "number": 42 }, "error": null,
  "metadata": { "tool_id": "7c0c…", "provider": "composio", "latency_ms": 812, "connected_account_id": "ca_a", "account_source": "auto", "request_id": null } }
```
`account_source` is `"auto"` or `"explicit"`. Do not send `user_id`; unknown fields are rejected with `422`.

Recommended UI flow: validate the form against `input_schema` → execute → on `409` show an account picker → retry with the chosen id → on `400 connection_required` open the connect flow.

### `POST /tools/{tool_id}/test`
Body: `{ "arguments": {…}, "connected_account_id": "ca_a" (optional), "live": false }`. The tool id comes from the URL; do not send it in the body.

- **Default (`live` omitted or `false`) is a dry run.** Nothing is executed and the provider's tool is never called. It reports four checks: `tool_available`, `provider_ready`, `arguments_valid`, `connected_account`.
- **`"live": true`** runs the same checks and, only if they all pass, executes the tool for real (this can have side effects). Ask the user to confirm before sending it.

```json
{ "mode": "dry_run", "passed": false, "executed": false,
  "tool": { "id": "7c0c…", "name": "Create Issue", "slug": "github_create_issue" },
  "checks": [
    { "name": "tool_available", "status": "passed", "message": "Tool and provider are enabled", "details": {} },
    { "name": "arguments_valid", "status": "failed", "message": "Arguments do not match the tool's input schema", "details": { "errors": ["arguments: 'title' is a required property"] } },
    { "name": "connected_account", "status": "failed", "message": "Connect a github account before using this tool", "details": { "code": "connection_required" } }
  ],
  "connected_account_id": null, "execution": null }
```
Check `status` is `passed`, `failed` or `skipped`. A failed dry run is still HTTP `200`: read `passed`. For `live: true`, `executed` tells you whether it ran and `execution` has the same shape as the execute response.

### `GET /tools/{tool_id}/test/history`
Query: `page`, `page_size` (max 100). Returns only **the caller's** runs: `test_mode` is `execute`, `dry_run` or `live_test`; `status` is `success` or `failed`; inputs are stored with secrets masked as `[REDACTED]` and oversized payloads replaced by `{ "truncated": true }`.

## Administration (MASTER only, enforced by the Gateway)

- `POST /tools/sync` and `POST /tools/providers/{provider_key}/sync`: body `{ "allow_empty_catalog": false }`. A provider that returns an empty catalog is refused unless this is `true`. Result counts: `discovered`, `inserted`, `updated`, `unchanged`, `deactivated`, `status` (`success` or `partial`; a partial run never deactivates tools).
- `GET /tools/sync/history?provider_key=…&page=…`.
- Periodic sync runs automatically when the server has `TOOLS_SCHEDULED_SYNC_ENABLED=true`, using each provider's `sync_interval_minutes`.

## Health

`GET /tools/health[?probe=true]`: `{ "status": "healthy|degraded", "providers": [{ "provider_key", "status", "configured", "available", "detail", "sync_interval_minutes", "last_synced_at" }], "scheduler": { "enabled": true, … } }`. `available` is only filled in with `probe=true`, which makes one lightweight call per provider (10 s limit).

## Security rules the UI can rely on

- Identity always comes from the Gateway; any `user_id` in a body is rejected.
- Credentials (OAuth tokens, client secrets, provider API keys) are never returned and never logged. Responses contain only whitelisted fields.
- Upstream error text is never forwarded; only the codes above.
