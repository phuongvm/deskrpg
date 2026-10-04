# Proposal: DeskRPG and Plugin Upstream Sync v1

## Why
Upstream `dandacompany/deskrpg` has advanced 10 commits beyond common merge-base `a134b64e` (`2026.929.2`), introducing skill-chip selection, UI polish, and pinning plugin version `0.31.0` (`SKILL_INVOCATION_MIN_VERSION = "0.31.0"`). Concurrently, upstream `dandacompany/deskrpg-hermes-plugin` has advanced 4 commits beyond common merge-base `e27013e` (`v0.30.3`), tagging official release `v0.31.0` with skill slash invocation.

Meanwhile, local fork `phuongvm/deskrpg` (`origin/master` at `7d0a203d`, +11 commits) maintains critical operational hardening: gateway reachability probe authentication, scoped profile credentials, fail-closed token decryption, and localized error codes (`fix-gateway-probe-auth-socket-leak`). Local fork `phuongvm/deskrpg-hermes-plugin` (`origin/master` at `cfb7eb0`, +12 commits) maintains critical Windows platform compatibility and performance optimizations: Windows NTFS directory junction fallback, per-destination junction serialization lock, atomic envfile write retry with exponential backoff, single-pass skills index, and lazy `gateway.run` import preventing loader deadlock during gateway boot.

Furthermore, Commander Phuong established binding determinations D1–D6 (`t_0b530ec7`):
- **D1 (Deployment Model)**: Model B (Verified Fork) deployment.
- **D2 (Fork Image Pipeline)**: Scaffold fork `release.yml` GitHub Action publishing to `ghcr.io/phuongvm/deskrpg:<tag>`.
- **D3 (Reconciliation Cadence)**: Per upstream release tag (lagging <=1 tag).
- **D4 (Dirty-Tree Preservation)**: Branch-and-commit WIP in-flight working trees to dedicated feature branches (`oss/deskrpg` -> `wip/room-creation-apply` preserving 29 files, `oss/deskrpg-hermes-plugin` -> `wip/junction-lock-0.30.3`).
- **D5 (Reconciliation Order)**: Plugin first (`oss/deskrpg-hermes-plugin` to fork tag >= `0.31.0`), then Application second (`oss/deskrpg` pinning to the fork plugin candidate SHA).
- **D6 (Cutover & Restart Authority)**: Dual-Tier Authority (Hermes Gateway restart: Commander-only; NUC container deployment: DevOps task for `docker compose pull && docker compose up -d`).

Reconciliation must be executed with rigorous worktree isolation, zero regression of protected invariants, zero downtime on the production NUC container, and complete traceability.

## What Changes
1. **Dirty-Tree Preservation (D4)**: Branch-and-commit in-flight working trees in `oss/deskrpg` (29 files for `room-creation-availability-and-validation-feedback`) to `wip/room-creation-apply`, and `oss/deskrpg-hermes-plugin` (junction lock fix) to `wip/junction-lock-0.30.3`.
2. **Plugin Reconciliation First (D5)**: In isolated worktree `O:/workspaces/wt-deskrpg-plugin-sync`, merge `upstream/master` (tag `v0.31.0`), port per-destination junction lock from `wip/junction-lock-0.30.3`, verify preservation of `PLUGIN-INV-1`..`4`, bump `plugin.yaml` to `0.31.0`, run tests, and capture candidate SHA.
3. **Application Reconciliation Second (D5)**: In isolated worktree `O:/workspaces/wt-deskrpg-sync`, merge `upstream/master` (`9d7c2e06`), rewrite `src/lib/hermes/setup/pin.ts` to pin the verified fork plugin candidate SHA and version `0.31.0`, verify preservation of `DESKRPG-INV-1`..`4`, scaffold fork `release.yml` container image pipeline (`DESKRPG-INV-5`, D2), and run static validation/tests/build.
4. **Hermetic Shadow E2E Verification**: Start shadow DeskRPG instance on port 3122 from `wt-deskrpg-sync`, probe `/api/health`, `/api/gateways/[id]/profiles/probe`, and skill invocation capabilities to verify the app ↔ plugin HTTP contract.
5. **Independent Review & QA Audit**: Execute independent code-quality review (`reviewer`) and process compliance audit (`qa`).
6. **Commander Authorization Gate**: Present Tri-Part Status Debrief to Commander Phuong for explicit publication and cutover authorization (D6).
7. **Publication & Zero-Downtime Deployment (D1, D2, D6)**: Fast-forward push verified branches to remote `origin/master`, trigger fork image build on GitHub Actions (`ghcr.io/phuongvm/deskrpg:<tag>`), coordinate live plugin deployment with Commander gateway replacement, and update NUC container deployment.

## Capabilities
### New Capabilities
- `deskrpg-upstream-sync-preservation`: Binding specification and verification contract for evidence-gated synchronization of upstream master releases into DeskRPG and DeskRPG Hermes Plugin forks with zero regression of local customizations and zero service downtime.
- `fork-image-pipeline`: Automated build and publication of verified fork Docker images to `ghcr.io/phuongvm/deskrpg:<tag>` via fork `release.yml` GitHub Actions workflow.

### Modified Capabilities
None. Preserves all existing system guarantees without weakening behaviors.

## Impact
- **Local Application Baseline**: `7d0a203d` (`origin/master` at `oss/deskrpg`).
- **Upstream Application Target**: `9d7c2e06` (`upstream/master`, untagged, 10 commits ahead of `2026.929.2`).
- **Application Merge-Base**: `a134b64e` (= tag `2026.929.2`).
- **Local Plugin Baseline**: `cfb7eb0` (`origin/master` at `oss/deskrpg-hermes-plugin`, live installed at `_config/agent4070/hermes/plugins/deskrpg`).
- **Upstream Plugin Target**: `8e0fede` (`upstream/master` = tag `v0.31.0`).
- **Plugin Merge-Base**: `e27013e` (= tag `v0.30.3`).
- **Affected Subsystems**: DeskRPG Next.js app (`src/lib/hermes/`, `src/app/api/gateways/`, `src/lib/i18n/`, `release.yml`), Hermes Plugin (`deskrpg_plugin/`, `tests/`), NUC Docker deployment (`docker-compose/deskrpg/`).
- **Operational Boundaries**: Production NUC container on port 3102 and live Hermes Gateway on port 9119 remain 100% untouched during reconciliation; cutover is governed exclusively by Commander authorization (D6).
