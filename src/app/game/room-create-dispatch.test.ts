import assert from "node:assert/strict";
import test from "node:test";

import { decideCreateError, decideRoomCreate } from "./room-create-dispatch";

test("room creation preflight accepts only a connected, channel-bound idle request", () => {
  assert.deepEqual(decideRoomCreate({ connected: true, hasChannel: true, pending: false }), {
    accepted: true,
  });
  assert.deepEqual(decideRoomCreate({ connected: false, hasChannel: false, pending: true }), {
    accepted: false,
    reason: "disconnected",
  });
  assert.deepEqual(decideRoomCreate({ connected: true, hasChannel: false, pending: false }), {
    accepted: false,
    reason: "missing_channel",
  });
  assert.deepEqual(decideRoomCreate({ connected: true, hasChannel: true, pending: true }), {
    accepted: false,
    reason: "pending",
  });
});

test("every room error while creating retains compose and never refreshes the list", () => {
  for (const payload of [
    { code: "invalid" },
    { code: "forbidden" },
    { code: "not_found" },
    { code: "unknown" },
    null,
  ]) {
    const result = decideCreateError(payload, { requestId: "ticket" });
    assert.equal(result.attributed, true);
    assert.equal(result.backToList, false);
    assert.equal(result.refreshList, false);
    assert.ok(result.toastKey);
  }
});

test("without a pending create, room errors retain the existing chat decision", () => {
  const forbidden = decideCreateError({ code: "forbidden" }, null);
  assert.deepEqual(forbidden, {
    attributed: false,
    toastKey: "game.room.error.forbidden",
    rejoin: false,
    backToList: true,
    refreshList: true,
  });
  const notJoined = decideCreateError({ code: "not_joined" }, null);
  assert.equal(notJoined.rejoin, true);
  assert.equal(notJoined.refreshList, false);
});
