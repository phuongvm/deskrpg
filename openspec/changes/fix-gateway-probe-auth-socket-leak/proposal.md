## Why

Fix unauthenticated /v1/models probe in DeskRPG and add Connection: close header to Hermes API Server 401 response to eliminate Windows CLOSE_WAIT socket leaks.

## What Changes

- Promote the reviewed idea `hermes-gateway-probe-auth-socket-leak-remediation` into an implementation-ready OpenSpec change.
- Preserve traceability to the source idea while proposal, specs, design, and tasks are refined.

## Source Idea

- Path: `openspec/ideas/hermes-gateway-probe-auth-socket-leak-remediation.md`
- Promoted: 2026-09-26T08:49:44Z

### Idea Content

```md
# Hermes Gateway Probe Auth & Socket Leak Remediation

## Source
- Origin: mixed
- Created: 2026-09-26T08:37:13Z
- Tags: gateway, deskrpg, networking, auth, socket-leak

## Prompt
# Exploration: Hermes Gateway Probe Authentication & Socket Backlog Depletion

## Context & Problem Statement
DeskRPG running on Intel NUC (`192.168.100.110`) repeatedly connects to Hermes Gateway on Agent4070 (`http://192.168.100.130:8642`) to validate gateway connectivity and fetch model capabilities. 

However, two coupled failure modes cause severe degradation:
1. **Unauthenticated Model Probing in DeskRPG**:
   In `src/lib/hermes/gateway-probe.ts`, `probeHermesGateway` probes `GET /health` followed by `GET /v1/models` without forwarding the configured gateway token (`Authorization: Bearer <API_SERVER_KEY>`). When Hermes API Server has authentication enabled (`API_SERVER_KEY`), it rejects `/v1/models` with HTTP 401 Unauthorized.
2. **Server-Side TCP Socket Accumulation (`CLOSE_WAIT`) & Accept Backlog Saturation on Windows**:
   When DeskRPG receives 401 or aborts on timeout, Node's `fetch` client drops the connection (sending TCP FIN). On Windows (`aiohttp` under ProactorEventLoop without explicit `Connection: close` header on 401), the server keeps the socket open. Over 126 sockets accumulated in `CLOSE_WAIT` on port 8642, saturating Windows OS TCP accept backlog (128). This caused Windows kernel to return `WSAECONNREFUSED` (10061) to all subsequent connections, resulting in DeskRPG logging `fetch failed` and `deskrpg plugin probe: timeout`.

## Affected Files in DeskRPG
- `src/lib/hermes/gateway-probe.ts`: `probeHermesGateway` lacks token option and authorization header for `/v1/models`.
- `src/lib/gateway-resources.ts`: Calls `probeHermesGateway(binding.resource.baseUrl)` without passing available resource token.
- `src/app/api/gateways/[id]/test/route.ts`: Probes gateway without token during diagnostic tests.
- `src/lib/automation-gate.ts`: Probes deskrpg plugin (`/deskrpg/info`) which times out when 8642 backlog is saturated.

## Architecture & Failure Sequence
```
┌──────────────────────────────────────┐                ┌──────────────────────────────────────┐
│       DeskRPG (Intel NUC .110)       │                │      Hermes Gateway (Agent4070)      │
└──────────────────────────────────────┘                └──────────────────────────────────────┘
                   │                                                       │
  1. GET /health   │──────────────────────────────────────────────────────▶│  200 OK
                   │◀──────────────────────────────────────────────────────│
                   │                                                       │
  2. GET /v1/models│──────────────────────────────────────────────────────▶│  Requires API_SERVER_KEY
     (NO AUTH!)    │◀──────────────────────────────────────────────────────│  401 Unauthorized
                   │                                                       │
  3. Client drops  │─── FIN ──────────────────────────────────────────────▶│  Socket stays in
     connection    │                                                       │  CLOSE_WAIT
                   │                                                       │
  ... repeated 126 times ...                                               │  Backlog full (128)
                   │                                                       │
  4. Subsequent    │─── SYN ──────────────────────────────────────────────▶│
     probe / info  │◀── RST (ECONNREFUSED) ────────────────────────────────│  WSAECONNREFUSED
```

## Proposed Exploration Paths
- **Path 1 (DeskRPG Client Fix)**: Add optional `token` to `probeHermesGateway` options; if token is present, forward `Authorization: Bearer <token>` in the `/v1/models` probe. Also handle graceful socket termination.
- **Path 2 (DeskRPG Probe Fallback)**: If `/v1/models` returns 401, check if the response is JSON with `gateway_auth_failed` or `type: "gateway_auth_error"` - classify it as a valid authenticated Hermes API Server instead of dropping or hanging.
- **Path 3 (Hermes Gateway Defense-in-Depth)**: Ensure `_auth_failed_response()` in `api_server.py` includes `headers={"Connection": "close"}` to immediately terminate unauthenticated sockets and avoid Windows Proactor `CLOSE_WAIT` accumulation.
- **Path 4 (Agent4070 Network Scope)**: If external OpenAI-compatible API access is not required across LAN, bind `API_SERVER_HOST=127.0.0.1`.
```

## Capabilities

### New Capabilities
- `fix-gateway-probe-auth-socket-leak`: Initial capability placeholder created from the promoted idea. Refine before implementation.

### Modified Capabilities
- None yet.

## Impact

- TBD: Fill in affected code, APIs, dependencies, or systems before implementation.
