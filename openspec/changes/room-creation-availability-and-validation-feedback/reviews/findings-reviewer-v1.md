# Reviewer Findings v1 — Room Creation Availability and Validation Feedback

## Verdict

**REJECTED** — the Propose-to-Apply code-quality gate is not cleared.

The artifacts correctly identify the two reported UX failure modes and pass strict OpenSpec validation, but they do not define or test the cross-component lifecycle required by their own acknowledgment and retry requirements. The current integration dismisses `RoomComposer` immediately after invoking a void callback, before dispatch acceptance or `room:created`; therefore an implementation limited to the listed tasks can still abandon user input on a disconnected/missing-channel preflight failure or a later socket/server failure.

## Findings Summary

| Severity | Count | Gate impact |
| --- | ---: | --- |
| CRITICAL | 1 | Blocks approval |
| WARNING | 1 | Must be addressed with the blocker |
| INFO | 2 | Advisory / verified facts |

## Scope

### Files and specifications reviewed

- `openspec/changes/room-creation-availability-and-validation-feedback/proposal.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/design.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/tasks.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/exploration.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/explorations/room-creation-availability-and-validation-feedback.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/specs/room-creation-availability/spec.md`
- `openspec/changes/room-creation-availability-and-validation-feedback/specs/room-composer-validation-feedback/spec.md`
- `src/components/rooms/RoomComposer.tsx`
- `src/components/rooms/RoomComposer.test.tsx`
- `src/components/ChatPanel.tsx`
- `src/components/ChatPanel.test.tsx`
- `src/app/game/GamePageClient.tsx`
- `src/app/game/room-state.ts`
- `src/app/game/room-state.test.ts`
- `src/components/SocketConnectionNotice.tsx`
- `src/server/room-socket.ts`
- `src/server/room-socket.test.ts`
- `src/lib/i18n/locales/{en,ko,ja,zh}.ts`
- `src/lib/i18n/locales.parity.test.ts`
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `ENVIRONMENT.md`, `package.json`, and `openspec/config.yaml`
- Reviewer mandate, collaboration architecture, and collaboration lessons learned.

### SDLC layers reviewed

- Specs and requirements: reviewed
- Component/application architecture: reviewed
- Existing client/server code paths: reviewed for feasibility and conflicts
- Tests and testability: reviewed; targeted baseline tests executed
- DevOps/infrastructure: not affected by this proposal

## Not Reviewed

- Full repository test suite, lint, type-check, and production build: **NOT REVIEWED** because this is a pre-coding artifact gate with no implementation delta.
- Browser/E2E behavior: **NOT REVIEWED** because no implementation exists yet.
- Database migrations and deployment configuration: **NOT REVIEWED / not applicable**; explicitly outside the proposal scope.
- Main capability specs: no files exist under this repository's `openspec/specs/`; there was no affected baseline capability spec to compare.

## Findings

### Specs / Architecture

#### C-01 — CRITICAL — The required acknowledgment/retry lifecycle is not designed or tasked

**Spec reference**

- `specs/room-creation-availability/spec.md:21-27` requires the composer to be dismissed only after the matching `room:created` acknowledgment and requires failures/network drops to allow retry without abandoning input state.

**Code evidence**

- `src/components/ChatPanel.tsx:1010-1020` calls the void `onRoomCreate(...)` callback and then immediately dispatches `showList`, clearing compose state before any acknowledgment.
- `src/app/game/GamePageClient.tsx:1749-1757` can reject dispatch before emitting, while its callback contract returns no accepted/rejected result.
- `src/app/game/GamePageClient.tsx:833-836` already has the authoritative matching-ticket acknowledgment path, and `src/app/game/room-state.ts:173-187` already enters the new room and clears compose state when `created.enter` is true. The immediate `showList` is therefore both premature and unnecessary.
- `src/app/game/GamePageClient.tsx:733-740` handles `room:error` generically, while `src/server/room-socket.ts:160-162` emits only `{ roomId, code }`; the artifacts do not define pending-create cleanup, retry state, or draft preservation for this path.

**Why this blocks approval**

The design only says to replace/augment the silent guard with a toast (`design.md:37-39`) and the task list only asks for readiness notification/prop forwarding (`tasks.md:15-19`). A Coder can complete every listed task while `ChatPanel` still dismisses the composer immediately. In that implementation, disconnected, missing-channel, server-error, and mid-flight-drop paths continue to abandon the entered name and selections, violating the normative delta spec.

**Required resolution**

Revise the design and tasks to define a single authoritative creation lifecycle across `RoomComposer` → `ChatPanel` → `GamePageClient`:

1. `ChatPanel` MUST keep `roomState.view === "compose"` and preserve the current draft after submit.
2. Only a matching `room:created` ticket MUST transition to the new room; use the existing `pendingCreateRef` and `created.enter` reducer path.
3. Disconnected socket, missing channel, `disconnect`/`connect_error`, and applicable `room:error` paths MUST display feedback while retaining retryable input.
4. Define pending-request cleanup and duplicate-submit behavior so a failed request cannot leave stale pending state or emit uncontrolled duplicates.
5. Add explicit implementation tasks for the `ChatPanel` transition change and the create lifecycle/error handling, not only prop forwarding and toast text.

### Tests

#### W-01 — WARNING — The test plan omits all availability and acknowledgment error paths

**Spec reference**

- `specs/room-creation-availability/spec.md:3-27` defines connected dispatch, disconnected/reconnecting, missing channel, matching acknowledgment, and network/error behavior.
- Reviewer mandate `code-review-mandate/spec.md:66-71` requires edge/error paths and classifies untested critical paths as a warning.

**Evidence**

- `tasks.md:21-27` schedules only three `RoomComposer` behavior tests plus the existing component/i18n commands.
- There is no task for a `ChatPanel` assertion that create submit remains in compose view until acknowledgment/failure handling completes.
- There is no task for disconnected socket, missing `channelId`, matching-ticket `room:created`, `room:error`, network drop, retry, pending cleanup, or preserved draft.
- Existing `RoomComposer.test.tsx` covers only the current local selection gate and submit payload; existing `room-state.test.ts` covers reducer entry but not the cross-component submit lifecycle.

**Required resolution**

Extend `tasks.md` with deterministic tests that prove:

- connected + channel emits exactly one `room:create` with a ticket;
- disconnected/reconnecting and missing-channel paths emit nothing and surface the correct localized notice;
- submitting does not dispatch `showList` or unmount/reset the composer before acknowledgment;
- matching `room:created` enters the new room and clears pending state;
- nonmatching acknowledgments do not enter the room;
- disconnect/application error during pending creation retains draft/selections, clears or safely replaces pending state, and permits one retry;
- repeated submit while pending follows the explicitly selected duplicate-submit policy.

### Code / Feasibility

#### I-01 — INFO — The local validation design fits existing component state

`src/components/rooms/RoomComposer.tsx:42-44` already derives `needNpc` and `canSubmit` synchronously from React state. Colocated helper rendering, explicit `aria-disabled`, and reactive clearing can be implemented without a new state machine or server change.

#### I-02 — INFO — No server wire-protocol change is needed for successful acknowledgment

`src/server/room-socket.ts:342-370` already validates and echoes the request ticket only to the creator, and the client already compares it at `GamePageClient.tsx:833-836`. The correction belongs in client lifecycle/design/test coverage, consistent with the proposal's server non-goal.

## Verification Evidence

Commands executed from `O:/workspaces/oss/deskrpg`:

1. `npx --yes @fission-ai/openspec status --change room-creation-availability-and-validation-feedback --json`
   - Result: 4/4 planning artifacts reported `done`; planning complete.
2. `npx --yes @fission-ai/openspec validate room-creation-availability-and-validation-feedback --strict`
   - Result: `Change 'room-creation-availability-and-validation-feedback' is valid` (exit 0).
3. `npx tsx --test src/components/rooms/RoomComposer.test.tsx`
   - Result: 2 tests passed, 0 failed (exit 0).
4. `npx tsx --test src/lib/i18n/locales.parity.test.ts`
   - Result: 2 tests passed, 0 failed (exit 0).
5. Targeted Git status
   - Result: the OpenSpec change directory is untracked; no tracked source/test files in the reviewed path set are modified.

Strict schema validation establishes artifact structure, not behavioral completeness. The successful baseline tests confirm current behavior only and do not cover the new availability lifecycle.

## Required Re-review Gate

Designer must revise `design.md` and `tasks.md`; revise the delta spec only if needed to make pending/error/duplicate semantics unambiguous. Then rerun strict OpenSpec validation and request Reviewer v2. Implementation may begin only after all required cross-role artifact approvals are recorded.