# Colyseus on Vercel

![](image.png)

This is a minimal [Colyseus](https://colyseus.io) **0.17** app running on
[Vercel's WebSocket support](https://vercel.com/changelog/websocket-support-is-now-in-public-beta)
(public beta) — **realtime multiplayer + Express HTTP routes on one server**.
Move a dot, chat, sync state across tabs, and hit plain HTTP endpoints.

- **Server:** `colyseus@0.17` + `@colyseus/ws-transport` + `express`
- **Client:** `@colyseus/sdk@0.17` (from a CDN in `public/index.html`)
- **Host:** Vercel Functions on Fluid compute

👉 Live: https://colyseus-vercel.vercel.app

> **Note:** this demo vendors a pre-release Colyseus build (`.vendor/*.tgz`) that
> adds `Server.serverless()` — see [Why `serverless()`](#why-serverless). Once
> that lands in a published release, replace the `file:` deps in `package.json`
> with the normal `colyseus` package.

## How it works on Vercel

Vercel exposes two ways to run a Node HTTP server, and they behave differently:

| pattern | what Vercel drives | WebSockets | Express routes |
| --- | --- | --- | --- |
| `server.listen()` ("captured server") | the server's request listeners | ✅ | ❌ (Express app handler not invoked) |
| `export default server` | the server's full request handling | ✅ | ✅ |

Colyseus normally calls `gameServer.listen()`, which lands on the **captured
server** path — great for realtime, but Vercel doesn't invoke Express there. To
get realtime **and** Express, this demo uses the **`export default server`**
path via a new `Server.serverless()`:

```ts
// src/server.ts
import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MyRoom } from "./rooms/MyRoom";

const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  express: (app) => {
    app.get("/hello", (_req, res) => res.json({ hello: true }));
    app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  },
});
gameServer.define("my_room", MyRoom);

// set up matchmaking + routes WITHOUT binding a port; export for Vercel
const server = await gameServer.serverless();

// local dev only — serverless() doesn't listen (Vercel drives the export)
if (!process.env.VERCEL) server.listen(Number(process.env.PORT) || 2567);

export default server;
```

Two more requirements for the `export default` path on Vercel:

- **`package.json` `"main": "src/server.ts"`** — Vercel's auto-detection doesn't
  recognize a default-exported server wired through library code, so point it at
  the entrypoint explicitly.
- **Create the `http.Server` in your file** (`createServer()`) and pass it to the
  transport, so the default export is a server Vercel can consume.

`vercel.json` only adds a `maxDuration` bump and a `/` → `/index.html` redirect
for the landing page.

### Realtime-only (no Express)

If you don't need Express routes, still use `serverless()` — just omit the
`express` option. On Vercel a bare `gameServer.listen(port)` is **not** captured
(Vercel drives a default-exported server, not a listening one), so
`serverless()` + `export default` is the path either way.

## Why `serverless()`

`Server.serverless()` (added to `@colyseus/core`) does what `listen()` does —
`matchMaker.accept()` + bind the matchmaking/HTTP routes — but **without binding
a port**, and returns the underlying `http.Server`. It also pre-reads request
bodies into `req.body` so matchmaking `POST`s work under the `export default`
path (Vercel doesn't drain the router's lazy request stream there).

## Local dev

```bash
npm install
npm run dev          # Colyseus on http://localhost:2567

npx serve public     # serve the client; it connects to ws://localhost:2567
```

Headless smoke test (join a room, exercise state sync + chat):

```bash
node test-client.mjs                                        # local
ENDPOINT="wss://your-app.vercel.app" node test-client.mjs   # deployed
```

## Caveats (Vercel + Colyseus 0.17, all verified)

1. **Single-instance only.** A room lives in one function instance's memory, and
   after matchmaking the client's WebSocket must reach the instance that owns the
   room (`matchMaker.getLocalRoomById`). Vercel can't sticky-route a WS to a
   specific instance by room, so this holds only while traffic stays on one warm
   Fluid instance. Demo-grade; real horizontal scale needs routing Vercel doesn't
   expose.

2. **WebSocket connections close at the function's `maxDuration`** — per Vercel's
   docs: *"WebSocket connections close when a Vercel Function reaches its maximum
   duration."* Set to `300s` here (Hobby's default/max; Pro/Enterprise allow up
   to 800s, 1800s extended). The client auto-reconnects via `onDrop`/`onReconnect`
   when this happens.

3. **The landing page is served via a redirect.** `vercel.json` redirects `/` →
   `/index.html` (a static file) so the bare domain serves the client page rather
   than Colyseus's root response.

4. **Per-deployment `*.vercel.app` URLs return 401** (Deployment Protection). Use
   the production alias to test, or disable protection in project settings.
