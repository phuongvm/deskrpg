# Reviewer Findings v5 — Apply Code Quality Re-Gate

## Verdict

**APPROVED** — the Apply code-quality gate for OpenSpec Groups 1–6 is cleared after remediation.

Finding count: **0 CRITICAL, 0 WARNING, 3 INFO**.

The exact feature verification commands in Tasks 6.1–6.6 pass independently with no warnings observed. Reviewer v4 C-01, W-01, W-02, and W-03 are resolved. This verdict does **not** claim the repository-wide `npm test` command is green: the supplemental full run remains red from broad environment/platform debt described under I-02. Assembled-system acceptance Tasks 7.1–7.6 remain unchecked and owned by downstream QA card `t_497956f2`.

## Scope

Reviewed SDLC layers:

- Specs: both active delta specs under `specs/`.
- Architecture/design: `design.md`, including Decisions 3–9 and the approved no-global-document exception in Architecture Updates.
- Implementation: `src/app/game/GamePageClient.tsx`, `room-create-dispatch.ts`, `room-state.ts`, `src/components/ChatPanel.tsx`, `src/components/rooms/RoomComposer.tsx`, and the four locale maps.
- Tests: `room-create-dispatch.test.ts`, `room-create-lifecycle.test.tsx`, its fixture/helper modules, `room-state.test.ts`, `chat-error-dispatch.test.ts`, `ChatPanel.test.tsx`, `RoomComposer.test.tsx`, and `locales.parity.test.ts`.
- Verification: exact Tasks 6.1–6.6, lint, typecheck, strict OpenSpec validation, `git diff --check`, repository `npm test` as supplemental evidence, and the server/database/migration scope guard.
- Remediation targets from Reviewer v4: normal-runner lifecycle coverage, ChatPanel warning cleanup, Tasks 5.8/5.20 assertions, and root architecture-file drift.

## Not Reviewed

- Assembled-system acceptance Tasks 7.1–7.6: intentionally delegated to QA card `t_497956f2`; fake-socket lifecycle tests are not substituted for real UI/server evidence.
- Production build and deployment behavior: outside this card’s acceptance contract.
- Server behavior beyond source/scope inspection: no server wire change was permitted or detected.
- A repository-wide defect-by-defect audit of the thousands of tests outside this change: the full command was executed and classified, but unrelated failures were not remediated by this reviewer.
- Main capability specs: no corresponding files exist under `openspec/specs/` in this checkout; alignment was evaluated against the active delta specs and approved design.

## Findings Summary

| ID | Severity | Layer | Finding |
| --- | --- | --- | --- |
| I-01 | INFO | i18n | Exact locale parity is green; fallback remains implementation-inspected rather than change-specific tested. |
| I-02 | INFO | Repository baseline | Supplemental repository-wide `npm test` remains red; no repository-wide green claim is made. |
| I-03 | INFO | Acceptance | Real assembled-system Tasks 7.1–7.6 remain open for downstream QA by design. |

## Reviewer v4 Remediation

| Prior finding | Resolution evidence | Status |
| --- | --- | --- |
| C-01 — lifecycle suite required an undeclared experimental module-mock flag | `room-create-lifecycle.test.tsx:15-34` now uses synchronous loader hooks; the exact Task 6.3 command passes 40/40 under the standard `npx tsx --test` invocation with no experimental/deprecation warning observed. | RESOLVED |
| W-01 — focused ChatPanel suite emitted 132 React `act(...)` warnings | `ChatPanel.test.tsx:68-77` unmounts all tracked roots inside `act`; the exact Task 6.2 command passes 46/46 with no warning output. | RESOLVED |
| W-02 — Tasks 5.8 and 5.20 lacked required assertions | Missing-channel GamePage preflight/toast/pending-null coverage is at `room-create-lifecycle.test.tsx:184-203`; post-unmount ref/state-null and no-toast assertions are at `room-create-lifecycle.test.tsx:307-330`. Both execute in the 40/40 Task 6.3 run. | RESOLVED |
| W-03 — unapproved root `ARCHITECTURE.md` | Root `ARCHITECTURE.md` is absent. `design.md:247-264` remains the approved architecture source under the recorded no-global-document exception. | RESOLVED |

## Specs

The implementation and tests remain consistent with the active deltas:

- Room readiness, preflight feedback, acknowledgment ownership, retry, duplicate-submit, list-refresh, and replacement-context scenarios: `specs/room-creation-availability/spec.md:3-51`.
- Colocated validation, idle selection transitions, pending precedence, helper behavior, and accessible disabled/busy styling: `specs/room-composer-validation-feedback/spec.md:3-61`.
- Strict validation passes: `npx --yes @fission-ai/openspec validate room-creation-availability-and-validation-feedback --strict` → `Change 'room-creation-availability-and-validation-feedback' is valid`, exit 0.

No normative spec contradiction was found.

## Architecture

The implementation preserves the approved ownership boundaries:

- `GamePageClient` owns mirrored pending ref/state and the socket lifecycle (`GamePageClient.tsx:478-482,729-768,857-860,1257-1290,1775-1804`).
- `ChatPanel` preserves compose state until the matching acknowledgment and forwards pending/availability (`ChatPanel.tsx:100-104,210-214,1014-1028`).
- `RoomComposer` owns draft/selection validation and accessible submit feedback (`RoomComposer.tsx:47-58,130-149`).
- The reducer preserves active compose across list refresh while retaining existing non-compose semantics (`room-state.ts:89-103`).
- Pure preflight/error decisions remain isolated in `room-create-dispatch.ts`.

No architectural drift was found. The root architecture file introduced during the earlier pass is no longer present, matching `design.md:247-264`.

## Code

No unresolved application-code correctness or maintainability defect was found in the reviewed paths.

Key invariants verified from source and executable tests:

- A single helper synchronously mirrors pending ref and React state.
- Submit preflight rejects disconnected, missing-channel, and already-pending requests without emitting.
- Only a matching `room:created.requestId` enters the room and clears pending.
- Attributed `room:error`, disconnect, connect error, replacement cleanup, Cancel, and unmount release pending according to the approved lifecycle.
- A delayed list response updates list data without unmounting the composer or discarding its draft.
- Pending UI state gates duplicate submission while preserving editable draft fields.

`git diff --check` passes.

## Tests

All exact feature gates pass:

- Task 6.1: 6/6 passed; covers idle validation, humans-only rejection, deselect-last-NPC regression, pending selection toggling, and availability hints.
- Task 6.2: 46/46 passed; create dispatch/rejection/pending/retry/duplicate retention cases pass with no focused-suite React warning output.
- Task 6.3: 40/40 passed; the lifecycle harness runs through the normal command and includes both formerly missing Task 5.8 and 5.20 cases.
- Task 6.4: 2/2 passed; all locale files have identical string key sets.
- Task 6.5: lint and typecheck both exit 0 with no reported errors or warnings.
- Task 6.6: tracked diff and untracked-file checks under `src/server`, `server`, `db`, `migrations`, and `drizzle` produce empty output.

### I-01 — INFO — i18n fallback is indirectly protected

`locales.parity.test.ts` proves exact four-locale key/value shape, and Task 6.4 passes 2/2. The client fallback (`selected locale → English → key`) was inspected previously in `src/lib/i18n/context.tsx`; no change-specific fallback case was added. Because every added key exists in all supported locale maps, this is advisory rather than a gate failure.

### I-02 — INFO — repository-wide tests remain non-green

The supplemental default-runtime `npm test` run under Node `v26.7.0` exits 1: **5,087 tests, 4,220 pass, 841 fail, 26 skipped**. Its broad failures include native addon ABI incompatibility: installed `better-sqlite3` uses `NODE_MODULE_VERSION 127`, while Node 26 requires 147 (`ERR_DLOPEN_FAILED`).

A non-mutating one-process Node 22 diagnostic confirmed `v22.23.3`, ABI 127, and `native SQLite load PASS`. Running the repository test pattern under that runtime still exits 1: **5,164 tests, 4,881 pass, 257 fail, 26 skipped**, with broad Windows/platform failures including tar path translation, path-separator expectations, symlink permissions, file-mode semantics, and SQLite teardown `EBUSY` errors. It also contains warnings in unrelated approval/timer tests.

The change-specific lifecycle cases are reached and pass in the full Node 22 log, including connected create, disconnected preflight, missing-channel preflight, and silent unmount cleanup. No failure in the modified room-create feature paths was found. Therefore this report does not convert the full-suite failure into a change-specific defect, but it also does not claim repository-wide health.

### I-03 — INFO — assembled-system acceptance remains open

`tasks.md:77-86` correctly leaves Tasks 7.1–7.6 unchecked. They require an isolated real fixture runtime, Playwright UI/server coverage, and trace/screenshot evidence. QA card `t_497956f2` remains the owner. The focused fake-socket tests prove client lifecycle behavior only.

## DevOps and Scope Guard

No files under `src/server/`, `server/`, `db/`, `migrations`, or `drizzle` are present in the tracked diff or untracked set. The reviewed implementation remains client-only and introduces no server wire or schema change.

The repository’s CI/release workflows declare Node 22, and the Dockerfile uses `node:22-bookworm-slim`; the default reviewer shell is Node 26. The runtime difference explains the native ABI class of supplemental full-suite failures but does not excuse the separate Windows/platform failures disclosed above.

## Verification Evidence

| Gate | Command | Result |
| --- | --- | --- |
| 6.1 | `npx tsx --test src/components/rooms/RoomComposer.test.tsx` | PASS: 6/6; no warnings observed |
| 6.2 | `npx tsx --test src/components/ChatPanel.test.tsx` | PASS: 46/46; no warnings observed |
| 6.3 | `npx tsx --test src/app/game/room-create-dispatch.test.ts src/app/game/room-state.test.ts src/app/game/chat-error-dispatch.test.ts src/app/game/room-create-lifecycle.test.tsx` | PASS: 40/40; no warnings observed |
| 6.4 | `npx tsx --test src/lib/i18n/locales.parity.test.ts` | PASS: 2/2; no warnings observed |
| 6.5a | `npm run lint` | PASS, exit 0; no reported warnings/errors |
| 6.5b | `npm run typecheck` | PASS, exit 0 |
| 6.6 | scoped tracked/untracked checks under server/DB/migration paths | PASS: empty output |
| OpenSpec | strict change validation | PASS, exit 0 |
| Whitespace | `git diff --check` | PASS, exit 0 |
| Checklist | programmatic parse of `tasks.md` | 64 total / 58 checked / only 7.1–7.6 unchecked |
| Repository tests, default runtime | `npm test` under Node 26 | FAIL: 4,220 pass / 841 fail / 26 skipped; no repository-wide green claim |
| Repository tests, Node 22 diagnostic | repository test pattern through `node@22` | FAIL: 4,881 pass / 257 fail / 26 skipped; feature lifecycle cases pass |

## Checklist Decision

Groups 1–6 are fully verified and correctly checked: **58/58** items.

Tasks **7.1–7.6** correctly remain unchecked for downstream assembled-system QA. Total checklist state: **64 items / 58 checked / 6 unchecked**.

No `tasks.md` edit was necessary during this re-review because the current checkbox state already matches the independently verified evidence.

## Gate Decision

Release downstream QA card `t_497956f2`. Reviewer v4 blockers are resolved, exact Tasks 6.1–6.6 are green and warning-free, scope guard is clean, and the checklist accurately separates completed client verification from pending assembled-system acceptance.

Repository-wide `npm test` remains explicitly non-green and must not be represented as a full-repository pass.