## Why

In DeskRPG, users attempting to create a new room frequently report that the "Create" button appears dead or unresponsive after inputting a room name and selecting human participants. Root cause analysis reveals two decoupled failure modes:

1. **Spatial Validation Feedback Disconnection**: Creating a room requires selecting at least one AI agent (NPC). When users select only human colleagues or enter a room name without checking an agent, the submit button is disabled. However, the existing validation hint (`room.needNpc`) is rendered high up in the Staff section, while user attention is focused on the bottom action button. The disabled button offers no adjacent helper explanation, giving users the false impression of a broken UI or frozen app.
2. **Silent Failure in Room Creation Dispatch**: In `GamePageClient.tsx`, room creation requests silently return if the WebSocket is reconnecting or `channelId` is absent (`if (!socket || !socket.connected || !channelId) return;`), providing zero feedback or error notification to the user.

Addressing this now eliminates user drop-off and support escalations during room setup.

## What Changes

- **Colocated Validation Feedback**: Introduce real-time, actionable helper feedback positioned directly beneath the submission button in `RoomComposer`. When creation is blocked by an unmet requirement (e.g., missing AI agent selection in `create` mode, or empty selection in `invite` mode), the button remains disabled with high-contrast disabled styling and displays an unambiguous, localized explanatory message.
- **Immediate State Clearing**: As soon as the user checks an AI agent, the button-adjacent validation helper immediately clears and the submit button transitions to its active, enabled state.
- **Availability Contract Enforcement**: Establish a clear availability contract for room creation between the UI composer and the network client. When room creation is unavailable due to socket disconnection or uninitialized channel context, the composer reflects connection readiness, and any failed dispatch surfaces a user-visible notification rather than failing silently.
- **Acknowledgment-Driven Create Lifecycle** (Reviewer v1 C-01): The composer is dismissed **only** by a `room:created` acknowledgment whose request ticket matches the pending request. `ChatPanel` no longer navigates to the list immediately after submitting; `onRoomCreate` returns an explicit accepted/rejected result; `GamePageClient` owns a single pending-request state (ref + mirrored React state). While a request is pending the submit button is busy/disabled, Cancel stays available, and a second submit is neither dispatched nor allowed to replace the ticket.
- **Draft Retention on Every Failure Path**: Preflight rejection (offline / no channel), a server `room:error` attributed to the pending request, a `disconnect`/`connect_error`, or a socket-context replacement all clear the pending request, show a localized notice, and leave the composer mounted with its name and selections intact so the user can retry with a new ticket.
- **List Refresh Never Exits Compose** (Reviewer v2 C-02): A `room:list-response` arriving while the composer is displayed — from reconnect, player-state acknowledgment, or initial load — updates the known rooms but does not change the view or unmount the composer; the attributed create-error path does not request a list refresh.
- **Pending Cleanup on Socket Replacement** (Reviewer v2 W-02): Tearing down and recreating the socket (channel-context change) clears the pending request before the replacement socket is usable and, if the composer is still displayed, shows the interrupted notice.

## Capabilities

### New Capabilities
- `room-composer-validation-feedback`: Contextual, colocated validation feedback and helper messaging directly coupled to the submit button in RoomComposer, ensuring users understand submission blockers.
- `room-creation-availability`: Contract and readiness lifecycle for room creation — socket connected, active channel, explicit dispatch failure notification, composer retained until a matching acknowledgment, non-matching acknowledgment handling, failure/drop/replacement cleanup with retry, duplicate-submit and cancel-while-pending policy, and list-refresh safety while composing.

### Modified Capabilities
<!-- None: No existing specifications in openspec/specs/ are being altered. -->

## Impact

- **Components**:
  - `src/components/rooms/RoomComposer.tsx`: Footer layout adjustment to include button-adjacent helper text, enhanced disabled state (`aria-disabled`), new optional `pending` / `availability` props (busy submit with `aria-busy` + pending label, non-blocking availability hint).
  - `src/components/ChatPanel.tsx`: `onRoomCreate` returns a dispatch result; the create branch of the compose submit no longer dispatches `showList`; forwards `roomCreatePending` / `roomCreateAvailability` to `RoomComposer`.
  - `src/app/game/GamePageClient.tsx`: `handleRoomCreate` returns the dispatch result and notifies on disconnected socket or missing channel instead of a silent bailout; mirrored `pendingCreate` state; `room:created` / `room:error` / `disconnect` / `connect_error` handlers apply the lifecycle (no `room:list` emission from the attributed error path); socket-effect cleanup clears pending and notifies when still mounted; Cancel while pending clears pending.
  - `src/app/game/room-state.ts`: `list` reducer action becomes compose-preserving (keeps `view: "compose"` and `compose` while composing; unchanged for other views).
- **New module**:
  - `src/app/game/room-create-dispatch.ts`: pure `RoomCreateDispatch` type, preflight decision (`decideRoomCreate`), and `room:error` attribution (`decideCreateError`).
- **Localization**:
  - `src/lib/i18n/locales/en.ts`, `ko.ts`, `ja.ts`, `zh.ts`: New translation keys for the button-colocated validation hints (`room.needNpcHelper`, `room.needParticipantHelper`) and the create lifecycle (`room.create.offline`, `room.create.noChannel`, `room.create.pending`, `room.create.failed`, `room.create.interrupted`).
- **Tests**:
  - `src/components/rooms/RoomComposer.test.tsx`: colocated helper rendering, disabled styling, reactive clearing, pending/busy state, availability hint.
  - `src/components/ChatPanel.test.tsx`: connected dispatch without `showList`, rejected dispatch retention, pending retention/retry, duplicate submit gating.
  - `src/app/game/room-create-dispatch.test.ts` (new): preflight precedence and error attribution.
  - `src/app/game/room-state.test.ts`: `created(enter:false)` from compose, compose-preserving `list`, and list/room-view regression.
  - `src/app/game/room-create-lifecycle.test.tsx` (new, or an equivalent `GamePageClient` harness with a fake socket): emit/ticket, rejection toasts, matching/non-matching acknowledgment, error/drop cleanup, retry with new ticket, cancel while pending, delayed `room:list-response` while composing, no-refresh on attributed error, socket-effect replacement and unmount cleanup, selection toggling while pending.
  - `e2e/room-create.spec.ts` (new, Playwright, isolated fixture server only — tasks §7): assembled-system acceptance of retained draft on server rejection and successful `room:created` acknowledgment; gated on an authorized runtime where `better-sqlite3` loads (QA v1 I-02 ABI mismatch).
- **Not changed**: server wire protocol (`src/server/`), database schema/migrations, `room:error` payload shape.
