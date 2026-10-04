## ADDED Requirements

### Requirement: Colocated Submit Button Helper Feedback
The `RoomComposer` component SHALL render contextual, inline helper feedback positioned directly adjacent to or beneath the primary submission button whenever submission criteria are not satisfied.

#### Scenario: Create mode with zero AI agents selected
- **WHEN** `RoomComposer` is rendered in `create` mode and no AI agent profile (`npcIds.size === 0`) is checked
- **THEN** the submit button SHALL be disabled, and an inline helper message ("Select at least one AI agent to create a room" or localized equivalent) SHALL be rendered directly beneath or adjacent to the submit button.

#### Scenario: Create mode with human colleagues selected but zero AI agents selected
- **WHEN** `RoomComposer` is rendered in `create` mode with one or more human users selected (`userIds.size > 0`) and a room name entered, but zero AI agent profiles selected (`npcIds.size === 0`)
- **THEN** submission readiness SHALL remain unsatisfied (`canSubmit === false`), the submit button SHALL remain disabled with `aria-disabled="true"`, the colocated helper message SHALL explicitly explain that at least one AI agent is required, and activating the submit button SHALL NOT invoke the submit callback.

#### Scenario: Invite mode with zero candidates selected
- **WHEN** `RoomComposer` is rendered in `invite` mode and neither AI agents nor users are checked (`npcIds.size === 0` and `userIds.size === 0`)
- **THEN** the submit button SHALL be disabled, and the colocated helper message SHALL indicate that at least one participant must be selected.

### Requirement: Immediate Real-Time Error Clearing
The `RoomComposer` component SHALL reactively and synchronously evaluate submission readiness upon any candidate selection change. Selection-based readiness SHALL enable the submit button only while no room creation request is pending (`pending === false`); the pending submission gate (see "Pending Request Precedence") takes precedence over selection-based readiness. The helper message SHALL be evaluated from the selection state alone, independently of the pending gate.

#### Scenario: User selects an AI agent profile while idle
- **WHEN** the user checks an AI agent checkbox in `create` mode and no room creation request is pending (`pending === false`)
- **THEN** the button-adjacent validation helper message SHALL immediately disappear and the submit button SHALL transition to enabled (`disabled` attribute absent, `aria-disabled="false"`).

#### Scenario: User deselects all AI agent profiles while idle
- **WHEN** the user unchecks the last selected AI agent in `create` mode while no room creation request is pending, so that `npcIds.size` returns to `0`
- **THEN** the submit button SHALL immediately transition back to disabled (`disabled` attribute present, `aria-disabled="true"`) and the button-adjacent need-AI-agent helper message SHALL immediately reappear with the same content as the initial empty-selection state; any previously selected human users SHALL remain checked.

#### Scenario: Helper reflects selection while a request is pending
- **WHEN** a room creation request is pending (`pending === true`) and the user changes the AI agent selection (checks or unchecks an agent)
- **THEN** the button-adjacent helper message SHALL still appear or disappear according to the current selection only, exactly as it would while idle, while the submit button remains governed by the pending submission gate.

### Requirement: Pending Request Precedence
While a room creation request is pending (`pending === true`), the `RoomComposer` submit button SHALL remain disabled and busy regardless of selection-based readiness, and SHALL reject duplicate submissions.

#### Scenario: Valid selection while a request is pending
- **WHEN** `pending === true` and the selection satisfies submission criteria (`canSubmit === true` from the selection state)
- **THEN** the submit button SHALL have the HTML `disabled` attribute, `aria-disabled="true"`, and `aria-busy="true"`, SHALL show the pending label, and activating it SHALL NOT invoke the submit callback; the Cancel button SHALL remain enabled.

#### Scenario: Selection toggled while a request is pending
- **WHEN** `pending === true` and the user unchecks and re-checks an AI agent (or checks an additional agent)
- **THEN** the submit button SHALL stay disabled and busy throughout, SHALL NOT transition to enabled on any intermediate selection, no submit callback SHALL be invoked, and the entered name and selections SHALL be preserved.

#### Scenario: Pending gate released
- **WHEN** `pending` transitions from `true` to `false` (failure or interruption outcome) while the selection satisfies submission criteria
- **THEN** the submit button SHALL transition to enabled (`disabled` attribute absent, `aria-disabled="false"`, `aria-busy` absent or `"false"`) with the entered name and selections unchanged, so the user can retry.

### Requirement: High-Contrast Disabled Visual Treatment
The primary submission button in `RoomComposer` SHALL convey an unambiguous, high-contrast disabled state with accessible semantics when submission criteria are not met or a request is pending.

#### Scenario: Submit button disabled styling while idle
- **WHEN** no request is pending (`pending === false`) and submission criteria are not met (`canSubmit === false`)
- **THEN** the button SHALL have the HTML `disabled` attribute, `aria-disabled="true"`, and visual styling distinct from active/clickable buttons (opacity reduction and `cursor-not-allowed`), and SHALL NOT have `aria-busy="true"`.

#### Scenario: Submit button enabled styling while idle
- **WHEN** no request is pending (`pending === false`) and submission criteria are met (`canSubmit === true`)
- **THEN** the button SHALL NOT have the HTML `disabled` attribute, SHALL have `aria-disabled="false"`, SHALL NOT carry the disabled opacity/`cursor-not-allowed` treatment, and SHALL render active interactive styling with hover and focus states.

#### Scenario: Submit button busy styling while pending
- **WHEN** a request is pending (`pending === true`)
- **THEN** the button SHALL have the HTML `disabled` attribute, `aria-disabled="true"`, `aria-busy="true"`, the disabled visual treatment, and a label that distinguishes "submitting" from "cannot submit yet".
