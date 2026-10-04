import "../../test-setup/dom";

import assert from "node:assert/strict";
import test from "node:test";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { I18nProvider } from "@/lib/i18n";
import RoomComposer from "./RoomComposer";

const npcs = [
  { id: "a", name: "소피" },
  { id: "b", name: "올리버" },
];
const people = [{ id: "u2", name: "제인", online: true }];

async function mount(node: React.ReactElement): Promise<{ root: Root; el: HTMLElement }> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => {
    root.render(node);
  });
  return { root, el };
}

const submitBtn = (el: HTMLElement) => el.querySelectorAll("button")[1] as HTMLButtonElement;
const npcBox = (el: HTMLElement, id: string) =>
  el.querySelector(`input[data-npc-id="${id}"]`) as HTMLInputElement;
const userBox = (el: HTMLElement) =>
  el.querySelector('input[data-user-id="u2"]') as HTMLInputElement;
const draftName = (el: HTMLElement) => el.querySelector('input[type="text"]') as HTMLInputElement;

async function typeName(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function composer(
  overrides: Partial<React.ComponentProps<typeof RoomComposer>> = {},
  onSubmit: React.ComponentProps<typeof RoomComposer>["onSubmit"] = () => {},
) {
  return (
    <I18nProvider initialLocale="ko">
      <RoomComposer
        mode="create"
        npcCandidates={npcs}
        userCandidates={people}
        presetNpcIds={[]}
        onSubmit={onSubmit}
        onCancel={() => {}}
        {...overrides}
      />
    </I18nProvider>
  );
}

function assertButtonState(button: HTMLButtonElement, disabled: boolean, busy = false) {
  assert.equal(button.disabled, disabled);
  assert.equal(button.getAttribute("aria-disabled"), String(disabled));
  assert.equal(button.getAttribute("aria-busy"), busy ? "true" : null);
  assert.equal(button.className.includes("cursor-not-allowed"), disabled);
  assert.equal(button.className.includes("opacity-40"), disabled);
}

test("Create button is disabled and a hint is shown when no NPC is picked", async () => {
  const { el } = await mount(
    <I18nProvider initialLocale="ko">
      <RoomComposer
        mode="create"
        npcCandidates={npcs}
        userCandidates={people}
        presetNpcIds={[]}
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    </I18nProvider>,
  );
  assert.equal(submitBtn(el).disabled, true);
  assert.match(el.textContent ?? "", /직원을 한 명 이상 고르세요/);
});

test("presetNpcIds are pre-checked, and submitting gives {name, npcIds, userIds}", async () => {
  const got: unknown[] = [];
  const { el } = await mount(
    <I18nProvider initialLocale="ko">
      <RoomComposer
        mode="create"
        npcCandidates={npcs}
        userCandidates={people}
        presetNpcIds={["a"]}
        onSubmit={(a) => got.push(a)}
        onCancel={() => {}}
      />
    </I18nProvider>,
  );
  const boxA = el.querySelector('input[type="checkbox"][data-npc-id="a"]') as HTMLInputElement;
  const boxB = el.querySelector('input[type="checkbox"][data-npc-id="b"]') as HTMLInputElement;
  const boxU = el.querySelector('input[type="checkbox"][data-user-id="u2"]') as HTMLInputElement;
  assert.equal(boxA.checked, true);
  await act(async () => {
    boxB.click();
    boxU.click();
  });
  const name = el.querySelector("input[type=text]") as HTMLInputElement;
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(name, "유튜브 기획");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(submitBtn(el).disabled, false);
  await act(async () => {
    submitBtn(el).click();
  });
  assert.deepEqual(got, [{ name: "유튜브 기획", npcIds: ["a", "b"], userIds: ["u2"] }]);
});

test("create validation is colocated, clears on selection and returns on deselection without losing people", async () => {
  const submissions: unknown[] = [];
  const { el } = await mount(composer({}, (args) => submissions.push(args)));
  const button = submitBtn(el);
  const footer = button.parentElement?.parentElement as HTMLElement;
  const initialHelper = "방을 만들려면 AI 직원을 한 명 이상 선택하세요";
  assertButtonState(button, true);
  assert.match(footer.textContent ?? "", new RegExp(initialHelper));
  await typeName(draftName(el), "기획실");
  await act(async () => { userBox(el).click(); });
  assertButtonState(button, true);
  assert.equal(userBox(el).checked, true);
  assert.match(footer.textContent ?? "", new RegExp(initialHelper));
  await act(async () => { button.click(); });
  assert.equal(submissions.length, 0);

  await act(async () => { npcBox(el, "a").click(); });
  assertButtonState(button, false);
  assert.doesNotMatch(footer.textContent ?? "", new RegExp(initialHelper));
  await act(async () => { npcBox(el, "a").click(); });
  assertButtonState(button, true);
  assert.match(footer.textContent ?? "", new RegExp(initialHelper));
  assert.equal(userBox(el).checked, true);
  assert.equal(draftName(el).value, "기획실");
});

test("invite mode requires any candidate and clears its helper on a human selection", async () => {
  const { el } = await mount(composer({ mode: "invite" }));
  const button = submitBtn(el);
  const footer = button.parentElement?.parentElement as HTMLElement;
  assertButtonState(button, true);
  assert.match(footer.textContent ?? "", /초대할 참가자를 한 명 이상 선택하세요/);
  await act(async () => { userBox(el).click(); });
  assertButtonState(button, false);
  assert.doesNotMatch(footer.textContent ?? "", /초대할 참가자를 한 명 이상 선택하세요/);
});

test("pending keeps the draft editable but never submits, including through selection changes", async () => {
  const submissions: unknown[] = [];
  const cancel = () => { submissions.push("cancel"); };
  const render = (pending: boolean) => (
    <I18nProvider initialLocale="ko">
      <RoomComposer mode="create" npcCandidates={npcs} userCandidates={people}
        presetNpcIds={[]} onSubmit={(args) => submissions.push(args)} onCancel={cancel} pending={pending} />
    </I18nProvider>
  );
  const { el, root } = await mount(render(true));
  const button = submitBtn(el);
  const footer = button.parentElement?.parentElement as HTMLElement;
  const helper = /방을 만들려면 AI 직원을 한 명 이상 선택하세요/;
  await typeName(draftName(el), "초안");
  await act(async () => { userBox(el).click(); npcBox(el, "a").click(); });
  assertButtonState(button, true, true);
  assert.match(button.textContent ?? "", /만드는 중/);
  assert.equal((el.querySelectorAll("button")[0] as HTMLButtonElement).disabled, false);
  assert.doesNotMatch(footer.textContent ?? "", helper);
  await act(async () => { button.click(); npcBox(el, "a").click(); });
  assertButtonState(button, true, true);
  assert.match(footer.textContent ?? "", helper);
  await act(async () => { button.click(); npcBox(el, "a").click(); });
  assertButtonState(button, true, true);
  assert.doesNotMatch(footer.textContent ?? "", helper);
  await act(async () => { npcBox(el, "b").click(); });
  assertButtonState(button, true, true);
  assert.doesNotMatch(footer.textContent ?? "", helper);
  assert.deepEqual(submissions, []);
  assert.equal(draftName(el).value, "초안");
  assert.equal(userBox(el).checked, true);
  assert.equal(npcBox(el, "a").checked, true);
  assert.equal(npcBox(el, "b").checked, true);
  await act(async () => { root.render(render(false)); });
  assertButtonState(submitBtn(el), false);
  assert.equal(draftName(el).value, "초안");
  assert.equal(npcBox(el, "b").checked, true);
});

test("offline and missing-channel hints do not gate a valid draft", async () => {
  const { el, root } = await mount(composer({ presetNpcIds: ["a"], availability: { connected: false, hasChannel: false } }));
  assertButtonState(submitBtn(el), false);
  assert.match(el.textContent ?? "", /연결이 끊어졌습니다/);
  await act(async () => {
    root.render(composer({ presetNpcIds: ["a"], availability: { connected: true, hasChannel: false } }));
  });
  assertButtonState(submitBtn(el), false);
  assert.match(el.textContent ?? "", /채널을 찾을 수 없습니다/);
  assert.doesNotMatch(el.textContent ?? "", /연결이 끊어졌습니다/);
});
