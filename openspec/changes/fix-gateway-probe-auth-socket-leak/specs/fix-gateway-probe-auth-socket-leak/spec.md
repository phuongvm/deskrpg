# Hermes Gateway Probe Auth & Socket Leak Remediation

## ADDED Requirements

### Requirement: Token-Aware Gateway Probing in DeskRPG
The `probeHermesGateway` function SHALL accept an optional `token` in its options. When a token is provided, the probe SHALL forward it via an `Authorization: Bearer <token>` header when probing the `/v1/models` endpoint.

#### Scenario: Probing gateway with configured authentication token
- **GIVEN** a Hermes Gateway with authentication required (`API_SERVER_KEY`)
- **WHEN** DeskRPG calls `probeHermesGateway(baseUrl, { token })`
- **THEN** the request to `${prefix}/v1/models` includes `Authorization: Bearer <token>`
- **AND** the probe succeeds with `kind: "hermes"` and status 200

### Requirement: Robust 401 Classification for Hermes Gateways
The `probeHermesGateway` function SHALL classify a response from `${prefix}/v1/models` returning HTTP 401 as a valid Hermes gateway (`kind: "hermes"`) if the response body contains a JSON payload indicating Hermes gateway auth failure (`code: "gateway_auth_failed"` or `type: "gateway_auth_error"`).

#### Scenario: Probing authenticated gateway without token
- **GIVEN** a Hermes Gateway with authentication required
- **WHEN** DeskRPG calls `probeHermesGateway(baseUrl)` without a token
- **THEN** `/v1/models` returns HTTP 401 with JSON `{"error": {"type": "gateway_auth_error", "code": "gateway_auth_failed"}}`
- **AND** `probeHermesGateway` recognizes the gateway as `kind: "hermes"` rather than failing or timing out

### Requirement: Defense-in-Depth Connection Termination on Hermes Auth Failure
The Hermes Gateway `api_server` SHALL return a `Connection: close` HTTP header whenever an incoming request is rejected due to invalid or missing credentials in `_auth_failed_response()`.

#### Scenario: Rejecting unauthenticated LAN connection
- **GIVEN** an incoming HTTP request without a valid `API_SERVER_KEY`
- **WHEN** Hermes Gateway `api_server` evaluates `_check_auth`
- **THEN** it responds with HTTP 401 and `Connection: close`
- **AND** the underlying TCP transport is closed cleanly, preventing `CLOSE_WAIT` accumulation on Windows Proactor EventLoop

