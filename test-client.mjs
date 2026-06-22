import { Client, getStateCallbacks } from "@colyseus/sdk";

const endpoint = process.env.ENDPOINT || "ws://localhost:2567";
const client = new Client(endpoint);

const room = await client.joinOrCreate("my_room", { name: "tester" });
console.log("✅ joined", room.roomId, "as", room.sessionId);

const $ = getStateCallbacks(room);
$(room.state).players.onAdd((player, sessionId) => {
  console.log("👤 player add:", sessionId, "→", JSON.stringify({ name: player.name, x: player.x, y: player.y, color: player.color }));
  $(player).onChange(() => {
    console.log("✏️  player change:", sessionId, "→", { x: player.x, y: player.y });
  });
});
$(room.state).players.onRemove((_p, sid) => console.log("👋 player remove:", sid));

room.onMessage("chat", (m) => console.log("💬 chat:", m));

// exercise messages + state mutation
setTimeout(() => room.send("move", { x: 123, y: 456 }), 300);
setTimeout(() => room.send("chat", "hello from headless client"), 600);
setTimeout(() => {
  console.log("🔎 final state players count:", room.state.players.size);
  room.leave();
  setTimeout(() => process.exit(0), 200);
}, 1200);
