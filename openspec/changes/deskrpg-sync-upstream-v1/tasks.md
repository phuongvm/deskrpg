# Tasks: deskrpg-sync-upstream-v1

## 1. Dirty-Tree Preservation (D4)

- [ ] 1.1 In `oss/deskrpg`, create dedicated branch `wip/room-creation-apply` from current `origin/master` and commit all 29 in-flight files (11 modified, 18 untracked) for OpenSpec change `room-creation-availability-and-validation-feedback`
- [ ] 1.2 In `oss/deskrpg-hermes-plugin`, create dedicated branch `wip/junction-lock-0.30.3` and commit uncommitted junction lock fixes
- [ ] 1.3 Verify both live working trees are clean (`git status --short` returns empty)

## 2. Plugin Reconciliation in Isolated Worktree (D5, PLUGIN-INV-1..4)

- [ ] 2.1 Create isolated worktree `O:/workspaces/wt-deskrpg-plugin-sync` on branch `sync/upstream-v0.31.0` from `origin/master` (`cfb7eb0`)
- [ ] 2.2 Run `git merge --no-commit upstream/master` (`8e0fede`, tag `v0.31.0`)
- [ ] 2.3 Port per-destination junction lock from `wip/junction-lock-0.30.3` into `deskrpg_plugin/worker_plugin.py` (`PLUGIN-INV-1`)
- [ ] 2.4 Verify atomic envfile write retry with exponential backoff in `deskrpg_plugin/envfile.py` (`PLUGIN-INV-2`)
- [ ] 2.5 Verify single-pass skills index optimization in `deskrpg_plugin/skills_admin.py` (`PLUGIN-INV-3`)
- [ ] 2.6 Verify lazy `gateway.run` import in `deskrpg_plugin/_hermes_api.py` (`PLUGIN-INV-4`)
- [ ] 2.7 Update `plugin.yaml` version to `0.31.0`
- [ ] 2.8 Execute plugin pytest suite in the worktree virtualenv and record test receipts
- [ ] 2.9 Commit candidate plugin commit on `sync/upstream-v0.31.0` and record candidate SHA

## 3. Application Reconciliation in Isolated Worktree (D5, DESKRPG-INV-1..5)

- [ ] 3.1 Create isolated worktree `O:/workspaces/wt-deskrpg-sync` on branch `sync/upstream-master-2026-10-02` from `origin/master` (`7d0a203d`)
- [ ] 3.2 Run `git merge --no-commit upstream/master` (`9d7c2e06`)
- [ ] 3.3 Rewrite `src/lib/hermes/setup/pin.ts` to pin the verified fork plugin candidate SHA and version `0.31.0` (`DESKRPG-INV-4`)
- [ ] 3.4 Verify scoped profile key handling and fail-closed token parsing in `src/lib/hermes/gateway-probe.ts` (`DESKRPG-INV-1`)
- [ ] 3.5 Verify HTTP 200 diagnostic contract on decryption failure in `src/app/api/gateways/[id]/test/route.ts` (`DESKRPG-INV-2`)
- [ ] 3.6 Verify error codes and 4-locale translations in `src/lib/i18n/error-codes.ts` and `src/lib/i18n/locales/` (`DESKRPG-INV-3`)
- [ ] 3.7 Add fork GitHub Action workflow `.github/workflows/release.yml` building and publishing to `ghcr.io/phuongvm/deskrpg:<tag>` (`DESKRPG-INV-5`, D2)
- [ ] 3.8 Execute `npm run typecheck`, client unit tests `npm test`, and production build `npm run build` in `wt-deskrpg-sync`
- [ ] 3.9 Commit candidate application commit on `sync/upstream-master-2026-10-02` and record candidate SHA

## 4. Integration & Hermetic Shadow Verification (SYNC-6)

- [ ] 4.1 Launch DeskRPG shadow instance on port 3122 from `wt-deskrpg-sync` with isolated test configuration
- [ ] 4.2 Probe shadow endpoints: `GET /api/health` returns status 200 `{ "status": "ok" }`
- [ ] 4.3 Probe gateway reachability and profile validation endpoints on shadow port 3122
- [ ] 4.4 Verify DeskRPG ↔ plugin capability negotiation (`skill_invocation`) against candidate plugin
- [ ] 4.5 Terminate shadow process, verify port release, and archive shadow probe receipts

## 5. Independent Review & QA Process Audit

- [ ] 5.1 Reviewer executes independent code-quality review of both candidate commits, filing `findings-reviewer-sync.md`
- [ ] 5.2 QA audits OpenSpec compliance, invariant preservation ledger, test coverage, and role boundaries, filing `findings-qa-sync.md`
- [ ] 5.3 Leader compiles Tri-Part Status Debrief (DONE, NOT DONE, BLOCKED) for Commander review

## 6. Commander Gate & Production Cutover (D1, D2, D6)

- [ ] 6.1 Present candidate SHAs, test receipts, and shadow probe evidence to Commander Phuong and obtain explicit cutover authorization
- [ ] 6.2 Fast-forward push `sync/upstream-v0.31.0` to `origin/master` in `oss/deskrpg-hermes-plugin` and tag release `v0.31.0-fork`
- [ ] 6.3 Fast-forward push `sync/upstream-master-2026-10-02` to `origin/master` in `oss/deskrpg` and tag release `2026.1004.0-fork`
- [ ] 6.4 Trigger fork `release.yml` GitHub Action to build and publish container image `ghcr.io/phuongvm/deskrpg:2026.1004.0-fork`
- [ ] 6.5 Update parent workspace submodule pointers for `oss/deskrpg` and `oss/deskrpg-hermes-plugin`
- [ ] 6.6 Update live plugin checkout at `_config/agent4070/hermes/plugins/deskrpg` to verified tag `v0.31.0-fork`
- [ ] 6.7 Coordinate with Commander Phuong to execute `gateway run --replace` on live Hermes Gateway (D6)
- [ ] 6.8 Update `docker-compose/deskrpg/docker-compose.yml` on NUC to `ghcr.io/phuongvm/deskrpg:2026.1004.0-fork` and execute `docker compose pull && docker compose up -d` (D6)
- [ ] 6.9 Post-cutover production probe: verify NUC `http://192.168.100.110:3102/api/health` returns status 200 with zero downtime
