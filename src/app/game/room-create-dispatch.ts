import { decideChatError } from "./chat-error-dispatch";

export type RoomCreateDispatch =
  | { accepted: true; requestId: string }
  | { accepted: false; reason: "disconnected" | "missing_channel" | "pending" };

type Preflight = { connected: boolean; hasChannel: boolean; pending: boolean };

/** Preflight is ordered so a lost connection is reported before missing channel context. */
export function decideRoomCreate({ connected, hasChannel, pending }: Preflight):
  | { accepted: true }
  | Extract<RoomCreateDispatch, { accepted: false }> {
  if (!connected) return { accepted: false, reason: "disconnected" };
  if (!hasChannel) return { accepted: false, reason: "missing_channel" };
  if (pending) return { accepted: false, reason: "pending" };
  return { accepted: true };
}

/** `room:error` has no request ticket: any error during a create belongs to that request. */
export function decideCreateError(payload: unknown, pending: { requestId: string } | null) {
  if (pending) {
    return {
      attributed: true,
      toastKey: "room.create.failed",
      rejoin: false,
      backToList: false,
      refreshList: false,
    };
  }
  const decision = decideChatError(payload);
  return { attributed: false, ...decision, refreshList: decision.backToList };
}
