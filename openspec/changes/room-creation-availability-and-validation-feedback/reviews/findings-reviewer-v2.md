# Reviewer Findings v2 — Room Creation Availability and Validation Feedback

## Verdict

**REJECTED** — the Propose-to-Apply code-quality gate remains closed.

Reviewer v1 C-01 and W-01 are substantially resolved: the revised design removes `ChatPanel`'s immediate `showList`, makes matching `room:created` the intended success exit, defines pending/error/cancel/duplicate-submit behavior, and expands the implementation/test plan. However, one newly exposed critical contradiction still allows a permitted failure path to unmount the composer and discard its local draft. A separate cleanup omission can leave mirrored pending state stale when the socket effect is recreated.

## Findings Summary

| Severity | Count | Gate impact |
| --- | ---: | --- |
| CRITICAL | 1 | Blocks approval |
| WARNING | 2 | Must be addressed before Reviewer v3 |
| INFO | 3 | Verified facts / coordination note |

## Scope

### Files and specifications reviewed

- `openspec/changes/room-creation-availability-and-validation-feedback/proposal.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/design.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/tasks.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/specs/room-creation-availability/spec.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/specs/room-composer-validation-feedback/spec.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/reviews/findings-reviewer-v1.md`
- `src/components/rooms/RoomComposer.tsx`
- `src/components/rooms/RoomComposer.test.tsx`
- `src/components/ChatPanel.tsx`
- `src/components/ChatPanel.test.tsx`
- `src/app/game/GamePageClient.tsx`
- `src/app/game/room-state.ts`
- `src/app/game/room-state.test.ts`
- `src/app/game/chat-error-dispatch.ts`
- `src/server/room-socket.ts`
- `src/server/room-socket.test.ts`
- `src/lib/i18n/context.tsx`
- `src/lib/i18n/locales.parity.test.ts`
- `package.json` and `README.md`
- Reviewer mandate, collaboration architecture, collaboration lessons learned, and `agent_share.md`

### SDLC layers reviewed

- Specs and requirements: reviewed
- Component/application architecture and revised lifecycle: reviewed
- Existing client/server feasibility paths: reviewed
- Test plan and baseline tests: reviewed; targeted checks executed
- DevOps/infrastructure: not affected

## Not Reviewed

- Browser/E2E behavior: **NOT REVIEWED** because implementation has not begun.
- Production build and complete repository test suite: **NOT REVIEWED** because this remains a pre-coding artifact gate.
- Database migrations and deployment configuration: **NOT REVIEWED / not applicable**; explicitly outside scope.
- Main capability specs: **NOT REVIEWED / unavailable**; this repository currently has no files under `openspec/specs/`.
- Project-specific `ARCHITECTURE.md`: **NOT REVIEWED / unavailable**; no such file exists in the DeskRPG repository. Alignment was evaluated against the active `design.md`, surrounding source, server contract, and repository README.

## Resolution Status from Reviewer v1

| Prior finding | Status | Evidence |
| --- | --- | --- |
| C-01 — acknowledgment/retry lifecycle absent | **PARTIALLY RESOLVED** | `design.md:44-155` defines the lifecycle; `tasks.md:18-29` tasks implementation. The immediate create-branch `showList` is explicitly removed, but C-02 below identifies a remaining list-response exit. |
| W-01 — lifecycle/error tests absent | **RESOLVED, subject to C-02/W-02 additions** | `tasks.md:31-54` adds deterministic composer, dispatch, acknowledgment, error/drop, retry, duplicate, cancel, and reducer coverage. |

## Findings

### Specs / Architecture

#### C-02 — CRITICAL — The permitted error refresh re-enters the list reducer and destroys the draft

**Spec reference**

- `specs/room-creation-availability/spec.md:21-35` requires the composer and entered values to survive until matching acknowledgment or failure, and requires a failure/drop to leave the composer displayed for retry.
- `design.md:44-47,68-82` declares matching `room:created` as the only successful compose exit.

**Artifact and code evidence**

- `design.md:142` and `tasks.md:24` explicitly permit the pending-create `room:error` path to emit `room:list` for refresh.
- The existing `room:list-response` handler dispatches the reducer's `list` action (`src/app/game/GamePageClient.tsx:810-826`).
- The `list` reducer unconditionally chooses `view: "room"` or `view: "list"` and sets `compose: undefined` (`src/app/game/room-state.ts:89-103`). Because `RoomComposer` owns the entered name and selections locally, this unmounts it and loses the draft.
- `room:list` can also be emitted independently on socket connect, `player:spawn`, and socket initialization (`src/app/game/GamePageClient.tsx:695-702,705-712,758-762,1222-1225`), so a delayed list response is an existing asynchronous exit that the proposed lifecycle does not guard.

**Why this blocks approval**

A Coder can follow Task 3.5 exactly, choose the expressly allowed refresh, clear pending, receive `room:list-response`, and immediately violate the normative retry contract. This is the same abandoned-input class as Reviewer v1 C-01, reached through a different reducer action. The design's statement that matching `room:created` is the only success exit is therefore not enforced by its own tasks.

**Required resolution**

Choose and specify one deterministic policy:

1. Preferably prohibit `room:list` emission from the attributed create-error path and guard delayed `room:list-response` while the create composer is active; or
2. Change list-response reduction so an active create composer and its mounted local draft are preserved.

Add deterministic tests proving that an attributed `room:error` and a delayed `room:list-response` during compose/pending cannot change `view` away from `compose`, clear `compose`, or reset the name/selections.

#### W-02 — WARNING — Socket-effect teardown can leave pending ref/state stale

**Spec reference**

- `specs/room-creation-availability/spec.md:33-35` requires a connection drop during creation to clear pending and permit retry.
- `design.md:22-23,133-145` states that pending never outlives the request and that drop paths return to retryable idle.

**Evidence**

- Task 3.6 covers only `disconnect` and `connect_error` event handlers (`tasks.md:25`).
- The current socket-effect cleanup first removes listeners and only then calls `disconnect`; its own comment records that the disconnect handler does not run (`src/app/game/GamePageClient.tsx:1228-1258`).
- The effect is recreated when `channelId` or `t` changes (`src/app/game/GamePageClient.tsx:1260`), so a teardown can occur while the page component remains mounted. The revised tasks do not require clearing both `pendingCreateRef` and mirrored React pending state in this path.

**Consequence**

The new socket can connect while `pendingCreate` still marks the old, unreachable ticket in flight. The UI remains busy/disabled and callback-level duplicate protection rejects new submissions until the user cancels, contrary to the retry contract.

**Required resolution**

Add an explicit effect-teardown/channel-context cleanup task and test. The cleanup must keep ref and state synchronized and ensure an old ticket cannot block submission on the replacement socket. Define whether a still-mounted composer receives the interrupted notice.

#### W-03 — WARNING — Proposal impact and behavior summary were not synchronized with the revised lifecycle

**Evidence**

- `proposal.md:10-14` describes validation and generic availability feedback but does not state the now-central acknowledgment-only compose exit, draft retention, pending/duplicate-submit, cancel, or retry behavior.
- `proposal.md:25-34` lists three modified components and only `RoomComposer.test.tsx`; the revised plan adds a new dispatch module plus `ChatPanel`, lifecycle, reducer, and dispatch tests (`tasks.md:18-54`).

**Consequence**

The proposal no longer accurately summarizes the behavioral scope and affected test surface approved downstream in design/spec/tasks, weakening artifact traceability.

**Required resolution**

Synchronize the proposal's What Changes and Impact sections with the fixed lifecycle and actual planned files/tests. This is documentation-only; do not broaden implementation scope.

### Code / Feasibility

#### I-01 — INFO — The core acknowledgment design is compatible with current code

The creator-only request ticket is already echoed by the server (`src/server/room-socket.ts:342-370`), the client already compares it through `pendingCreateRef` (`src/app/game/GamePageClient.tsx:833-836`), and `created.enter=false` already preserves the current reducer view (`src/app/game/room-state.ts:173-187`). No server wire or schema change is required.

#### I-02 — INFO — Baseline client checks remain green

Strict OpenSpec validation, the targeted 67-test baseline, type-check, and lint all exit successfully. The targeted React suite emits pre-existing `act(...)` warnings but has zero failures. These checks establish baseline health only; they do not validate unimplemented behavior.

#### I-03 — INFO — Dashboard task-count metadata is stale

The Designer handoff and `agent_share.md` say the revised checklist contains 40 tasks, while the current `tasks.md` contains 46 unchecked checklist entries. This does not change the technical verdict, but Kanban/dashboard metadata should use the on-disk count.

## Verification Evidence

Commands executed from `O:/workspaces/oss/deskrpg`:

1. `npx --yes @fission-ai/openspec status --change room-creation-availability-and-validation-feedback --json`
   - Result: proposal/specs/design/tasks all `done`; planning complete.
2. `npx --yes @fission-ai/openspec validate room-creation-availability-and-validation-feedback --strict`
   - Result: `Change 'room-creation-availability-and-validation-feedback' is valid` (exit 0).
3. `npx tsx --test src/components/rooms/RoomComposer.test.tsx src/components/ChatPanel.test.tsx src/app/game/room-state.test.ts src/app/game/chat-error-dispatch.test.ts src/lib/i18n/locales.parity.test.ts`
   - Result: 67 passed, 0 failed, exit 0; React `act(...)` warnings observed.
4. `npm run typecheck`
   - Result: `tsc --noEmit`, exit 0.
5. `npm run lint`
   - Result: `eslint`, exit 0.
6. Targeted scope check: `git status --short -- src server db drizzle` and `git diff --stat -- src server db drizzle`
   - Result: no source/server/database/migration modifications in this proposal-only change.
7. Checklist count from current `tasks.md`
   - Result: 46 total, 46 unchecked, 0 checked.

## Required Re-review Gate

Designer must remediate C-02, W-02, and W-03 in proposal/design/spec/tasks as applicable, rerun strict OpenSpec validation, and request Reviewer v3. No application source changes are authorized or required for this remediation. Reviewer approval is required before Apply begins.
