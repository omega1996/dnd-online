import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

// В памяти: roomCode -> { createdAt, members: Map(socketId -> {name}), state }
const rooms = new Map();

function createRoomState() {
  return {
    version: 1,
    map: { src: null, grid: { size: 50, enabled: true } },
    tokens: {}, // tokenId -> { id, x, y, src, name, ownerId }
    meta: { createdAt: Date.now() },
  };
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без O/0/1/I
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/rooms", (req, res) => {
  // Создание комнаты по HTTP, чтобы клиент мог получить код без сокета
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();

  rooms.set(code, {
    createdAt: Date.now(),
    members: new Map(),
    state: createRoomState(),
  });
  res.json({ code });
});

io.on("connection", (socket) => {
  socket.on("room:join", ({ code, name }, ack) => {
    if (!rooms.has(code)) {
      ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }

    const room = rooms.get(code);
    room.members.set(socket.id, { name: name?.trim() || "Player" });

    socket.join(code);
    socket.data.roomCode = code;

    const members = [...room.members.entries()].map(([id, m]) => ({
      id,
      name: m.name
    }));

    // ответ присоединившемуся
    ack?.({ ok: true, code, me: socket.id, members, state: room.state });

    // обновление для всех в комнате
    io.to(code).emit("room:members", { members });
  });

  socket.on("room:action", ({ action, payload }, ack) => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      ack?.({ ok: false, error: "NOT_IN_ROOM" });
      return;
    }

    const room = rooms.get(code);

    // Применяем действие к состоянию (пока просто обновляем версию)
    // В будущем здесь будет логика обработки разных типов действий
    room.state.version += 1;

    // Отправляем обновленное состояние всем в комнате
    io.to(code).emit("room:state", { state: room.state });

    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) return;

    const room = rooms.get(code);
    room.members.delete(socket.id);

    // если никого не осталось — удаляем комнату
    if (room.members.size === 0) {
      rooms.delete(code);
      return;
    }

    const members = [...room.members.entries()].map(([id, m]) => ({
      id,
      name: m.name
    }));
    io.to(code).emit("room:members", { members });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
