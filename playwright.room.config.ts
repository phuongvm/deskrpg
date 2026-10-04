import { defineConfig } from "@playwright/test";

const port = Number(process.env.DESKRPG_FIXTURE_PORT ?? "13104");
if (!Number.isInteger(port) || port < 1024 || port > 65534) throw new Error("Invalid fixture port");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "room-create.spec.ts",
  projects: [{ name: "room-fixtures" }],
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  outputDir: ".artifacts/room-fixtures/test-results",
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
    trace: "on",
    screenshot: "on",
  },
  webServer: {
    command: `"${process.execPath}" e2e/fixtures/room-server.mjs`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 90_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
