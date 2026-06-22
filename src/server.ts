import { Server as HttpServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MyRoom } from "./rooms/MyRoom";

const port = Number(process.env.PORT) || 2567;

// Vercel only captures the HTTP server when listen() is called SYNCHRONOUSLY
// during module startup. Colyseus calls server.listen() asynchronously (after
// `await matchMaker.accept()`), so Vercel never captures it and every request
// 504s. Work around it by:
//   (a) listening synchronously ourselves below (so Vercel captures the server), and
//   (b) patching listen() so Colyseus's later async call doesn't re-listen, but
//       still runs its callback — which is where Colyseus binds the matchmaking routes.
let didListen = false;
const _listen = HttpServer.prototype.listen;
HttpServer.prototype.listen = function (this: HttpServer, ...args: unknown[]) {
  const cb = args.find((a) => typeof a === "function") as (() => void) | undefined;
  if (didListen) {
    if (cb) (this.listening ? cb() : this.once("listening", cb));
    return this;
  }
  didListen = true;
  return (_listen as (...a: unknown[]) => HttpServer).apply(this, args.filter((a) => a !== undefined));
};

const transport = new WebSocketTransport();

// synchronous capture: the transport created its own http.Server in its constructor
(transport as unknown as { server: HttpServer }).server.listen(port);

const gameServer = new Server({ transport });
gameServer.define("my_room", MyRoom);

// runs matchMaker.accept() then binds matchmaking routes via the patched callback
gameServer.listen(port);

console.log(`⚔️  Colyseus listening on :${port}`);
