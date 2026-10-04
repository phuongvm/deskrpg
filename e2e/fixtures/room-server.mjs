import { spawn } from "node:child_process";
import { randomUUID, randomBytes, createHash, createCipheriv } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:http";

// Isolated assembled-system fixture. No repository credentials or personal DB are read.
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  if (existsSync(name)) throw new Error(`Room fixture refuses repository ${name}`);
}
const require = createRequire(import.meta.url);
const scratch = process.env.TMPDIR ?? tmpdir();
const directory = mkdtempSync(join(scratch, "deskrpg-room-fixture-"));
const env = {
  PATH: process.env.PATH ?? "",
  HOME: directory,
  TMPDIR: tmpdir(),
  NODE_ENV: "production",
  HOSTNAME: "127.0.0.1",
  PORT: process.env.DESKRPG_FIXTURE_PORT ?? "13104",
  DB_TYPE: "sqlite",
  SQLITE_PATH: join(directory, "fixture.db"),
  DESKRPG_HOME: directory,
  JWT_SECRET: "deskrpg-e2e-synthetic-secret-not-for-production",
  INTERNAL_RPC_SECRET: "deskrpg-e2e-synthetic-internal-secret",
  NEXT_TELEMETRY_DISABLED: "1",
  COOKIE_SECURE: "false",
};
// server-db bootstraps the application schema in a disposable SQLite database.
// Seed two group members and characters for real socket participation, a channel with
// a valid Tiled map, and a gateway-bound NPC profile for the Staff roster. The fake
// loopback gateway only answers the reachability probe; NPC turns never execute.
Object.assign(process.env, env);
require("../../src/db/server-db.js");
const Database = require("better-sqlite3");
const sqlite = new Database(env.SQLITE_PATH);
const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  colleague: "00000000-0000-4000-8000-000000000002",
  channel: "00000000-0000-4000-8000-000000000003",
  group: "00000000-0000-4000-8000-000000000009",
  character: "00000000-0000-4000-8000-000000000004",
  colleagueCharacter: "00000000-0000-4000-8000-000000000008",
  gateway: "00000000-0000-4000-8000-000000000005",
  profile: "00000000-0000-4000-8000-000000000006",
  npc: "00000000-0000-4000-8000-000000000007",
};
// The production roster probes both endpoints; this loopback fake only identifies as an API server.
const gateway = createServer((request, response) => {
  response.writeHead(request.url === "/v1/models" ? 401 : 200, {
    "content-type": "application/json",
  });
  response.end(
    JSON.stringify(request.url === "/health" ? { status: "ok" } : { error: "unauthorized" }),
  );
});
await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
const gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;
const now = new Date().toISOString();
const iv = randomBytes(12);
const cipher = createCipheriv(
  "aes-256-gcm",
  createHash("sha256").update(env.INTERNAL_RPC_SECRET).digest(),
  iv,
);
const encrypted = Buffer.concat([cipher.update("fixture-only-token", "utf8"), cipher.final()]);
const tokenEncrypted = `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
sqlite
  .prepare("INSERT INTO users (id,login_id,nickname,password_hash) VALUES (?,?,?,?)")
  .run(ids.owner, "e2e-owner", "E2E Owner", "unused");
sqlite
  .prepare("INSERT INTO users (id,login_id,nickname,password_hash) VALUES (?,?,?,?)")
  .run(ids.colleague, "e2e-colleague", "E2E Colleague", "unused");
sqlite
  .prepare("INSERT INTO characters (id,user_id,name,appearance) VALUES (?,?,?,?)")
  .run(
    ids.character,
    ids.owner,
    "E2E Owner",
    JSON.stringify({ officeLookId: "office-jun", bodyType: "male" }),
  );
sqlite
  .prepare("INSERT INTO characters (id,user_id,name,appearance) VALUES (?,?,?,?)")
  .run(
    ids.colleagueCharacter,
    ids.colleague,
    "E2E Colleague",
    JSON.stringify({ officeLookId: "office-jun", bodyType: "male" }),
  );
sqlite
  .prepare(
    "INSERT INTO groups (id,name,slug,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)",
  )
  .run(ids.group, "Fixture Group", "fixture-group", ids.owner, now, now);
for (const userId of [ids.owner, ids.colleague]) {
  sqlite
    .prepare("INSERT INTO group_members (id,group_id,user_id,role,joined_at) VALUES (?,?,?,?,?)")
    .run(randomUUID(), ids.group, userId, userId === ids.owner ? "owner" : "member", now);
}
const fixtureMap = JSON.parse(
  readFileSync("src/server/fixtures/small-office-map.json", "utf8"),
).tiledJson;
sqlite
  .prepare(
    "INSERT INTO channels (id,name,owner_id,group_id,is_public,map_data) VALUES (?,?,?,?,1,?)",
  )
  .run(ids.channel, "Fixture Office", ids.owner, ids.group, JSON.stringify(fixtureMap));
sqlite
  .prepare("INSERT INTO channel_members (id,channel_id,user_id) VALUES (?,?,?)")
  .run(randomUUID(), ids.channel, ids.colleague);
sqlite
  .prepare(
    "INSERT INTO gateway_resources (id,owner_user_id,display_name,base_url,token_encrypted,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
  )
  .run(ids.gateway, ids.owner, "Fixture Gateway", gatewayUrl, tokenEncrypted, now, now);
sqlite
  .prepare(
    "INSERT INTO channel_gateway_bindings (id,channel_id,gateway_id,bound_by_user_id,bound_at) VALUES (?,?,?,?,?)",
  )
  .run(randomUUID(), ids.channel, ids.gateway, ids.owner, now);
sqlite
  .prepare(
    "INSERT INTO hermes_profiles (id,gateway_id,profile_name,token_encrypted,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
  )
  .run(ids.profile, ids.gateway, "fixture", tokenEncrypted, "Fixture Staff", now, now);
sqlite
  .prepare(
    "INSERT INTO npcs (id,channel_id,name,position_x,position_y,appearance,hermes_profile_id,active) VALUES (?,?,?,?,?,?,?,1)",
  )
  .run(ids.npc, ids.channel, "Fixture Staff", 1, 1, "{}", ids.profile);
sqlite.close();
console.log(`[room-fixture] port=${env.PORT} home=${directory} channel=${ids.channel}`);
const child = spawn(process.execPath, ["--import", "tsx", "server.js"], { stdio: "inherit", env });
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 5000).unref();
  });
child.on("exit", (code) => {
  gateway.close();
  rmSync(directory, { recursive: true, force: true });
  process.exit(stopping ? 0 : (code ?? 1));
});
child.on("error", (error) => {
  rmSync(directory, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
