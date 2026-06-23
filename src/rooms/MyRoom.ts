import { Room, Client, CloseCode } from "@colyseus/core";
import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") name: string = "anon";
  @type("number") x: number = Math.floor(Math.random() * 800);
  @type("number") y: number = Math.floor(Math.random() * 600);
  @type("string") color: string = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  @type("boolean") connected: boolean = true;
}

export class MyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("number") createdAt: number = Date.now();
}

export class MyRoom extends Room<{ state: MyState }> {
  // single room shared by everyone, so a Vercel demo keeps all clients together
  maxClients = 50;

  onCreate() {
    this.autoDispose = false; // keep the room warm even when empty
    this.state = new MyState();

    this.onMessage("move", (client, { x, y }: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.x = x;
      player.y = y;
    });

    this.onMessage("chat", (client, text: string) => {
      const player = this.state.players.get(client.sessionId);
      this.broadcast("chat", { name: player?.name ?? "anon", text });
    });

    console.log("room created:", this.roomId);
  }

  onJoin(client: Client, options: { name?: string }) {
    const player = new Player();
    if (options?.name) player.name = options.name;
    this.state.players.set(client.sessionId, player);
    console.log(client.sessionId, "joined as", player.name, "→", this.clients.length, "online");
  }

  async onLeave(client: Client, code: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // intentional leave (client called room.leave()) → remove right away
    if (code === CloseCode.CONSENTED) {
      this.state.players.delete(client.sessionId);
      console.log(client.sessionId, "left (consented)");
      return;
    }

    // unexpected drop → keep the seat and let the client reconnect within 30s
    player.connected = false;
    console.log(client.sessionId, "dropped → awaiting reconnection (30s)");
    try {
      await this.allowReconnection(client, 30);
      player.connected = true;
      console.log(client.sessionId, "reconnected");
    } catch {
      this.state.players.delete(client.sessionId);
      console.log(client.sessionId, "did not reconnect → removed");
    }
  }
}
