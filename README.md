# Colyseus on Vercel

A minimal [Colyseus](https://colyseus.io) **0.17** multiplayer app running on
[Vercel's WebSocket support](https://vercel.com/changelog/websocket-support-is-now-in-public-beta)
(public beta). Move a dot, chat, and watch state sync in realtime across tabs.

- **Server:** `colyseus@0.17` + `@colyseus/ws-transport`
- **Client:** `@colyseus/sdk@0.17` (loaded from a CDN in `public/index.html`)
- **Host:** Vercel Functions on Fluid compute

👉 Live: https://vercel-psi-ten-36.vercel.app

## How it works on Vercel

Vercel turns a Node.js HTTP server into a Function when the entrypoint is named
`server.ts` (root or `src/`) and calls `listen()` during module startup. It then
routes HTTP requests **and** WebSocket upgrades to that server through an
internal port (the port you pass to `listen()` only matters locally).

There's one catch that makes a stock `gameServer.listen()` fail (see caveat #1),
so `src/server.ts` listens synchronously itself and lets Colyseus bind its routes
afterward. WebSockets need no extra config; the only `vercel.json` entries are a
`maxDuration` bump and a redirect for the landing page.

## Local dev

```bash
npm install
npm run dev          # Colyseus on http://localhost:2567

# serve the client and open it
npx serve public     # then visit the printed URL (connects to ws://localhost:2567)
```

Headless smoke test (joins a room, exercises state sync + chat):

```bash
node test-client.mjs                                        # local
ENDPOINT="wss://your-app.vercel.app" node test-client.mjs   # deployed
```

## Deploy

```bash
npx vercel deploy --prod
```

## Caveats (Vercel + Colyseus 0.17, all verified)

1. **Vercel only captures the server if `listen()` is called _synchronously_ at
   module startup.** Colyseus calls `server.listen()` _asynchronously_ — after
   `await matchMaker.accept()` — so Vercel never captures it and every request
   504s. Worse, Colyseus uses the 4-arg `listen(port, host, backlog, cb)` form,
   which Vercel doesn't fire the callback for either. `src/server.ts` works around
   both: it `listen()`s the transport's server synchronously, and patches
   `http.Server.prototype.listen` so Colyseus's later call doesn't re-listen but
   still runs its callback (where the matchmaking routes get bound). Once routing
   is wired, matchmaking (`POST /matchmake`, with body) and the WS upgrade work
   normally.

2. **Single-instance only.** A room lives in one function instance's memory, and
   after matchmaking the client's WebSocket must reach the instance that owns the
   room (`matchMaker.getLocalRoomById`). Vercel can't sticky-route a WS to a
   specific instance by room, so this holds only while traffic stays on one warm
   Fluid instance. Demo-grade; real horizontal scale needs routing Vercel doesn't
   expose.

3. **WebSocket connections close at the function's `maxDuration`** (set to 300s in
   `vercel.json`). Clients should reconnect on close and reload state.

4. **The landing page is served via a redirect.** Colyseus owns `/` (it returns a
   version string), so `vercel.json` redirects `/` → `/index.html` (a static
   file). A `rewrite` doesn't work here because the captured Node server claims
   `/` before the rewrite resolves.

5. **Per-deployment `*.vercel.app` URLs return 401** (Deployment Protection). Use
   the production alias to test, or disable protection in project settings.
