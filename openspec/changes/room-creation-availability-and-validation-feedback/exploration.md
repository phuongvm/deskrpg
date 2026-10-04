# Exploration: Room Creation Availability and Validation Feedback

## Context & Meeting Reference
- **Source**: Meeting Minutes `ad31ede2-30af-4237-874d-3f32da441cc1`
- **User Problem**: "Why cannot I create new room? I select profiles, input room name but the button does not work?"
- **Participants**: Coder, Designer, Reviewer, Leader, QA
- **Target Repository**: `oss/deskrpg` (`src/components/rooms/RoomComposer.tsx`, `src/components/ChatPanel.tsx`, `src/app/game/GamePageClient.tsx`)

---

## 1. Problem Investigation & Codebase Analysis

### Root Cause 1: Form Validation & Spatial Disconnection in `RoomComposer.tsx`
In `src/components/rooms/RoomComposer.tsx`:
```tsx
const needNpc = mode === "create" && npcIds.size === 0;
const canSubmit = mode === "create" ? !needNpc : npcIds.size + userIds.size > 0;
```
- A new room in DeskRPG requires at least one NPC agent profile (`npcIds.size > 0`).
- If a user opens the composer, enters a room name, and selects human colleagues from the "People" (`userCandidates`) section, but does NOT select an AI agent profile from the "Staff" (`npcCandidates`) section, `canSubmit` is `false`.
- The submit button receives `disabled={!canSubmit}` with CSS `disabled:opacity-40 disabled:cursor-not-allowed`.
- The warning text `{needNpc && <p className="mt-1 text-xs text-danger">{t("room.needNpc")}</p>}` is rendered inside the "Staff" section near the top of the modal.
- Below that sits the entire "People" list.
- At the bottom of the modal sits the submit button ("Create").
- **The Gap**: Users look directly at the greyed-out or unclickable "Create" button at the bottom. Because the warning is scrolled up or separated in the Staff block, users assume the button or app is broken or dead.

### Root Cause 2: Availability Contract & Silent Bail in `GamePageClient.tsx`
In `src/app/game/GamePageClient.tsx:1749-1758`:
```tsx
const handleRoomCreate = useCallback(
  (name: string, npcIds: string[], userIds: string[]) => {
    if (!socket || !socket.connected || !channelId) return;
    const requestId = crypto.randomUUID();
    pendingCreateRef.current = requestId;
    socket.emit("room:create", { channelId, name, npcIds, userIds, requestId });
  },
  [socket, channelId],
);
```
- If the WebSocket connection is reconnecting, momentarily offline, or `channelId` is not yet bound:
  `if (!socket || !socket.connected || !channelId) return;`
- This is a **silent bail**. The user receives zero feedback, no toast notification, and no UI indication that network connectivity or channel initialization is pending.
- To the user, clicking or interacting with room creation appears to fail silently without any explanation.

---

## 2. Visual Architecture & Interaction Flow

### Current Experience (Confusing / Broken Impression)
```
┌──────────────────────────────────────────────┐
│ New Room                                     │
├──────────────────────────────────────────────┤
│ [ Room name input                          ] │
│                                              │
│ Staff                                        │
│   [ ] Sophia (AI Agent)                      │
│   [ ] Oliver (AI Agent)                      │
│   ⚠️ Pick at least one staff member  <───────┼── (High up, easily overlooked)
│                                              │
│ People                                       │
│   [x] Jane (Human Colleague - Online)        │
│   [x] Alex (Human Colleague - Online)        │
│                                              │
├──────────────────────────────────────────────┤
│ [ Cancel ]       [      Create (Disabled)  ] │ <── User looks here:
└──────────────────────────────────────────────┘     "Why is this button dead?!"
```

### Proposed Experience (Clear, Colocated Feedback & Availability)
```
┌──────────────────────────────────────────────┐
│ New Room                                     │
├──────────────────────────────────────────────┤
│ [ Room name input                          ] │
│                                              │
│ Staff                                        │
│   [ ] Sophia (AI Agent)                      │
│   [ ] Oliver (AI Agent)                      │
│                                              │
│ People                                       │
│   [x] Jane (Human Colleague - Online)        │
│   [x] Alex (Human Colleague - Online)        │
│                                              │
├──────────────────────────────────────────────┤
│ [ Cancel ]       [      Create (Disabled)  ] │
│                  ⚠️ Select at least one AI   │ <── Colocated directly under
│                     agent to create a room   │     the action button!
└──────────────────────────────────────────────┘
```

---

## 3. Comparison of Approaches

| Approach | Description | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **A: Always Enabled + Click Toast** | Keep button enabled; clicking triggers an error toast or scrolls to the missing field. | Very obvious click reaction. | Allows submitting invalid state; feels jarring if clicked multiple times. | ❌ Rejected |
| **B: Disabled Button Only (Current)** | Current implementation: disabled button with warning high up in Staff block. | Minimal code. | High confusion; users perceive button as unresponsive. | ❌ Current Broken State |
| **C: Colocated Helper + Availability Guard** | Keep button disabled with high-contrast disabled styling; display contextual helper text directly under the button explaining the exact missing prerequisite; clear helper immediately when condition met; surface toast/notice if network/channel is unavailable. | Solves root UX issue where user eyes are focused; provides clear network availability contract. | Requires minor layout adjustment in modal footer and i18n keys. | ✅ **Recommended (Consensus)** |

---

## 4. Availability Contract Specification

Room creation depends on three conditions:
1. **Form Validation**: `name.trim()` (optional/defaulted), `npcIds.size >= 1` in `create` mode, `(npcIds.size + userIds.size) >= 1` in `invite` mode.
2. **Channel Context**: Active `channelId` exists in room state.
3. **Socket Connectivity**: `socket` exists and `socket.connected === true`.

If Form Validation passes but Socket or Channel is unavailable:
- The composer or caller must not silently drop the request.
- The UI should reflect connection readiness (e.g., "Connecting..." or visible toast "Unable to create room: Connection lost. Reconnecting...").

---

## 5. Next Steps
1. Formalize `proposal.md` with new capabilities: `room-composer-validation-feedback` and `room-creation-availability`.
2. Author delta specifications in `specs/`.
3. Draft `design.md` detailing component structure and decisions.
4. Author `tasks.md` with TDD test plan and implementation steps.

---

## Appendix A — Canonical Copy & Provenance (QA v1 W-04)

- **Canonical exploration copy**: `openspec/changes/room-creation-availability-and-validation-feedback/explorations/room-creation-availability-and-validation-feedback.md` (this file). `openspec/changes/room-creation-availability-and-validation-feedback/exploration.md` is a byte-identical mirror kept for backward references; if the two ever diverge, this `explorations/` copy wins and the mirror is to be re-synchronized (verify with `diff -q`).
- **Historical authorship**: the initial exploration/scaffolding was produced under Kanban card `t_09b606f0` (run 1, profile `coder`) as an explicitly assigned task; the Leader has recorded this as an authorized assignment/role exception. Subsequent artifact ownership is Designer (`t_d5a40bc1`, `t_16888a1a`, `t_c6babad1`). Historical attribution is not rewritten here.
- **NOT VERIFIED (do not treat as receipts)**:
  - The exact template/instruction invocation used to create the initial artifacts (`openspec instructions ...` calls) — no receipt exists in the artifacts or board handoffs.
  - The original creation order of `proposal.md` → `specs/` → `design.md` → `tasks.md` — only the final files and their modification timestamps are available.
  - Independent reading of meeting `ad31ede2-30af-4237-874d-3f32da441cc1` transcript by the Designer during remediation — the meeting is cited as the stated origin of the user problem and the UX consensus; the Designer did not re-read it on 2026-10-02.
  - The "Participants" line in §Context reflects the meeting pointer as recorded in the original exploration, not a Designer-verified attendance list.

## Appendix B — Research / Source Appendix (codebase inspection, 2026-10-02, Designer)

All citations below were re-verified against the working tree at `O:/workspaces/oss/deskrpg` (`master`, HEAD `7d0a203d`) with the queries listed. Line numbers are those observed on 2026-10-02; they will shift once Apply begins.

| # | Query (exact) | File:lines | What it establishes |
| --- | --- | --- | --- |
| Q1 | `grep -n "needNpc\|canSubmit\|disabled:opacity\|aria-" src/components/rooms/RoomComposer.tsx` | `RoomComposer.tsx:43-44` (`needNpc`, `canSubmit`), `:77` (in-section `room.needNpc` warning), `:114` (`disabled={!canSubmit}`), `:122` (`disabled:opacity-40 disabled:cursor-not-allowed`) | Root Cause 1: validation gate and spatially distant warning; no `aria-*` attributes today (grep for `aria-` returned no hits in this file) |
| Q2 | `sed -n '10,50p' src/components/rooms/RoomComposer.tsx` | `RoomComposer.tsx:16-25` (props `onSubmit`/`onCancel`, `ordered()` helper), `:22-34` (component signature and local `name`/`npcIds`/`userIds` state) | The draft lives in component-local state (basis for design Decision 3's "composer keeps its draft") and the component is socket-agnostic |
| Q3 | `grep -n "handleRoomCreate\|pendingCreateRef" src/app/game/GamePageClient.tsx` + `sed -n '1745,1760p'` | `GamePageClient.tsx:478` (`pendingCreateRef` declaration), `:834-835` (ticket match on `room:created`), `:1749-1758` (`handleRoomCreate` with silent `return` at `:1751`), `:2997` (prop wiring to `ChatPanel`) | Root Cause 2: silent preflight bail; existing ticket-matching path reused by the design |
| Q4 | `grep -n "showList" src/components/ChatPanel.tsx` | `ChatPanel.tsx:1019` (`showList` dispatched right after create submit), `:1022` (Cancel → `showList`) | Reviewer v1 C-01 premature dismissal (design Context item 3) |
| Q5 | `grep -n 'case "list"' src/app/game/room-state.ts` | `room-state.ts:89` (`list` reducer branch; body `:89-103` exits compose) | Reviewer v2 C-02 basis for design Decision 8 |
| Q6 | `grep -n "async create(payload)\|socket.emit(\"room:created\"" src/server/room-socket.ts` + `sed -n '325,372p'` | `room-socket.ts:328-370` (`create` handler: `requestId` echo `:345-348`, `invalid` on empty `npcIds` `:353`, `forbidden` `:354`, `not_found` `:365`, creator-only `room:created` with ticket `:368`) | Server contract is consumed as-is (no wire change); `npcIds.length === 0` is rejected server-side, confirming the "at least one AI agent" rule |
| Q7 | `grep -n "playwright\|\"test\|better-sqlite3" package.json`; `node --version`; `ls playwright*.config.*`; `sed -n '1,45p' playwright.fixtures.config.ts`; `head -30 e2e/fixtures/server.mjs` | `package.json:57` (`test` = `tsx --test`), `:72-73` (`test:e2e`, `test:e2e:fixtures`), `:83` (`better-sqlite3` `12.8.0`), `:111` (`@playwright/test`); Node `v26.7.0`; `playwright.fixtures.config.ts:10` (allowlist `artifacts`, `kanban-card-move`, `fixture-contract`), `:29-35` (isolated `webServer` → `e2e/fixtures/server.mjs`); `server.mjs:7-10` (refuses repo `.env*`), `:11-27` (temp `DESKRPG_HOME`, `DB_TYPE=sqlite`, synthetic secrets) | Prerequisites and isolation pattern for tasks §7 (assembled-system acceptance); no existing e2e spec covers room creation |
| Q8 | `ls docs ARCHITECTURE.md` (repo root) | both: `No such file or directory` | Basis for the W-01 no-global-document exception recorded in `design.md` § Architecture Updates |

**Not performed by the Designer in this appendix**: running the application, the server test suite, Playwright, or any dependency rebuild. The `better-sqlite3` ABI mismatch (compiled 127 vs runtime 147) is cited from QA v1 I-02 / Reviewer v3 I-05, not independently reproduced here.
