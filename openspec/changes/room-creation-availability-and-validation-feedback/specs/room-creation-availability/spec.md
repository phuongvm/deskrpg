## ADDED Requirements

### Requirement: Room Creation Readiness Contract
The application SHALL maintain an explicit readiness contract for room creation operations, tracking WebSocket connectivity and active channel context.

#### Scenario: Client connected with active channel and no request pending
- **WHEN** a room creation request is triggered while the WebSocket connection is active (`socket.connected === true`), a valid `channelId` is bound, and no room creation request is already pending (`pendingCreateRef.current === null`)
- **THEN** the room creation request SHALL be dispatched to the server via `socket.emit("room:create", ...)` exactly once, carrying a new request ticket, and the request SHALL become the pending request.

#### Scenario: Client disconnected or reconnecting
- **WHEN** a room creation request is triggered while the WebSocket connection is unavailable or reconnecting (`!socket || !socket.connected`)
- **THEN** the application SHALL NOT silently discard the request; it SHALL surface a user-visible notification or toast indicating that the connection is offline or reconnecting.

#### Scenario: Channel ID uninitialized
- **WHEN** a room creation request is triggered without an active channel context (`!channelId`)
- **THEN** the application SHALL surface an explicit error notice informing the user that channel context is missing, preventing silent failure.

### Requirement: Room Creation Dispatch Feedback
The application SHALL provide feedback to the user regarding the outcome of room creation dispatch, and SHALL treat the matching server acknowledgment as the only successful exit from the composer.

#### Scenario: Composer retained until acknowledgment
- **WHEN** a room creation request has been accepted for dispatch
- **THEN** the composer SHALL remain displayed with the entered name and selections intact, SHALL indicate that the request is in progress, and SHALL NOT be dismissed or reset until a matching acknowledgment or a failure outcome arrives.

#### Scenario: Successful dispatch and creation acknowledgment
- **WHEN** the server responds to `room:create` with `room:created` matching the client request ticket
- **THEN** the client SHALL clear the pending request, transition the view to the newly created room, and dismiss the composer modal.

#### Scenario: Non-matching creation acknowledgment
- **WHEN** a `room:created` event arrives whose request ticket is absent or does not match the pending request
- **THEN** the client SHALL update the room list only and SHALL NOT dismiss the composer, enter that room, or clear the pending request.

#### Scenario: Dispatch failure or network drop during creation
- **WHEN** the socket connection drops or emits an error during room creation
- **THEN** the client SHALL clear the pending request, present a visible failure alert or toast, and keep the composer displayed with the entered name and selections so the user can retry; the retry SHALL use a new request ticket. A server error attributed to the pending request SHALL NOT trigger a room list refresh request.

#### Scenario: Room list refresh arrives while composing
- **WHEN** a room list response arrives — for any reason, including reconnection, player state acknowledgment, or initial load — while the composer is displayed (idle or with a request pending)
- **THEN** the client SHALL update its known rooms from the response and SHALL keep the composer displayed with the entered name and selections intact, SHALL NOT change the active view, and SHALL NOT clear or reset the pending request.

#### Scenario: Connection context replaced while a request is pending
- **WHEN** the client's socket connection is torn down and replaced (for example because the channel context changes) while a room creation request is pending
- **THEN** the client SHALL clear the pending request before the replacement connection is usable so that a new submission is accepted with a new ticket; if the composer is still displayed, the client SHALL present the same interrupted-request notice as a connection drop and keep the entered name and selections; a late acknowledgment for the old ticket SHALL only update the room list.

#### Scenario: Duplicate submit while a request is pending
- **WHEN** the user attempts to submit again while a room creation request is pending (`pendingCreateRef.current !== null`), including after changing the selection while pending
- **THEN** the application SHALL NOT dispatch a second `room:create`, SHALL NOT replace the pending ticket, SHALL NOT show an additional notice, and SHALL keep the composer and its input unchanged; the connected-dispatch scenario above does not apply while a request is pending.

#### Scenario: Cancel while a request is pending
- **WHEN** the user cancels the composer while a room creation request is pending
- **THEN** the application SHALL clear the pending request and return to the room list; a later acknowledgment for the cancelled ticket SHALL only update the room list.
