# Reviewer Findings v3 — Room Creation Availability and Validation Feedback

## Verdict

**APPROVED** — the Propose-to-Apply code-quality gate is cleared.

The second Designer remediation resolves Reviewer v2 C-02, W-02, W-03, and I-03 without changing application, server, database, or migration code. The revised proposal, design, delta specifications, and task plan now define one coherent and implementable acknowledgment-driven lifecycle, including protection against asynchronous room-list responses and socket-effect replacement.

Finding count: **0 CRITICAL, 0 WARNING, 2 INFO**.

This is approval of the OpenSpec artifacts for implementation, not a claim that the planned behavior is already implemented. All 54 implementation and verification tasks remain unchecked.

## Review Scope

Reviewed:

- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/room-creation-availability/spec.md`
- `specs/room-composer-validation-feedback/spec.md`
- Reviewer v1 and v2 reports
- Current client architecture in `RoomComposer.tsx`, `ChatPanel.tsx`, `GamePageClient.tsx`, `room-state.ts`, and `chat-error-dispatch.ts`
- Current server request-ticket and list-response paths in `src/server/room-socket.ts`
- Existing focused tests and project scripts

The review was read-only except for this report and the append-only Reviewer entry in the shared Updates Log.

## Prior Finding Resolution

| Prior finding | Status | Verifiable evidence |
| --- | --- | --- |
| C-02 — a delayed/optional list refresh can exit compose and destroy the draft | **RESOLVED** | The current risk remains observable in `room-state.ts:89-103` and `GamePageClient.tsx:810-826`. The remediation now addresses both sides: Design Decision 8 requires a compose-preserving `list` reducer and forbids `room:list` from attributed create errors (`design.md:171-190`); the delta spec requires any list response during idle or pending compose to update rooms without changing view, draft, or pending state (`specs/room-creation-availability/spec.md:37-39`); implementation task 3.11 and tests 5.15-5.18 encode the reducer and lifecycle proof (`tasks.md:30,57-60`). No stale `MAY emit` / `optionally emit` allowance remains in the artifacts. |
| W-02 — socket-effect teardown can leave pending ref/state stale | **RESOLVED** | Current teardown removes listeners before disconnect and has no pending cleanup (`GamePageClient.tsx:1228-1258`), so the finding is correctly grounded. Design Decision 9 requires synchronous ref/state cleanup before a replacement socket becomes usable and distinguishes a still-mounted context replacement from unmount (`design.md:193-210`). The delta scenario requires clearing the old ticket, preserving the draft, notifying only when UI remains, and treating a late old acknowledgment as nonmatching (`specs/room-creation-availability/spec.md:41-43`). Tasks 3.12, 5.19, and 5.20 require implementation plus replacement/unmount tests (`tasks.md:31,61-62`). |
| W-03 — proposal impact and behavior summary stale | **RESOLVED** | `proposal.md:15-18` now states acknowledgment-only exit, failure draft retention, list-refresh safety, and replacement cleanup. `proposal.md:31-46` identifies all four modified client components, the new pure dispatch module, localization impact, five test surfaces, and explicit server/database non-scope. |
| I-03 — task count metadata stale | **RESOLVED** | Current `tasks.md` contains 54 checklist entries: 54 unchecked, 0 checked. The Designer handoff and Updates Log now use the same count. |

## Contract and Architecture Trace

### 1. Validation feedback

The composer delta requires colocated helper feedback, synchronous clearing, accessible disabled semantics, and distinct enabled styling (`specs/room-composer-validation-feedback/spec.md:3-38`). Tasks 1.1-2.8 and 4.1-4.5 map these requirements to localized UI changes and executable component tests (`tasks.md:1-16,33-39`). The current component has only the existing validation behavior, so these remain legitimate Apply-phase tasks rather than hidden completed work.

### 2. Acknowledgment-driven creation

The availability delta makes a matching `room:created` ticket the only successful composer exit and preserves the local draft across rejected dispatch, nonmatching acknowledgment, server error, and connection interruption (`specs/room-creation-availability/spec.md:18-51`). Design Decisions 3-6 specify ownership, callback result shape, pending-state mirroring, duplicate-submit gating, cancel, retry, and error attribution (`design.md:50-169`).

This fits the current architecture:

- `ChatPanel.tsx:1004-1022` currently owns the premature `showList` call; task 3.10 removes only that create-branch dispatch.
- `GamePageClient.tsx:478` already owns the request-ticket ref, and `GamePageClient.tsx:833-836` already performs ticket matching; tasks 3.2-3.4 extend those existing seams rather than introducing a competing owner.
- `room-state.ts:173-187` already supports `created` with `enter: false` as a list-only update and `enter: true` as the room transition.
- `room-socket.ts:342-370` already validates and echoes the request ticket only to the creator, so the proposal requires no wire change.

### 3. List-response preservation

Decision 8 is coherent with the reducer architecture. It keeps list sorting, preferred/fallback room selection, room updates, and viewer identity refresh while conditionally preserving `view` and the same `compose` object only when `state.view === "compose"`. Existing list/room behavior remains the control path. Tests 5.15-5.18 explicitly cover non-empty and empty lists, object preservation, idle and pending compose, attributed errors, and non-compose regressions.

### 4. Replacement and unmount cleanup

Decision 9 is implementable without changing the server: the single pending setter synchronizes the ref immediately and React state for rendering; socket-effect cleanup clears it after listener detachment/disconnect and before publishing the replacement socket. A separate mounted/unmounting ref is permitted to distinguish a dependency-driven replacement from final unmount. Tests 5.19-5.20 require both outcomes, including ordering before replacement `connect`, a fresh retry ticket, late-old-ticket behavior, and no toast after unmount.

## Findings

### INFO I-04 — Current client baseline intentionally still exhibits the defects

The current implementation still immediately dispatches `showList` after `onRoomCreate` (`ChatPanel.tsx:1017-1019`), silently returns when socket/channel is unavailable (`GamePageClient.tsx:1749-1757`), exits compose on every list action (`room-state.ts:89-103`), and lacks pending cleanup in socket teardown (`GamePageClient.tsx:1228-1258`). This is expected because Apply has not started. Approval is conditioned on implementing and checking the 54 tasks, especially lifecycle tests 5.7-5.20, before any completion claim.

### INFO I-05 — Supplemental server test baseline is blocked by a local native-module ABI mismatch

`npx tsx --test src/server/room-socket.test.ts` executed 24 tests but produced 1 pass and 23 failures before behavior assertions because `better_sqlite3.node` was compiled for `NODE_MODULE_VERSION 127`, while the active Node runtime requires 147 (`ERR_DLOPEN_FAILED`). No dependency rebuild was attempted because this review is read-only and the change explicitly does not modify server behavior. The required server contract was therefore verified by source inspection at `room-socket.ts:328-370`; Apply verification should run the server suite in a dependency/runtime-compatible environment if it is used as a release gate.

## Verification Evidence

1. Strict OpenSpec validation
   - Command: `npx --yes @fission-ai/openspec validate room-creation-availability-and-validation-feedback --strict`
   - Result: `Change 'room-creation-availability-and-validation-feedback' is valid` (exit 0).

2. Focused current client baseline
   - Command: `npx tsx --test src/components/rooms/RoomComposer.test.tsx src/components/ChatPanel.test.tsx src/app/game/room-state.test.ts src/app/game/chat-error-dispatch.test.ts src/lib/i18n/locales.parity.test.ts`
   - Result: 67 tests, 67 pass, 0 fail (exit 0). Existing React `act(...)` warnings were emitted but did not fail the suite.

3. Type checking
   - Command: `npm run typecheck`
   - Result: `tsc --noEmit` completed with exit 0.

4. Lint
   - Command: `npm run lint`
   - Result: `eslint` completed with exit 0.

5. Supplemental server baseline
   - Command: `npx tsx --test src/server/room-socket.test.ts`
   - Result: 24 tests, 1 pass, 23 environment failures; all 23 failures report the same `better-sqlite3` ABI mismatch (127 compiled versus 147 required). Not treated as an artifact defect.

6. Scope guard
   - Command: `git status --short -- src server db drizzle migrations`
   - Result: empty; no application, server, database, or migration delta.

7. Checklist count
   - Result: 54 total, 54 unchecked, 0 checked.

8. Stale refresh allowance scan
   - Search: `MAY emit|optionally emit` across the active change artifacts.
   - Result: 0 matches.

## Gate Decision

The OpenSpec artifacts are correct, complete enough to implement, internally coherent, and scoped to the reported room-creation UX failure. Reviewer approval clears the code-quality proposal gate. Coder may begin Apply only against the current 54-task plan; this report does not authorize skipping QA, implementation tests, or final Human Principal acceptance.