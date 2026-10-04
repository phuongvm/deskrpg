import { SignJWT } from "jose";
import { io, type Socket } from "socket.io-client";
import { expect, test, type Page, type BrowserContext } from "@playwright/test";

const CHANNEL_ID = "00000000-0000-4000-8000-000000000003";
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const NPC_ID = "00000000-0000-4000-8000-000000000007";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const SECRET = "deskrpg-e2e-synthetic-secret-not-for-production";

type Frame = { event: string; data: Record<string, unknown> };
function packet(message: string | Buffer): Frame | null {
  if (typeof message !== "string" || !message.startsWith("42")) return null;
  try {
    const [event, data] = JSON.parse(message.slice(2));
    return typeof event === "string" ? { event, data } : null;
  } catch {
    return null;
  }
}

async function syntheticToken(userId: string, nickname: string) {
  return new SignJWT({ userId, nickname })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

async function openComposer(
  page: Page,
  context: BrowserContext,
  onCreate?: (message: string, forward: (message: string) => void) => void,
) {
  const sent: Frame[] = [];
  const received: Frame[] = [];
  await context.routeWebSocket(/\/socket\.io\//, (client) => {
    console.log(`[room-fixture] routed ${client.url()}`);
    const server = client.connectToServer();
    client.onMessage((message) => {
      const frame = packet(message);
      if (frame?.event === "room:create") {
        sent.push(frame);
        if (onCreate) return onCreate(message as string, (packet) => server.send(packet));
      }
      server.send(message);
    });
    server.onMessage((message) => {
      const frame = packet(message);
      if (frame) received.push(frame);
      client.send(message);
    });
  });
  const token = await syntheticToken(OWNER_ID, "E2E Owner");
  await context.addCookies([
    {
      name: "token",
      value: token,
      url: test.info().project.use.baseURL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`/game?channelId=${CHANNEL_ID}`);
  await page.locator("canvas").first().waitFor({ state: "visible" });
  await page
    .getByRole("complementary", { name: "오피스 전체" })
    .getByRole("button", { name: "방", exact: true })
    .click();
  await page.getByRole("complementary").getByRole("button", { name: "새 방" }).click();
  const name = page.getByPlaceholder("방 이름");
  await expect(name).toBeVisible();
  return {
    sent,
    received,
    name,
    create: page.getByRole("complementary", { name: "새 방" }).locator("button[aria-disabled]"),
  };
}

test("humans only cannot create and server rejection keeps the draft with a fresh retry ticket", async ({
  page,
  context,
}) => {
  let colleague: Socket | undefined;
  let reject = true;
  let releaseRejection: (() => void) | undefined;
  try {
    const token = await syntheticToken(USER_ID, "E2E Colleague");
    colleague = io(
      `http://127.0.0.1:${Number(new URL(test.info().project.use.baseURL!).port) + 1}`,
      {
        transports: ["websocket"],
        forceNew: true,
        extraHeaders: { cookie: `token=${token}` },
      },
    );
    await new Promise<void>((resolve, rejectConnection) => {
      colleague!.once("connect", resolve);
      colleague!.once("connect_error", rejectConnection);
    });
    const response = await context.request.get(`/api/channels/${CHANNEL_ID}`, {
      headers: { cookie: `token=${token}` },
    });
    expect(response.ok()).toBe(true);
    const { channel } = await response.json();
    const spawned = new Promise<void>((resolve, rejectJoin) => {
      colleague!.once("player:spawn", () => resolve());
      colleague!.once("join-error", () => rejectJoin(new Error("colleague join rejected")));
      colleague!.once("channel:access-denied", (data) =>
        rejectJoin(new Error(`colleague denied: ${JSON.stringify(data)}`)),
      );
      colleague!.once("map:refresh", (data) =>
        rejectJoin(new Error(`colleague map refresh: ${JSON.stringify(data)}`)),
      );
      colleague!.once("disconnect", (reason) =>
        rejectJoin(new Error(`colleague disconnected: ${reason}`)),
      );
    });
    // Socket.IO's connect event precedes the server's asynchronous auth/handler installation.
    await new Promise((resolve) => setTimeout(resolve, 200));
    colleague.emit("player:join", {
      mapId: CHANNEL_ID,
      mapRevision: channel.mapRevision,
      x: 96,
      y: 96,
    });
    await Promise.race([
      spawned,
      new Promise<never>((_, rejectJoin) =>
        setTimeout(() => rejectJoin(new Error("colleague spawn timeout")), 5000),
      ),
    ]);
    const fixture = await openComposer(page, context, (message, forward) => {
      if (reject) {
        reject = false;
        const [event, data] = JSON.parse(message.slice(2));
        releaseRejection = () =>
          forward(
            `42${JSON.stringify([event, { ...data, channelId: "00000000-0000-4000-8000-000000000099" }])}`,
          );
      } else forward(message);
    });
    await fixture.name.fill("E2E Retained Draft");
    await page.locator(`[data-user-id="${USER_ID}"]`).check();
    await expect(fixture.create).toBeDisabled();
    await expect(page.getByText("방을 만들려면 AI 직원을 한 명 이상 선택하세요")).toBeVisible();
    expect(fixture.sent).toHaveLength(0);
    await page.locator(`[data-npc-id="${NPC_ID}"]`).check();
    await expect(fixture.create).toBeEnabled();
    await fixture.create.click();
    await expect(fixture.create).toHaveAttribute("aria-busy", "true");
    expect(releaseRejection).toBeDefined();
    releaseRejection!();
    await expect
      .poll(() => fixture.received.some((frame) => frame.event === "room:error"))
      .toBe(true);
    await expect(page.getByText("방을 만들지 못했습니다. 다시 시도하세요.")).toBeVisible();
    await expect(fixture.name).toHaveValue("E2E Retained Draft");
    await expect(page.locator(`[data-user-id="${USER_ID}"]`)).toBeChecked();
    await expect(page.locator(`[data-npc-id="${NPC_ID}"]`)).toBeChecked();
    await expect(fixture.create).toBeEnabled();
    await fixture.create.click();
    await expect.poll(() => fixture.sent.length).toBe(2);
    expect(fixture.sent[0].data.requestId).not.toBe(fixture.sent[1].data.requestId);
  } finally {
    colleague?.disconnect();
  }
});

test("slow real acknowledgment permits only one create, then enters room and lists it", async ({
  page,
  context,
}) => {
  let release: (() => void) | undefined;
  const fixture = await openComposer(page, context, (message, forward) => {
    release = () => forward(message);
  });
  await fixture.name.fill("E2E Accepted Room");
  await page.locator(`[data-npc-id="${NPC_ID}"]`).check();
  await fixture.create.click();
  await expect(fixture.create).toHaveAttribute("aria-busy", "true");
  await fixture.create.click({ force: true });
  expect(fixture.sent).toHaveLength(1);
  expect(release).toBeDefined();
  release!();
  await expect
    .poll(() =>
      fixture.received.some(
        (frame) =>
          frame.event === "room:created" && frame.data.requestId === fixture.sent[0].data.requestId,
      ),
    )
    .toBe(true);
  await expect(fixture.name).not.toBeVisible();
  const roomHeaderBack = page.locator('[data-chat-panel] button[aria-label="방"]');
  await expect(roomHeaderBack).toBeVisible();
  await expect(
    roomHeaderBack.locator("..").getByText("E2E Accepted Room", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "방", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "E2E Accepted Room" })).toHaveCount(1);
  expect(fixture.sent).toHaveLength(1);
});
