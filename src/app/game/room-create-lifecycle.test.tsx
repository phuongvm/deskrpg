import "../../test-setup/dom";

import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import React, { act } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/lib/i18n";
import en from "@/lib/i18n/locales/en";
import type ChatPanel from "@/components/ChatPanel";
import type { RoomSummary } from "@/lib/chat-rooms-policy";
import * as fixture from "./room-create-lifecycle-fixture";

// Isolate page dependencies with Node's stable synchronous loader hooks in this test worker.
// The real GamePageClient still owns its React state, socket effects and event handlers.
const replacements: Record<string, string> = {
  "socket.io-client": "socket",
  "@/components/ChatPanel": "panel",
  "next/dynamic": "dynamic",
  "./NpcStatesBridge": "bridge",
  "next/navigation": "navigation",
};
type Resolve = (specifier: string, context: { parentURL?: string }) => { url: string };
const require = createRequire(import.meta.url);
const { registerHooks } = require("node:module") as { registerHooks: (hooks: { resolve: (specifier: string, context: { parentURL?: string }, nextResolve: Resolve) => { url: string } }) => { deregister(): void } };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier in replacements && (specifier === "socket.io-client" || context.parentURL?.includes("GamePageClient"))) {
      return nextResolve(`./room-create-lifecycle-${replacements[specifier]}`, { ...context, parentURL: import.meta.url });
    }
    return nextResolve(specifier, context);
  },
});
// Next strips this marker during its build; bare React does not.
const reactModule = require("react") as typeof React;
const pendingRefs: { current: unknown }[] = [];
const pendingStateWrites = new Map<string, unknown[]>();
const originalUseRef = reactModule.useRef;
const originalUseState = reactModule.useState;
reactModule.useRef = ((initial: unknown) => {
  const ref = originalUseRef(initial);
  pendingRefs.push(ref);
  return ref;
}) as typeof React.useRef;
reactModule.useState = ((initial: unknown) => {
  const [value, setValue] = originalUseState(initial);
  let ticket: string | undefined;
  return [value, (next: unknown) => {
    if (next && typeof next === "object" && "requestId" in next && typeof next.requestId === "string") {
      ticket = next.requestId;
    }
    if (ticket) {
      const writes = pendingStateWrites.get(ticket) ?? [];
      writes.push(next);
      pendingStateWrites.set(ticket, writes);
    }
    if (next === en["room.create.interrupted"]) fixture.requestedToasts.push(next);
    setValue(next);
  }];
}) as typeof React.useState;
const jsxModule = require("react/jsx-runtime") as typeof jsxRuntime;
const originalJsx = jsxModule.jsx;
const originalJsxs = jsxModule.jsxs;
function normalizeStyle(type: React.ElementType, props: unknown) {
  if (type !== "style" || !props || typeof props !== "object" || !("jsx" in props)) return props;
  return { ...props, jsx: undefined };
}
jsxModule.jsx = ((type, props, key) => originalJsx(type, normalizeStyle(type, props), key)) as typeof jsxRuntime.jsx;
jsxModule.jsxs = ((type, props, key) => originalJsxs(type, normalizeStyle(type, props), key)) as typeof jsxRuntime.jsxs;
type PanelProps = React.ComponentProps<typeof ChatPanel>;
const emitted = fixture.emitted;
const makeSocket = fixture.makeSocket;
let socket = fixture.socket;
let currentChannel: string | null = "test-channel";
let pendingBeforeReplacementConnect: boolean | undefined;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  const body = url.includes("/api/characters/me")
    ? { character: { id: "character-1", name: "Tester", appearance: null } }
    : url.includes("/api/channels/test-channel") || url.includes("/api/channels/replacement-channel")
      ? { channel: { id: currentChannel, name: "Test", isMember: true, mapData: null } }
      : { npcs: [], meetings: [], records: [] };
  return { ok: true, status: 200, json: async () => body } as Response;
}) as typeof fetch;


const room: RoomSummary = {
  id: "new-room", kind: "group", name: "Planning", replyPolicy: "members",
  createdBy: "user-1", lastMessageAt: null, members: [],
};

async function fire(event: string, data?: unknown) {
  socket = fixture.socket;
  const handlers = socket.listeners.get(event);
  assert.ok(handlers?.size, `missing ${event} listener`);
  await act(async () => { for (const listener of [...handlers]) listener(data as never); });
}

async function mount(composer = false) {
  currentChannel = "test-channel";
  fixture.setCurrentChannel(currentChannel);
  fixture.setShowComposer(composer);
  socket = makeSocket();
  fixture.setSocket(socket);
  const { default: GamePage } = await import("./GamePageClient");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<I18nProvider initialLocale="en"><GamePage /></I18nProvider>));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  // The page's fixture socket is initialized by a dynamic import.
  socket = fixture.socket;
  assert.ok(socket.listeners.has("room:created"));
  return {
    host,
    rerender: async (channel = currentChannel) => {
      currentChannel = channel;
      fixture.setCurrentChannel(channel);
      if (channel !== "test-channel") fixture.setSocket(makeSocket());
      await act(async () => root.render(<I18nProvider initialLocale="en"><GamePage /></I18nProvider>));
      if (channel !== "test-channel") {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      }
      pendingBeforeReplacementConnect = fixture.pendingBeforeReplacementConnect;
      socket = fixture.socket;
    },
    cleanup: async () => { await act(async () => root.unmount()); host.remove(); },
  };
}

function draft(host: HTMLElement) {
  const name = host.querySelector('input[type="text"]') as HTMLInputElement;
  const npc = host.querySelector('[data-npc-id="npc-1"]') as HTMLInputElement;
  const user = host.querySelector('[data-user-id="user-2"]') as HTMLInputElement;
  const submit = host.querySelector("button[aria-disabled]") as HTMLButtonElement;
  assert.ok(name && npc && user && submit, "composer must remain mounted");
  return { name, npc, user, submit };
}
async function prepareDraft(host: HTMLElement) {
  await act(async () => fixture.panelProps.onRoomAction({ type: "compose", presetNpcIds: [] }));
  const fields = draft(host);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(fields.name, "Planning");
    fields.name.dispatchEvent(new Event("input", { bubbles: true }));
    fields.npc.click();
    fields.user.click();
  });
  assert.equal(draft(host).name.value, "Planning");
  return fields;
}

async function clickSubmit(host: HTMLElement) {
  await act(async () => { (draft(host).submit as HTMLButtonElement).click(); });
}

test("create accepts one request, waits for a matching ack, then enters the room", async () => {
  const mounted = await mount();
  try {
    await act(async () => fixture.panelProps.onRoomAction({ type: "compose", presetNpcIds: [] }));
    const initial = emitted.filter(({ event }) => event === "room:create").length;
    let result: ReturnType<PanelProps["onRoomCreate"]> | undefined;
    await act(async () => { result = fixture.panelProps.onRoomCreate("Planning", ["npc-1"], ["user-2"]); });
    assert.equal(result?.accepted, true);
    if (!result?.accepted) throw new Error("create was not accepted");
    const ticket = result.requestId;
    assert.deepEqual(emitted.filter(({ event }) => event === "room:create").slice(initial), [
      { event: "room:create", data: { channelId: "test-channel", name: "Planning", npcIds: ["npc-1"], userIds: ["user-2"], requestId: ticket } },
    ]);
    assert.equal(fixture.panelProps.roomCreatePending, true);
    assert.equal(fixture.panelProps.roomState.view, "compose");
    assert.deepEqual(fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []), { accepted: false, reason: "pending" });
    await fire("room:created", { room, requestId: "another-ticket" });
    assert.equal(fixture.panelProps.roomState.view, "compose");
    assert.equal(fixture.panelProps.roomCreatePending, true);
    await fire("room:created", { room, requestId: ticket });
    assert.equal(fixture.panelProps.roomCreatePending, false);
    assert.equal(fixture.panelProps.roomState.view, "room");
    assert.equal(fixture.panelProps.roomState.currentRoomId, room.id);
    assert.equal(fixture.panelProps.roomState.compose, undefined);
  } finally { await mounted.cleanup(); }
});

for (const { channel, connected, reason, toastKey } of [
  { channel: "test-channel", connected: false, reason: "disconnected", toastKey: "room.create.offline" },
  { channel: null, connected: true, reason: "missing_channel", toastKey: "room.create.noChannel" },
] as const) {
  test(`${reason} preflight emits nothing and shows its localized toast`, async () => {
    const mounted = await mount();
    try {
      await act(async () => fixture.panelProps.onRoomAction({ type: "compose", presetNpcIds: [] }));
      if (channel === null) await mounted.rerender(null);
      socket.connected = connected;
      const before = emitted.length;
      let rejected: ReturnType<PanelProps["onRoomCreate"]> | undefined;
      await act(async () => { rejected = fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []); });
      assert.deepEqual(rejected, { accepted: false, reason });
      assert.equal(emitted.length, before);
      assert.equal(fixture.panelProps.roomCreatePending, false);
      assert.equal(mounted.host.querySelector('[data-testid="game-toast"]')?.textContent, en[toastKey]);
    } finally { await mounted.cleanup(); }
  });
}

test("cancel ignores a late acknowledgment", async () => {
  const mounted = await mount();
  try {
    await act(async () => fixture.panelProps.onRoomAction({ type: "compose", presetNpcIds: [] }));
    let accepted: ReturnType<PanelProps["onRoomCreate"]> | undefined;
    await act(async () => { accepted = fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []); });
    assert.ok(accepted?.accepted);
    const requestId = accepted.requestId;
    await act(async () => fixture.panelProps.onRoomAction({ type: "showList" }));
    assert.equal(fixture.panelProps.roomCreatePending, false);
    await fire("room:created", { room, requestId });
    assert.equal(fixture.panelProps.roomState.view, "list");
    assert.ok(fixture.panelProps.roomState.rooms.some((item) => item.id === room.id));
  } finally { await mounted.cleanup(); }
});

test("delayed list responses preserve a typed composer both idle and pending", async () => {
  const mounted = await mount(true);
  try {
    await prepareDraft(mounted.host);
    const compose = fixture.panelProps.roomState.compose;
    const original = draft(mounted.host).name;
    await fire("room:list-response", { rooms: [room], viewerUserId: "user-1" });
    assert.equal(fixture.panelProps.roomState.view, "compose");
    assert.equal(fixture.panelProps.roomState.compose, compose);
    assert.equal(fixture.panelProps.roomState.rooms[0]?.id, room.id);
    assert.equal(draft(mounted.host).name, original);
    assert.equal(draft(mounted.host).name.value, "Planning");
    assert.equal(draft(mounted.host).npc.checked, true);
    assert.equal(draft(mounted.host).user.checked, true);
    await clickSubmit(mounted.host);
    assert.equal(fixture.panelProps.roomCreatePending, true);
    await fire("room:list-response", { rooms: [], viewerUserId: "user-1" });
    assert.equal(fixture.panelProps.roomState.view, "compose");
    assert.equal(fixture.panelProps.roomState.compose, compose);
    assert.equal(fixture.panelProps.roomCreatePending, true);
    assert.deepEqual(fixture.panelProps.roomState.rooms, []);
    assert.equal(draft(mounted.host).name, original);
    assert.equal(draft(mounted.host).name.value, "Planning");
    assert.equal(draft(mounted.host).npc.checked, true);
    assert.equal(draft(mounted.host).user.checked, true);
  } finally { await mounted.cleanup(); }
});

test("channel replacement releases pending and ignores a late old ticket", async () => {
  const mounted = await mount(true);
  try {
    await prepareDraft(mounted.host);
    await clickSubmit(mounted.host);
    const first = emitted.filter(({ event }) => event === "room:create").at(-1)!.data as { requestId: string };
    const oldSocket = socket;
    await mounted.rerender("replacement-channel");
    assert.equal(oldSocket.connected, false);
    assert.equal(pendingBeforeReplacementConnect, false);
    assert.equal(socket.connected, true);
    assert.notEqual(socket, oldSocket);
    assert.equal(fixture.panelProps.roomCreatePending, false);
    assert.equal(fixture.panelProps.roomState.view, "compose");
    assert.equal(draft(mounted.host).name.value, "Planning");
    assert.equal(draft(mounted.host).npc.checked, true);
    assert.equal(draft(mounted.host).user.checked, true);
    assert.ok(mounted.host.querySelector('[data-testid="game-toast"]')?.textContent);
    await clickSubmit(mounted.host);
    const second = emitted.filter(({ event }) => event === "room:create").at(-1)!.data as { requestId: string; channelId: string };
    assert.notEqual(second.requestId, first.requestId);
    assert.equal(second.channelId, "replacement-channel");
    assert.equal(fixture.panelProps.roomCreatePending, true);
    await fire("room:created", { room, requestId: first.requestId });
    assert.equal(fixture.panelProps.roomState.view, "compose");
    assert.equal(fixture.panelProps.roomCreatePending, true);
  } finally { await mounted.cleanup(); }
});

test("selection toggles while pending never emit a duplicate create", async () => {
  const mounted = await mount(true);
  try {
    await prepareDraft(mounted.host);
    const before = emitted.filter(({ event }) => event === "room:create").length;
    await clickSubmit(mounted.host);
    const ticket = (emitted.filter(({ event }) => event === "room:create").at(-1)!.data as { requestId: string }).requestId;
    assert.equal(fixture.panelProps.roomCreatePending, true);
    const initialToast = mounted.host.querySelector('[data-testid="game-toast"]')?.textContent;
    const npc = draft(mounted.host).npc;
    const secondNpc = mounted.host.querySelector('[data-npc-id="npc-2"]') as HTMLInputElement;
    for (const checkbox of [npc, npc, secondNpc]) {
      await act(async () => { checkbox.click(); });
      assert.equal(draft(mounted.host).submit.disabled, true);
      assert.equal(draft(mounted.host).submit.getAttribute("aria-busy"), "true");
      await clickSubmit(mounted.host);
      assert.equal(emitted.filter(({ event }) => event === "room:create").length, before + 1);
      assert.equal(fixture.panelProps.roomCreatePending, true);
    }
    assert.deepEqual(fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []), { accepted: false, reason: "pending" });
    assert.equal(mounted.host.querySelector('[data-testid="game-toast"]')?.textContent, initialToast);
    assert.equal(draft(mounted.host).name.value, "Planning");
    assert.equal(draft(mounted.host).user.checked, true);
    await fire("room:created", { room, requestId: ticket });
    assert.equal(fixture.panelProps.roomState.view, "room");
    assert.equal(fixture.panelProps.roomCreatePending, false);
  } finally { await mounted.cleanup(); }
});

test("pending create is cleared silently on unmount", async () => {
  const mounted = await mount();
  try {
    await act(async () => fixture.panelProps.onRoomAction({ type: "compose", presetNpcIds: [] }));
    let accepted: ReturnType<PanelProps["onRoomCreate"]> | undefined;
    await act(async () => { accepted = fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []); });
    assert.ok(accepted?.accepted);
    const ticket = accepted.requestId;
    const ref = pendingRefs.find((item) => item.current === ticket);
    assert.ok(ref, "pendingCreateRef holds the accepted ticket");
    assert.equal(fixture.panelProps.roomCreatePending, true);
    assert.deepEqual(pendingStateWrites.get(ticket), [{ requestId: ticket }]);
    const toast = mounted.host.querySelector('[data-testid="game-toast"]');
    assert.equal(toast?.textContent ?? "", "");
    const toastsBeforeUnmount = fixture.requestedToasts.length;
    await mounted.cleanup();
    assert.equal(ref.current, null);
    assert.deepEqual(pendingStateWrites.get(ticket), [{ requestId: ticket }, null]);
    assert.equal(fixture.requestedToasts.length, toastsBeforeUnmount);
    assert.equal(toast?.textContent ?? "", "");
    assert.equal(socket.listeners.has("room:created"), false);
  } finally {
    if (mounted.host.isConnected) await mounted.cleanup();
  }
});

for (const code of ["invalid", "forbidden", "not_found"]) {
  test(`attributed ${code} error clears pending without navigating or refreshing`, async () => {
    const mounted = await mount();
    try {
      await act(async () => fixture.panelProps.onRoomAction({ type: "compose", presetNpcIds: [] }));
      await act(async () => { fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []); });
      assert.equal(fixture.panelProps.roomCreatePending, true);
      const refreshes = emitted.filter(({ event }) => event === "room:list").length;
      await fire("room:error", { code, roomId: null });
      assert.equal(fixture.panelProps.roomCreatePending, false);
      assert.equal(fixture.panelProps.roomState.view, "compose");
      assert.equal(emitted.filter(({ event }) => event === "room:list").length, refreshes);
      assert.ok(mounted.host.querySelector('[data-testid="game-toast"]')?.textContent);
      await fire("room:list-response", { rooms: [room], viewerUserId: "user-1" });
      assert.equal(fixture.panelProps.roomState.view, "compose");
    } finally { await mounted.cleanup(); }
  });
}

for (const event of ["disconnect", "connect_error"]) {
  test(`${event} releases the ticket and a retry uses a fresh request id`, async () => {
    const mounted = await mount();
    try {
      await act(async () => fixture.panelProps.onRoomAction({ type: "compose", presetNpcIds: [] }));
      let first: ReturnType<PanelProps["onRoomCreate"]> | undefined;
      await act(async () => { first = fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []); });
      assert.ok(first?.accepted);
      if (event === "connect_error") {
        const originalError = console.error;
        const logged: unknown[][] = [];
        console.error = (...args) => { logged.push(args); };
        try { await fire(event, new Error("offline")); }
        finally { console.error = originalError; }
        assert.equal(logged.length, 1);
        assert.equal(logged[0][0], "[page] socket connect_error");
        assert.deepEqual(logged[0][1], { message: "offline", description: undefined, context: undefined, type: undefined });
      } else {
        await fire(event, new Error("offline"));
      }
      assert.equal(fixture.panelProps.roomCreatePending, false);
      assert.equal(fixture.panelProps.roomState.view, "compose");
      assert.ok(mounted.host.querySelector('[data-testid="game-toast"]')?.textContent);
      socket.connected = true;
      let retry: ReturnType<PanelProps["onRoomCreate"]> | undefined;
      await act(async () => { retry = fixture.panelProps.onRoomCreate("Planning", ["npc-1"], []); });
      assert.ok(retry?.accepted);
      assert.notEqual(retry.requestId, first.requestId);
      await fire("room:created", { room, requestId: first.requestId });
      assert.equal(fixture.panelProps.roomState.view, "compose");
      assert.equal(fixture.panelProps.roomCreatePending, true);
    } finally { await mounted.cleanup(); }
  });
}
