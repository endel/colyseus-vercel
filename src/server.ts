import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MyRoom } from "./rooms/MyRoom";

const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  // Express HTTP routes alongside Colyseus realtime
  express: (app) => {
    app.get("/hello", (_req, res) => res.json({ hello: true }));
    app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  },
});
gameServer.define("my_room", MyRoom);

// serverless(): set up matchmaking + routes WITHOUT binding a port; return the
// http.Server for Vercel to consume via the default export.
const server = await gameServer.serverless();

// Local dev only: serverless() doesn't listen (Vercel drives the default export).
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 2567;
  server.listen(port, () => console.log(`⚔️  Colyseus listening on :${port}`));
}

export default server;
