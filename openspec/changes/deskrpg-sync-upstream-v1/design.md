# Design: DeskRPG and Plugin Upstream Sync v1

## Context
This design establishes the technical blueprint for synchronizing upstream `master` releases into `phuongvm/deskrpg` and `phuongvm/deskrpg-hermes-plugin` while preserving local hardening, satisfying Commander binding determinations D1–D6, and guaranteeing zero downtime on the live production environment.

### Repository Topography & Merge-Base Accounting
- **DeskRPG Application (`oss/deskrpg`)**:
  - Local HEAD: `7d0a203d1039c497fee94a93ec9fa5bba14e28e6` (`origin/master`)
  - Upstream HEAD: `9d7c2e06d31bf068ec8b7af87235655507682e68` (`upstream/master`, untagged, 10 commits ahead of `2026.929.2`)
  - Common Merge-Base: `a134b64e090fecaeec45441eaaf562c05af87a74` (= tag `2026.929.2`)
  - Simulated 3-Way Merge: `git merge-tree --write-tree a134b64e 7d0a203d 9d7c2e06` exited 0 with clean tree `3f66aeb21` and 0 conflicts.
- **DeskRPG Hermes Plugin (`oss/deskrpg-hermes-plugin`)**:
  - Local HEAD: `cfb7eb0072c5192b2101353b840b76ec4883a751` (`origin/master`)
  - Upstream HEAD: `8e0feded1749100910fdfa87397beb30c68246dc` (`upstream/master` = tag `v0.31.0`)
  - Common Merge-Base: `e27013eeb9e954eba27d46a544d8913f8b1e698e` (= tag `v0.30.3`)
  - Simulated 3-Way Merge: `git merge-tree --write-tree e27013ee cfb7eb00 8e0feded` exited 0 with clean tree `48e64c204` and 0 conflicts.

## Binding Determinations Integration (D1–D6)
1. **D1 (Deployment Model)**: Verified Fork (Model B). Upstream master is synchronized into `phuongvm/*` fork branches, tagged, and vetted before deployment. Production never runs unmanaged upstream tags.
2. **D2 (Fork Image Pipeline)**: Automated build pipeline via `.github/workflows/release.yml` on `phuongvm/deskrpg`, publishing tagged container images to `ghcr.io/phuongvm/deskrpg:<tag>`.
3. **D3 (Reconciliation Cadence)**: Tagged upstream release boundary cadence (lagging <=1 tag).
4. **D4 (Dirty-Tree Preservation)**: Uncommitted in-flight modifications in `oss/deskrpg` (29 files for `room-creation-availability-and-validation-feedback`) are committed to `wip/room-creation-apply`. Uncommitted junction lock fixes in `oss/deskrpg-hermes-plugin` are committed to `wip/junction-lock-0.30.3`.
5. **D5 (Reconciliation Order)**: Strict dependency sequencing: Plugin first (`oss/deskrpg-hermes-plugin` tagged >= `0.31.0`), then Application second (`oss/deskrpg` updating `PLUGIN_PIN` to reference the fork plugin candidate SHA).
6. **D6 (Cutover & Restart Authority)**: Dual-Tier Authority: live Hermes Gateway restart is Commander-only (`gateway run --replace`), while NUC production container cutover is executed via `docker compose pull && docker compose up -d` after Commander approval.

## Worktree Isolation Architecture
To guarantee zero contamination of live checkouts or production processes, all merges and builds occur in ephemeral git worktrees on dedicated sync branches:

| Worktree Path | Target Repo | Sync Branch | Base Commit | Isolation Guarantee |
|---|---|---|---|---|
| `O:/workspaces/wt-deskrpg-plugin-sync` | `oss/deskrpg-hermes-plugin` | `sync/upstream-v0.31.0` | `origin/master` (`cfb7eb0`) | Independent virtualenv, no impact on live plugin at `_config/agent4070/...` |
| `O:/workspaces/wt-deskrpg-sync` | `oss/deskrpg` | `sync/upstream-master-2026-10-02` | `origin/master` (`7d0a203d`) | Independent `node_modules`, shadow port 3122, no impact on NUC container |

## File Conflict Resolution & Preservation Matrix

| Component | Target File | Local Intent / Customization | Upstream State | Resolution Strategy |
|---|---|---|---|---|
| Plugin | `deskrpg_plugin/worker_plugin.py` | Windows NTFS junction fallback (`PLUGIN-INV-1`) + destination lock | Upstream symlink code unchanged | Preserve junction fallback; port per-destination lock from `wip/junction-lock-0.30.3` |
| Plugin | `deskrpg_plugin/envfile.py` | Atomic write retry & backoff on Windows (`PLUGIN-INV-2`) | Upstream unchanged | Retain local atomic write retry logic intact |
| Plugin | `deskrpg_plugin/skills_admin.py` | Single-pass directory scan optimization (`PLUGIN-INV-3`) | Upstream added skill slash invoke | Retain single-pass indexing while supporting skill slash invoke |
| Plugin | `deskrpg_plugin/_hermes_api.py` | Lazy `gateway.run` import to prevent boot deadlock (`PLUGIN-INV-4`) | Upstream unchanged | Retain lazy resolution function intact |
| Plugin | `plugin.yaml` | Version tracking | Upstream tagged `v0.31.0` | Update version to `0.31.0` |
| App | `src/lib/hermes/setup/pin.ts` | Pinned plugin repo and commit (`DESKRPG-INV-4`) | Pinned upstream `v0.31.0` | Rewrite pin to `phuongvm/deskrpg-hermes-plugin` and fork candidate commit SHA |
| App | `src/lib/hermes/gateway-probe.ts` | Scoped profile credential authentication (`DESKRPG-INV-1`) | Upstream basic probe | Retain scoped profile key handling and fail-closed token parser |
| App | `src/app/api/gateways/[id]/test/route.ts` | Diagnostic HTTP 200 contract on decryption failure (`DESKRPG-INV-2`) | Upstream returns 500 or hangs | Retain HTTP 200 diagnostic contract with error codes, preventing socket leak |
| App | `src/lib/i18n/error-codes.ts` | Localized error codes across 4 languages (`DESKRPG-INV-3`) | Upstream missing keys | Retain localization keys in `error-codes.ts` and `locales/{en,ja,ko,zh}.ts` |
| App | `.github/workflows/release.yml` | Fork container image build & publish (`DESKRPG-INV-5`, D2) | Upstream CI only | Scaffold fork release workflow targeting `ghcr.io/phuongvm/deskrpg:<tag>` |

## Invariant Preservation Ledger

| Invariant ID | File Target | Verification Command / Check |
|---|---|---|
| `PLUGIN-INV-1` | `deskrpg_plugin/worker_plugin.py` | `pytest tests/test_worker_plugin.py -k junction` in `wt-deskrpg-plugin-sync` |
| `PLUGIN-INV-2` | `deskrpg_plugin/envfile.py` | `pytest tests/test_envfile.py` in `wt-deskrpg-plugin-sync` |
| `PLUGIN-INV-3` | `deskrpg_plugin/skills_admin.py` | `pytest tests/test_skills_admin.py` in `wt-deskrpg-plugin-sync` |
| `PLUGIN-INV-4` | `deskrpg_plugin/_hermes_api.py` | AST inspection: `gateway.run` import not at module root level |
| `DESKRPG-INV-1` | `src/lib/hermes/gateway-probe.ts` | Unit tests for scoped profile credential lookup |
| `DESKRPG-INV-2` | `src/app/api/gateways/[id]/test/route.ts` | Unit tests verifying HTTP 200 return on decryption failure |
| `DESKRPG-INV-3` | `src/lib/i18n/error-codes.ts` | Typecheck and string lookup across `locales/{en,ja,ko,zh}.ts` |
| `DESKRPG-INV-4` | `src/lib/hermes/setup/pin.ts` | Static assertion that `PLUGIN_PIN.commit` equals fork plugin candidate SHA |
| `DESKRPG-INV-5` | `.github/workflows/release.yml` | Workflow YAML lint and dry-run syntax check |
| `SYNC-6` | Shadow port 3122 | Curl probe to `http://localhost:3122/api/health` and `/api/gateways/...` |

## Execution Sequence
```
Phase 1 (D4): Preserve dirty working trees -> oss/deskrpg (wip/room-creation-apply)
                                         -> oss/deskrpg-hermes-plugin (wip/junction-lock-0.30.3)
      │
Phase 2 (D5): Reconcile deskrpg-hermes-plugin in wt-deskrpg-plugin-sync
      │       Merge upstream/master (v0.31.0) -> Port junction lock -> Pytest -> Candidate Commit C_plugin
      │
Phase 3 (D5): Reconcile deskrpg in wt-deskrpg-sync
      │       Merge upstream/master -> Rewrite pin.ts to C_plugin -> Typecheck & Tests -> Candidate Commit C_app
      │
Phase 4:      Shadow E2E Probe (Port 3122) -> Verify App ↔ Plugin contract & health
      │
Phase 5:      Independent Review (reviewer) -> Process Compliance Audit (qa)
      │
Phase 6 (D6): Tri-Part Debrief -> Commander Approval Gate
      │
Phase 7 (D1, D2, D6): Fast-forward push origin/master -> Fork Image Build (ghcr.io) -> NUC cutover & Gateway reload
```

## Rollback and Recovery Plan
1. **Candidate Abandonment**: Before remote push, discarding either worktree (`git worktree remove --force`) leaves live repositories completely unaffected.
2. **Container Rollback**: If the new container image exhibits regressions on NUC, `docker-compose.yml` can be reverted to the previous image tag (`2026.929.2-fork` or upstream `:latest`) in under 30 seconds via `docker compose up -d`.
3. **Gateway Rollback**: The live plugin checkout at `_config/agent4070/hermes/plugins/deskrpg` can be immediately checked out back to `cfb7eb0` and the gateway restarted.
