import { createElement } from "react";
import type ChatPanel from "@/components/ChatPanel";
import RoomComposer from "@/components/rooms/RoomComposer";

type PanelProps = React.ComponentProps<typeof ChatPanel>;
type Listener = (...args: never[]) => void;

export let panelProps: PanelProps;
export let showComposer = false;
export let currentChannel: string | null = "test-channel";
export const emitted: { event: string; data: unknown }[] = [];
export function makeSocket() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    connected: true,
    id: "test-socket",
    listeners,
    on(event: string, listener: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return this;
    },
    off(event: string) { listeners.delete(event); return this; },
    emit(event: string, data: unknown) { emitted.push({ event, data }); return this; },
    removeAllListeners() { listeners.clear(); return this; },
    disconnect() { this.connected = false; return this; },
    connect() { this.connected = true; return this; },
  };
}
export let socket = makeSocket();
export const sockets = [socket];
export let pendingBeforeReplacementConnect: boolean | undefined;
export const requestedToasts: string[] = [];
export function setShowComposer(value: boolean) { showComposer = value; }
export function setCurrentChannel(value: string | null) { currentChannel = value; }
export function setSocket(value: ReturnType<typeof makeSocket>) { socket = value; sockets.push(value); }
export function resetReplacementObservation() { pendingBeforeReplacementConnect = undefined; }
export function io() {
  socket = sockets.at(-1)!;
  if (currentChannel === "replacement-channel") pendingBeforeReplacementConnect = panelProps.roomCreatePending;
  return socket;
}
export function FakeChatPanel(props: PanelProps) {
  panelProps = props;
  if (!showComposer || props.roomState.view !== "compose") return null;
  return createElement(RoomComposer, {
    mode: "create",
    npcCandidates: [{ id: "npc-1", name: "Sophie" }, { id: "npc-2", name: "Alex" }],
    userCandidates: [{ id: "user-2", name: "Jane", online: true }],
    presetNpcIds: props.roomState.compose?.presetNpcIds ?? [],
    pending: props.roomCreatePending,
    availability: props.roomCreateAvailability,
    onSubmit: ({ name, npcIds, userIds }: { name: string; npcIds: string[]; userIds: string[] }) => { props.onRoomCreate(name, npcIds, userIds); },
    onCancel: () => props.onRoomAction({ type: "showList" }),
  });
}
export const router = { push() {}, replace() {}, refresh() {} };
export function useRouter() { return router; }
export function useSearchParams() { return new URLSearchParams(currentChannel ? `channelId=${currentChannel}` : ""); }
export function usePathname() { return "/game"; }
export function EmptyComponent() { return null; }
export function fakeDynamic() { return EmptyComponent; }
