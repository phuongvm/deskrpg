# DeskRPG and Plugin Upstream Sync Specification

## ADDED Requirements

### Requirement: Isolated Worktree Reconciliation (SYNC-1)
The merge of `upstream/master` into `origin/master` for both `deskrpg` and `deskrpg-hermes-plugin` SHALL be executed exclusively in dedicated, isolated worktrees (`O:/workspaces/wt-deskrpg-sync` and `O:/workspaces/wt-deskrpg-plugin-sync`) without mutating the live checkouts or production installations.

#### Scenario: Live checkouts untouched during reconciliation
- **GIVEN** live checkout `oss/deskrpg` and live checkout `oss/deskrpg-hermes-plugin`
- **WHEN** reconciliation is performed in worktrees
- **THEN** neither live repository has its HEAD commit or branch changed during candidate formation
- **AND** the live production installation at `_config/agent4070/hermes/plugins/deskrpg` remains unmodified

### Requirement: Conflict Accounting and Invariant Preservation (SYNC-2)
Every merge conflict SHALL be resolved according to the design resolution matrix, no merge conflict markers SHALL remain in candidate commits, and no local operational invariants SHALL be dropped or weakened.

#### Scenario: No conflict markers in candidate commits
- **GIVEN** candidate merge commits for application and plugin
- **WHEN** `git diff --check HEAD^1 HEAD` and `git grep -nE '^(<<<<<<<|=======|>>>>>>>)'` are executed
- **THEN** no conflict marker lines or whitespace errors are reported

### Requirement: In-Flight Dirty-Tree Preservation (SYNC-3)
All uncommitted in-flight modifications in `oss/deskrpg` and `oss/deskrpg-hermes-plugin` SHALL be preserved by creating and checking out dedicated feature branches before any reconciliation operations begin, per binding determination D4.

#### Scenario: Application WIP tree preserved on dedicated branch
- **GIVEN** 29 in-flight files (11 modified, 18 untracked) for OpenSpec change `room-creation-availability-and-validation-feedback` in `oss/deskrpg`
- **WHEN** preservation step runs
- **THEN** branch `wip/room-creation-apply` is created and all 29 files are committed with full fidelity
- **AND** `git -C oss/deskrpg status --short` becomes clean

#### Scenario: Plugin junction-lock fix preserved on dedicated branch
- **GIVEN** uncommitted junction lock fixes in `oss/deskrpg-hermes-plugin`
- **WHEN** preservation step runs
- **THEN** branch `wip/junction-lock-0.30.3` is created and committed
- **AND** `git -C oss/deskrpg-hermes-plugin status --short` becomes clean

### Requirement: Plugin-First Reconciliation Order (SYNC-4)
`deskrpg-hermes-plugin` SHALL be reconciled, tested, and assigned a candidate commit SHA before `deskrpg` application reconciliation begins, per binding determination D5.

#### Scenario: Plugin candidate commit available before app pin rewrite
- **GIVEN** upstream plugin `upstream/master` (tag `v0.31.0`)
- **WHEN** plugin reconciliation completes in `wt-deskrpg-plugin-sync`
- **THEN** `plugin.yaml` version is `0.31.0`
- **AND** all plugin pytest suites pass
- **AND** a valid candidate commit SHA is recorded for downstream application pinning

### Requirement: Application Reconciliation with Fork Plugin Pin (SYNC-5)
The `deskrpg` application SHALL update `src/lib/hermes/setup/pin.ts` to pin the verified fork plugin commit SHA and version `0.31.0`, ensuring that setup and installation operations clone from the verified fork rather than unmanaged upstream.

#### Scenario: Plugin pin points to verified fork commit
- **GIVEN** candidate commit on application branch `sync/upstream-master-2026-10-02`
- **WHEN** `src/lib/hermes/setup/pin.ts` is inspected
- **THEN** `PLUGIN_PIN.commit` matches the verified fork plugin candidate SHA
- **AND** `PLUGIN_PIN.version` is `0.31.0`
- **AND** repository URL points to `phuongvm/deskrpg-hermes-plugin`

### Requirement: Gateway Probe Authentication & Credential Scoping (DESKRPG-INV-1)
The application gateway reachability probe and profile validation SHALL use scoped profile keys for named profiles, owner keys for default profiles, and fail-closed token decryption handling.

#### Scenario: Scoped profile credentials used for probe
- **GIVEN** a named Hermes profile configured in DeskRPG
- **WHEN** the gateway probe is executed via `src/lib/hermes/gateway-probe.ts`
- **THEN** the request authenticates with the scoped profile key rather than the root owner token
- **AND** unauthenticated or malformed responses fail closed without hanging connections

### Requirement: Diagnostic HTTP Contract on Decryption Failure (DESKRPG-INV-2)
When gateway credential decryption fails, `src/app/api/gateways/[id]/test/route.ts` SHALL return HTTP 200 with `PROBE_RESULT_INIT` and specific error code, preventing socket leaks and false network unreachable errors.

#### Scenario: Decryption failure returns HTTP 200 diagnostic contract
- **GIVEN** an invalid or un-decryptable gateway token in `test/route.ts`
- **WHEN** the test endpoint is invoked
- **THEN** the response status is 200
- **AND** the payload contains `errorCode: "gateway_token_decryption_failed"`
- **AND** the response does not set `reachable: false` or leak unclosed sockets

### Requirement: Localized Gateway Error Codes (DESKRPG-INV-3)
All gateway error codes SHALL be registered in `src/lib/i18n/error-codes.ts` and translated across English (`en`), Japanese (`ja`), Korean (`ko`), and Chinese (`zh`).

#### Scenario: Gateway decryption error code localized in all 4 languages
- **GIVEN** the merged locale files in `src/lib/i18n/locales/`
- **WHEN** error code `gateway_token_decryption_failed` is looked up
- **THEN** non-empty translations exist in `en.ts`, `ja.ts`, `ko.ts`, and `zh.ts`

### Requirement: Fork Image Publication Pipeline (DESKRPG-INV-4)
The application repository SHALL include a fork release workflow `.github/workflows/release.yml` that builds and publishes container images to `ghcr.io/phuongvm/deskrpg:<tag>`, satisfying binding determination D2.

#### Scenario: Fork release workflow exists and targets ghcr.io
- **GIVEN** the candidate application commit
- **WHEN** `.github/workflows/release.yml` is inspected
- **THEN** the workflow triggers on tag pushes matching `2026.*-fork`
- **AND** the build step tags and pushes images to `ghcr.io/phuongvm/deskrpg`

### Requirement: Windows NTFS Directory Junction Fallback & Lock (PLUGIN-INV-1)
`deskrpg_plugin/worker_plugin.py` SHALL catch `OSError` / unprivileged symlink failures on Windows NTFS, fall back to directory junctions, and serialize concurrent junction creation with a per-destination lock.

#### Scenario: Unprivileged Windows environment falls back to junction
- **GIVEN** a Windows runner without unprivileged symlink rights
- **WHEN** worker plugin links workspace directories
- **THEN** symlink creation failure is caught
- **AND** a directory junction is created successfully via `_create_directory_junction`
- **AND** concurrent requests for the same target acquire a destination-specific lock

### Requirement: Atomic Envfile Write Retry & Backoff (PLUGIN-INV-2)
`deskrpg_plugin/envfile.py` SHALL implement bounded retry with exponential backoff when encountering Windows file locking errors (`EBUSY` / `PermissionError`) during `.env` file updates.

#### Scenario: Temporary file lock on Windows retries and succeeds
- **GIVEN** a temporary lock on `.env` by an external process
- **WHEN** `update_envfile` writes new environment variables
- **THEN** transient locking errors trigger bounded retry with backoff
- **AND** the write completes atomically without truncating the file

### Requirement: Single-Pass Skills Index Optimization (PLUGIN-INV-3)
`deskrpg_plugin/skills_admin.py` SHALL index available skills in a single directory pass, avoiding redundant disk traversals.

#### Scenario: Skills admin indexes skills directory efficiently
- **GIVEN** a directory with multiple Hermes skill definitions
- **WHEN** `index_skills` is invoked
- **THEN** the directory tree is scanned exactly once
- **AND** the returned metadata matches all valid skills

### Requirement: Lazy Gateway Runner Import / Deadlock Elimination (PLUGIN-INV-4)
`deskrpg_plugin/_hermes_api.py` SHALL defer importing `gateway.run` until execution time, preventing Python import lock deadlocks during gateway startup.

#### Scenario: Gateway initialization does not deadlock on plugin load
- **GIVEN** Hermes Gateway bootstrapping with DeskRPG plugin enabled
- **WHEN** the plugin module is imported
- **THEN** `gateway.run` is not imported at module top-level
- **AND** the gateway process boots without thread deadlocks

### Requirement: Hermetic Shadow E2E Probe & Contract Verification (SYNC-6)
Prior to review and publication, the candidate application and plugin builds SHALL be exercised in a shadow environment on port 3122, validating health, capability negotiation (`skill_invocation`), and gateway probe endpoints.

#### Scenario: Shadow instance passes health and probe verification
- **GIVEN** DeskRPG running on shadow port 3122 from `wt-deskrpg-sync`
- **WHEN** HTTP probes are issued to `/api/health` and `/api/gateways/[id]/profiles/probe`
- **THEN** `/api/health` returns status 200 with `{ "status": "ok" }`
- **AND** capability negotiation confirms `skill_invocation` compatibility

### Requirement: Dual-Tier Cutover Authority & Production Deployment (SYNC-7)
Live service cutover SHALL enforce dual-tier authority: Hermes Gateway restart requires explicit Commander execution (`gateway run --replace`), while NUC container deployment is executed via `docker compose pull && docker compose up -d`, per binding determination D6.

#### Scenario: Production cutover complies with dual-tier authority
- **GIVEN** approved candidate commits published to `origin/master` and images built
- **WHEN** live cutover is executed
- **THEN** live Hermes Gateway on `AGENT-4070` is replaced exclusively with Commander authorization
- **AND** NUC production container on `192.168.100.110:3102` is updated using the verified fork image
- **AND** production health probe returns 200 with zero downtime
