# Reviewer E2E Harness Audit

- **Task**: `t_b33378e9`
- **Candidate**: dirty DeskRPG workspace at HEAD `7d0a203d` plus the untracked Task 7.3 harness
- **Reviewed**: 2026-10-03 (Asia/Ho_Chi_Minh)
- **Verdict**: **REJECTED**

## Finding Summary

| Severity | Count | Gate impact |
| --- | ---: | --- |
| CRITICAL | 1 | Blocks approval |
| WARNING | 1 | Must be remediated with the blocker |
| INFO | 3 | Evidence / residual scope |

## Scope

### Specifications and architecture reviewed

- `openspec/changes/room-creation-availability-and-validation-feedback/specs/room-creation-availability/spec.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/specs/room-composer-validation-feedback/spec.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/design.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/tasks.md`
- Project architecture authority: `design.md` Decisions 3–9 and Architecture Updates A1–A6. The repository has an approved no-global-`ARCHITECTURE.md` exception (`design.md:247-269`).

### Code, harness, and configuration reviewed

- `e2e/room-create.spec.ts`
- `e2e/fixtures/room-server.mjs`
- `playwright.room.config.ts`
- Relevant assembled paths: `src/server/room-socket.ts`, `src/app/api/npcs/route.ts`, `src/lib/hermes/gateway-probe.ts`, `src/components/ChatPanel.tsx`, and `src/components/rooms/RoomHeader.tsx`
- Workspace status and scope guards for `src/server/`, `server/`, `db/`, `drizzle/`, and `migrations/`
- Successful trace and screenshot artifacts under `.artifacts/room-fixtures/test-results/`

### SDLC layers evaluated

- Specs: scenario-to-assertion traceability
- Architecture: acknowledgment-driven entry and fixture isolation
- Code/tests: behavioral assertions, WebSocket interception, synthetic auth, DB seeding, cleanup
- DevOps/config: Node ABI, Playwright trace policy, fixed ports, artifact retention
- Security/isolation: credential boundary, loopback gateway, throwaway home/database, production-call exclusion

## Findings

### C-01 — The success scenario does not assert room entry

- **Severity**: CRITICAL
- **Spec reference**: `room-creation-availability/spec.md:25-27`; `tasks.md:85`; architecture sequence at `design.md:114-117`
- **Code evidence**: `e2e/room-create.spec.ts:128-131`
- **Related UI evidence**: `src/components/ChatPanel.tsx:608-628`; `src/components/rooms/RoomHeader.tsx:60-90`

The success test verifies a matching `room:created` frame, verifies only that the composer input disappears, then immediately clicks the room-list button and checks list presence. It never asserts that the client transitioned to `view: "room"` for the newly created room before reopening the list. `expect(fixture.name).not.toBeVisible()` proves composer dismissal, not the required room-entry state.

This leaves a regression undetected if a matching acknowledgment incorrectly dismisses the composer into list/another view while still adding the created room to the list. The run screenshot happens to show the accepted room as active, but a screenshot observed after a passing run is not an executable regression assertion.

**Required resolution**: Before clicking the room-list control, assert an unambiguous entered-room UI invariant for `E2E Accepted Room`—for example the `RoomHeader` room name plus a room-only control/input—and only then reopen the list and assert exactly one list entry. Re-run the Node 22 acceptance suite and retain new successful traces/screenshots.

### W-01 — Two new harness files fail the repository formatting gate

- **Severity**: WARNING
- **Files**: `e2e/room-create.spec.ts`, `e2e/fixtures/room-server.mjs`
- **Evidence command**:
  - `C:/Users/phuong/AppData/Local/nvm/v22.22.0/node.exe node_modules/prettier/bin/prettier.cjs --check e2e/room-create.spec.ts e2e/fixtures/room-server.mjs playwright.room.config.ts`
- **Actual result**: exit 1; Prettier reported both files above as having code-style issues. `playwright.room.config.ts` passed.

The files are functionally lint-clean, but they are not consistent with the repository's declared `format:check` policy (`package.json:63`).

**Required resolution**: Format only the two harness files, verify the three Task 7.3 files with `prettier --check`, then rerun lint, typecheck, and Playwright. No application or server logic changes are required for this finding.

## Verified Information

### I-01 — Fresh assembled-system run passes under the authorized ABI

The shell's default `node` remained v26.7.0/ABI 147 and correctly reproduced `ERR_DLOPEN_FAILED` against the ABI-127 native module. No rebuild was performed. The authorized executable was then invoked directly:

```text
C:/Users/phuong/AppData/Local/nvm/v22.22.0/node.exe -v
→ v22.22.0
... -p 'process.versions.modules'
→ 127
... -e 'const D=require("better-sqlite3"); new D(":memory:").close(); console.log("native SQLite load PASS")'
→ native SQLite load PASS
... node_modules/@playwright/test/cli.js test --config=playwright.room.config.ts --reporter=line
→ 2 passed (24.5s), exit 0
```

The scenarios exercised humans-only no-emit, real-server rejection and retained draft/selections, pending release, fresh retry ticket, delayed acknowledgment, duplicate-submit single emit, matching request ticket, composer dismissal, and list presence.

### I-02 — Trace retention and fixture isolation are correctly configured

- `playwright.room.config.ts:25-26` explicitly sets `trace: "on"` and `screenshot: "on"`.
- Fresh run artifacts contain two successful traces and two successful screenshots:
  - rejection/retry trace: 1,332,884 bytes, SHA-256 `4ea7ba94aea3d22195704c96e0838710eacc7745645ee09e7617e169460c8f72`
  - success trace: 1,099,694 bytes, SHA-256 `94aa3ee249b1cbf183809f7506f346d8e925b4d216258396da2e72d76ca2c3ab`
- `e2e/fixtures/room-server.mjs:14-29` creates a temporary directory, assigns it as `HOME` and `DESKRPG_HOME`, points SQLite to `<temporary>/fixture.db`, and supplies synthetic JWT/internal secrets.
- `e2e/fixtures/room-server.mjs:50-61` binds the fake gateway only on `127.0.0.1`; its behavior matches the production gateway classifier in `src/lib/hermes/gateway-probe.ts:50-68`. No real Hermes/NPC-turn call is made.
- `e2e/fixtures/room-server.mjs:62-76` seeds only the disposable SQLite database with the channel, human users, characters, membership, gateway binding, profile, and NPC required by the real roster and socket paths.

### I-03 — Static gates and scope guard pass

- Typecheck: Node 22 `tsc --noEmit` → exit 0.
- Full ESLint: Node 22 `eslint .` → exit 0.
- Focused ESLint for all three harness/config files → exit 0.
- Strict OpenSpec validation → `Change 'room-creation-availability-and-validation-feedback' is valid`, exit 0.
- `git diff --check` and staged diff check → exit 0.
- `git status`/`git diff`/staged diff restricted to `src/server server db migrations drizzle` → no output; zero server-wire, server-logic, database-schema, or migration modifications detected.

## Not Reviewed

- Groups 1–6 application implementation was not re-reviewed; it remains covered by `reviews/findings-reviewer-v5.md`.
- Tasks 7.1, 7.2, and 7.4–7.6 were not marked complete. QA retains ownership of final assembled acceptance evidence and task synchronization.
- No production database, real Hermes gateway, NPC turn, deployment, service restart, commit, push, spec sync, or archive operation was performed.
- Cross-browser execution was not reviewed; the dedicated config intentionally runs Chromium only.

## Final Verdict

**REJECTED**. The fixture architecture, isolation, trace-on-success policy, scope guard, and fresh Node 22 execution are sound, but Task 7.5's mandatory room-entry transition is not protected by an executable assertion. C-01 and W-01 require Coder remediation followed by a focused Reviewer re-review.