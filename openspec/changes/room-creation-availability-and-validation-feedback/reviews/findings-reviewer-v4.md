# Reviewer Findings v4 — Apply Code Quality Gate

## Verdict

**REJECTED** — the Apply code-quality gate remains closed.

Finding count: **1 CRITICAL, 3 WARNING, 2 INFO**.

The implementation is broadly aligned with the approved acknowledgment-driven design, and the focused component, reducer, dispatch, locale-parity, lint, typecheck, strict OpenSpec, and server/database scope checks are green where noted below. The gate cannot pass because the required §6.3 command and the repository test command cannot execute the new lifecycle suite without an undeclared experimental Node flag. In addition, the nominally passing ChatPanel suite emits 132 React test warnings, and two checked lifecycle tasks do not contain their required assertions.

## Scope

Reviewed SDLC layers:

- Specs: both active delta specs under `specs/`.
- Architecture/design: `design.md`, root `ARCHITECTURE.md`, and the relevant component/socket/reducer ownership boundaries.
- Implementation: `src/app/game/GamePageClient.tsx`, `room-create-dispatch.ts`, `room-state.ts`, `src/components/ChatPanel.tsx`, `src/components/rooms/RoomComposer.tsx`, and the four locale maps.
- Tests: `room-create-dispatch.test.ts`, `room-create-lifecycle.test.tsx`, `room-state.test.ts`, `chat-error-dispatch.test.ts`, `ChatPanel.test.tsx`, `RoomComposer.test.tsx`, and `locales.parity.test.ts`.
- Verification: Tasks 6.1–6.6, lint, typecheck, strict OpenSpec validation, `git diff --check`, full `npm test`, and the server/database/migration scope guard.

## Not Reviewed

- Assembled-system acceptance Tasks 7.1–7.6: intentionally delegated to downstream QA card `t_497956f2`; this review does not substitute fake-socket tests for that work.
- Production build and deployment behavior: outside this card's acceptance contract.
- Server behavior beyond contract/source and scope inspection: no server wire change was permitted or detected.
- Main capability specs: no files exist under `openspec/specs/` in this checkout; alignment was evaluated against the active delta specs.

## Findings Summary

| ID | Severity | Layer | Finding |
| --- | --- | --- | --- |
| C-01 | CRITICAL | Tests / tooling | Required lifecycle suite is not runnable by the exact §6.3 or repository `npm test` command. |
| W-01 | WARNING | Tests | ChatPanel suite passes but emits 132 React `act(...)` warnings, violating the zero-warning acceptance criterion. |
| W-02 | WARNING | Tests / traceability | Checked Tasks 5.8 and 5.20 do not contain all required lifecycle assertions. |
| W-03 | WARNING | Architecture / scope | An untracked root `ARCHITECTURE.md` now exists despite the approved no-global-document decision. |
| I-01 | INFO | i18n | Added keys have exact four-locale parity; client fallback exists but is not directly exercised for these keys. |
| I-02 | INFO | Repository baseline | Full `npm test` has broad environment/baseline failures beyond this change; no claim of repository-wide green status is supportable. |

## Specs

The implementation behavior inspected is consistent with the two delta specs:

- Readiness and acknowledgment ownership match `specs/room-creation-availability/spec.md:3-51`.
- Composer validation, pending precedence, helper behavior, and accessible disabled styling match `specs/room-composer-validation-feedback/spec.md:3-61`.
- Strict validation passes: `npx --yes @fission-ai/openspec validate room-creation-availability-and-validation-feedback --strict` → valid, exit 0.

No normative spec contradiction was found.

## Architecture

The client ownership boundaries are coherent with `design.md` Decisions 3–9: `GamePageClient` owns pending lifecycle, `ChatPanel` preserves compose state until acknowledgment, `RoomComposer` owns draft/selection UI, the reducer preserves compose during list refresh, and the pure dispatch helper owns preflight/error decisions.

### W-03 — WARNING — Root architecture document violates the recorded landing decision

**Spec/design reference:** `design.md:249-254` records an explicit no-global-document exception and says no root `ARCHITECTURE.md` is created during this phase.

**File and line:** `ARCHITECTURE.md:1-13` now exists as an untracked root file and declares itself an architecture landing/source-of-truth document.

**Description:** This is scope/documentation drift relative to the approved design. The file was not part of Groups 1–6 and is not required by the implementation tasks. Its own line 13 also calls root `ARCHITECTURE.md` a future target even though the file already exists.

**Suggested resolution:** Identify the owning task and either remove the unapproved file or revise the architecture decision through the authorized Designer/Leader process before the gate is re-run. Do not silently treat an untracked shared-workspace file as approved architecture.

## Code

The reviewed source follows existing patterns and keeps the change client-only:

- Pending ref/state writes are centralized in `GamePageClient.tsx:476-489`.
- Disconnect, error, connect-error, acknowledgment, teardown, cancel, and submit paths are handled at `GamePageClient.tsx:729-780,857-861,1252-1290,1774-1805`.
- Compose-preserving list reduction is confined to `room-state.ts:89-104`.
- The create branch no longer dispatches `showList` in `ChatPanel.tsx:1007-1026`.
- Validation and pending/availability UI state are colocated in `RoomComposer.tsx:42-57,118-153`.

`git diff --check` passes. No application-code correctness defect was found in the inspected paths.

## Tests

### C-01 — CRITICAL — Required lifecycle suite needs an undeclared experimental runner flag

**Spec/task reference:** `tasks.md:68-75`, especially Task 6.3, requires the exact `npx tsx --test ... room-create-lifecycle.test.tsx` command to pass. The card acceptance criteria also require all unit/integration tests to pass.

**File and line:** `src/app/game/room-create-lifecycle.test.tsx:4,40-68` imports `mock` and calls `mock.module(...)`; `package.json:57` runs all tests through `tsx --test` without enabling Node module mocks.

**Evidence:**

- Exact Task 6.3 command exits 1 at `room-create-lifecycle.test.tsx:40` with `TypeError: import_node_test.mock.module is not a function`.
- `npm test` reaches the same failure for the new lifecycle file and exits 1.
- A diagnostic command with an extra flag — `node --experimental-test-module-mocks --import tsx --test ...` — passes 38/38 focused tests, but emits Node experimental/deprecation warnings and a React `jsx` attribute warning. This is not the command specified by Task 6.3 or `package.json`.

**Impact:** The checked lifecycle tests are not part of the normal repository test path. CI/local `npm test` cannot execute them as authored, so Tasks 5.7–5.21 are not delivered as runnable regression coverage and §6.3 cannot be checked.

**Suggested resolution:** Make the lifecycle harness run under the repository's declared test command without hidden environment flags (preferred), or explicitly update the approved test runner contract/scripts and eliminate the experimental/deprecation warnings. Then rerun the exact §6.3 and `npm test` commands.

### W-01 — WARNING — Passing ChatPanel suite emits 132 warnings

**Task/acceptance reference:** Task 6.2 requires passing output; this card requires zero errors/warnings.

**File and line:** warnings originate from asynchronous updates exercised by `src/components/ChatPanel.test.tsx`; the command output names `ToolApprovalCard` and `ToolApprovalStack` updates not wrapped in `act(...)`.

**Evidence:** `npx tsx --test src/components/ChatPanel.test.tsx` exits 0 with 46/46 tests, but emits 128 `ToolApprovalCard` and 4 `ToolApprovalStack` `act(...)` warnings.

**Suggested resolution:** Isolate or await the asynchronous approval-card updates in the harness so the exact suite completes with zero warnings, then rerun Task 6.2.

### W-02 — WARNING — Checked lifecycle tasks lack required assertions

**Task reference:** `tasks.md:53,65` (Tasks 5.8 and 5.20).

**File and line:** `room-create-lifecycle.test.tsx:166-189,277-284`.

**Description:**

- Task 5.8 requires GamePage-level coverage for both disconnected and missing-channel rejection, including the matching localized toast and pending-null result. The lifecycle test covers disconnected only. The pure helper and ChatPanel tests cover a `missing_channel` return, but do not prove the GamePage missing-channel toast/pending behavior.
- Task 5.20 requires assertions that pending ref/state are null after unmount and that no toast was requested. The test only verifies pending was true before cleanup and that the `room:created` listener was removed afterward; it does not assert either required post-unmount condition.

**Impact:** The checklist reports behavior as verified that the executable lifecycle harness does not actually prove.

**Suggested resolution:** Add the missing GamePage-level cases/assertions, rerun the corrected suite through the standard command, and only then retain the checkmarks.

### I-01 — INFO — i18n parity is green; fallback is implementation-inspected rather than change-specific tested

`locales.parity.test.ts:1-36` proves identical key sets and string values across en/ko/ja/zh, and the exact Task 6.4 command passes 2/2 with no warnings. Client fallback is implemented in `src/lib/i18n/context.tsx:84-95` (`selected locale → English → key`). There is no direct change-specific fallback test, but parity prevents the seven added keys from reaching that fallback in any supported locale.

### I-02 — INFO — Full repository suite is not green in this environment

`npm test` exits 1: 5,075 tests discovered, 4,207 pass, 842 fail, 26 skipped. The new lifecycle failure is covered by C-01. The remaining failures are broad repository/environment issues (including native/database and Windows fixture behavior) and were not all attributed to this change. Therefore this review makes no repository-wide green claim.

## Verification Evidence

| Gate | Command | Result |
| --- | --- | --- |
| 6.1 | `npx tsx --test src/components/rooms/RoomComposer.test.tsx` | PASS: 6/6, 0 warnings observed |
| 6.2 | `npx tsx --test src/components/ChatPanel.test.tsx` | TESTS PASS 46/46; gate FAILS zero-warning criterion (132 warnings) |
| 6.3 | Exact command from `tasks.md` | FAIL: `mock.module is not a function` |
| 6.3 diagnostic | `node --experimental-test-module-mocks --import tsx --test ...` | 38/38 pass, but experimental/deprecation/React warnings |
| 6.4 | `npx tsx --test src/lib/i18n/locales.parity.test.ts` | PASS: 2/2, 0 warnings observed |
| 6.5a | `npm run lint` | PASS, exit 0 |
| 6.5b | `npm run typecheck` | PASS, exit 0 |
| 6.6 | `git status --short --untracked-files=all -- src/server server db migrations drizzle` and scoped diff | PASS: empty output |
| OpenSpec | strict validation | PASS, exit 0 |
| Whitespace | `git diff --check` | PASS, exit 0 |
| Repository tests | `npm test` | FAIL: 4,207 pass / 842 fail / 26 skipped |

## Checklist Decision

Verified and eligible to check: **6.1, 6.4, 6.5, 6.6**.

Remain unchecked: **6.2** (warning-free criterion not met), **6.3** (exact command fails), and Tasks **7.1–7.6** (downstream assembled-system QA).

Tasks **5.8 and 5.20** were returned to unchecked because their required assertions are absent. The remaining Groups 1–5 items retain their implementation checkmarks pending remediation and re-review.

## Gate Decision

Do not release the QA acceptance card yet. C-01 must be remediated and the exact §6.3/repository test path rerun. W-01 and W-02 must also be resolved to satisfy this card's explicit zero-warning and coverage criteria. After remediation, request an independent Reviewer re-gate against the same live workspace state.