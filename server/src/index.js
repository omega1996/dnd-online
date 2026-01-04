import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
// Allow requests from frontend domain and localhost for development
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://dnd.omegasoft.keenetic.name',
      'http://localhost',
      'http://localhost:80',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];

// CORS middleware - set headers for all requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  // Try to determine origin from referer if origin header is missing
  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      const refererUrl = new URL(referer);
      requestOrigin = refererUrl.origin;
    } catch (e) {
      // Ignore
    }
  }
  
  // Default to allowing frontend domain if origin is missing
  const defaultOrigin = 'https://dnd.omegasoft.keenetic.name';
  
  if (requestOrigin && allowedOrigins.indexOf(requestOrigin) !== -1) {
    console.log(`[CORS] Request from origin: ${requestOrigin} - allowing`);
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!requestOrigin) {
    // If no origin header, set default allowed origin for browser compatibility
    console.log(`[CORS] Request with no origin header - setting default origin: ${defaultOrigin}`);
    res.setHeader('Access-Control-Allow-Origin', defaultOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (process.env.NODE_ENV !== 'production') {
    // Development mode - allow any origin
    console.log(`[CORS] Development mode - allowing origin ${requestOrigin}`);
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    console.log(`[CORS] Origin ${requestOrigin} is NOT allowed`);
    // Still set headers to avoid browser blocking, but use default origin
    res.setHeader('Access-Control-Allow-Origin', defaultOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  // Set other CORS headers
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling preflight request');
    res.status(204).end();
    return;
  }
  
  next();
});

app.use(express.json());

// Создаем папку для загрузок если её нет
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `token-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB максимум
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только изображения
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Настройка multer для загрузки карт
const mapStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `map-${uniqueSuffix}${ext}`);
  }
});

const uploadMap = multer({
  storage: mapStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB максимум для карт (они могут быть больше)
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только изображения
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Статическая раздача загруженных файлов с CORS
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for static files
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
}, express.static(uploadsDir));

const server = http.createServer(app);

// Socket.io CORS configuration
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        // For development, allow any origin
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// В памяти: roomCode -> { createdAt, members: Map(socketId -> {name}), state, gmId }
const rooms = new Map();

function createRoomState() {
  return {
    version: 1,
    map: { src: null, grid: { rows: 10, columns: 10, enabled: true } },
    tokens: {}, // tokenId -> { id, gridX, gridY, src, name, ownerId, characterId, hitPoints, hidden }
    logs: [], // Массив логов: [{ id, type, timestamp, data, userId, userName }]
    meta: { createdAt: Date.now() },
  };
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без O/0/1/I
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/**
 * Проверяет права пользователя на выполнение действия
 * @param {Object} room - объект комнаты
 * @param {Object} action - действие { type, payload }
 * @param {string} socketId - ID сокета отправителя
 * @returns {boolean} true если есть права
 */
function hasPermission(room, action, socketId) {
  const isGM = room.gmId === socketId;
  
  // GM может всё
  if (isGM) {
    return true;
  }
  
  // Player может только ограниченные действия
  const { type, payload } = action;
  
  switch (type) {
    case "MAP_SET":
      // Player не может менять карту
      return false;

    case "TOKEN_ADD":
      // Player может добавлять токены (они будут с его ownerId)
      // Но если это NPC токен (isNPC = true), только GM может добавить его
      if (payload && payload.isNPC === true) {
        return isGM;
      }
      return true;

    case "TOKEN_MOVE":
    case "TOKEN_UPDATE":
    case "TOKEN_HIDE":
    case "TOKEN_SHOW":
      // Player может двигать/обновлять/скрывать/показывать только свои токены
      // NPC токенами может управлять только GM
      if (!payload || !payload.id) return false;
      const token = room.state.tokens[payload.id];
      if (!token) return false;
      // Если это NPC токен, только GM может управлять им
      if (token.isNPC) {
        return isGM;
      }
      return token.ownerId === socketId;

    case "TOKEN_REMOVE":
      // Player может удалять только свои токены
      // NPC токены может удалять только GM
      if (!payload || !payload.id) return false;
      const tokenToRemove = room.state.tokens[payload.id];
      if (!tokenToRemove) return false;
      // Если это NPC токен, только GM может удалить его
      if (tokenToRemove.isNPC) {
        return isGM;
      }
      return tokenToRemove.ownerId === socketId;

    case "DICE_ROLL":
    case "DICE_ROLL_CUSTOM":
      // Все могут бросать кубики
      return true;

    default:
      return false;
  }
}

/**
 * Создает лог действия
 * @param {Object} room - объект комнаты
 * @param {string} type - тип лога (move, dice, map_change)
 * @param {Object} data - данные лога
 * @param {string} userId - ID пользователя
 * @param {string} userName - имя пользователя
 */
function addLog(room, type, data, userId, userName) {
  const log = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    timestamp: Date.now(),
    data,
    userId,
    userName,
  };
  room.state.logs.unshift(log); // Добавляем в начало массива (новые сверху)
  // Ограничиваем количество логов (например, последние 100)
  if (room.state.logs.length > 100) {
    room.state.logs = room.state.logs.slice(0, 100);
  }
}

/**
 * Применяет действие к состоянию комнаты
 * @param {Object} room - объект комнаты
 * @param {Object} action - действие { type, payload }
 * @param {Object} socket - сокет отправителя (для проверки прав в будущем)
 * @returns {Object} { ok: boolean, error?: string }
 */
function applyAction(room, action, socket) {
  if (!action || !action.type) {
    return { ok: false, error: "INVALID_ACTION" };
  }

  // Проверка прав
  if (!hasPermission(room, action, socket.id)) {
    return { ok: false, error: "PERMISSION_DENIED" };
  }

  const { type, payload } = action;
  const member = room.members.get(socket.id);
  const userName = member?.name || "Unknown";

  switch (type) {
    case "MAP_SET": {
      if (!payload) {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      const oldMapSrc = room.state.map.src;
      // Обновляем src только если он передан
      if (payload.src !== undefined) {
        if (typeof payload.src !== "string" && payload.src !== null) {
          return { ok: false, error: "INVALID_PAYLOAD" };
        }
        room.state.map.src = payload.src;
      }
      // Обновляем параметры сетки
      if (payload.grid) {
        if (typeof payload.grid.rows === "number") {
          room.state.map.grid.rows = payload.grid.rows;
        }
        if (typeof payload.grid.columns === "number") {
          room.state.map.grid.columns = payload.grid.columns;
        }
        if (typeof payload.grid.enabled === "boolean") {
          room.state.map.grid.enabled = payload.grid.enabled;
        }
      }
      // При загрузке новой карты сбрасываем все токены на позицию 0,0
      // Но только если карта действительно изменилась
      if (payload.src !== undefined && oldMapSrc !== payload.src) {
        for (const tokenId in room.state.tokens) {
          room.state.tokens[tokenId].gridX = 0;
          room.state.tokens[tokenId].gridY = 0;
        }
        // Добавляем лог смены карты
        addLog(
          room,
          "map_change",
          {
            mapSrc: payload.src,
            grid: room.state.map.grid,
          },
          socket.id,
          userName
        );
      }
      break;
    }

    case "TOKEN_ADD": {
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      if (room.state.tokens[payload.id]) {
        return { ok: false, error: "TOKEN_EXISTS" };
      }
      const token = {
        id: payload.id,
        gridX: payload.gridX ?? 0,
        gridY: payload.gridY ?? 0,
        src: payload.src ?? null,
        name: payload.name ?? "Token",
        ownerId: payload.ownerId ?? socket.id,
        characterId: payload.characterId ?? null, // ID персонажа, если токен связан с персонажем
        npcId: payload.npcId ?? null, // ID NPC шаблона, если токен связан с NPC
        isNPC: payload.isNPC ?? false, // Флаг, что это NPC токен
        hitPoints: payload.hitPoints ?? null, // Текущие hit points токена
        hidden: payload.hidden ?? false, // Скрыт ли токен
      };
      room.state.tokens[payload.id] = token;
      // Добавляем лог добавления токена
      addLog(
        room,
        "token_add",
        {
          tokenId: token.id,
          tokenName: token.name,
          position: { x: token.gridX, y: token.gridY },
          isNPC: token.isNPC,
        },
        socket.id,
        userName
      );
      break;
    }

    case "TOKEN_MOVE": {
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      const token = room.state.tokens[payload.id];
      if (!token) {
        return { ok: false, error: "TOKEN_NOT_FOUND" };
      }
      const oldX = token.gridX;
      const oldY = token.gridY;
      if (typeof payload.gridX === "number") {
        token.gridX = payload.gridX;
      }
      if (typeof payload.gridY === "number") {
        token.gridY = payload.gridY;
      }
      // Добавляем лог перемещения только если позиция изменилась
      if (token.gridX !== oldX || token.gridY !== oldY) {
        addLog(
          room,
          "move",
          {
            tokenId: token.id,
            tokenName: token.name,
            from: { x: oldX, y: oldY },
            to: { x: token.gridX, y: token.gridY },
          },
          socket.id,
          userName
        );
      }
      break;
    }

    case "TOKEN_UPDATE": {
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      const token = room.state.tokens[payload.id];
      if (!token) {
        return { ok: false, error: "TOKEN_NOT_FOUND" };
      }
      if (payload.name !== undefined) {
        token.name = payload.name;
      }
      if (payload.src !== undefined) {
        token.src = payload.src;
      }
      if (payload.ownerId !== undefined) {
        token.ownerId = payload.ownerId;
      }
      if (payload.characterId !== undefined) {
        token.characterId = payload.characterId;
      }
      if (payload.npcId !== undefined) {
        token.npcId = payload.npcId;
      }
      if (payload.isNPC !== undefined) {
        token.isNPC = payload.isNPC;
      }
      if (payload.hitPoints !== undefined) {
        // Сохраняем старые hitPoints для логирования
        const oldHP = token.hitPoints !== null && token.hitPoints !== undefined ? token.hitPoints : 0;
        const newHP = payload.hitPoints;
        token.hitPoints = newHP;
        
        // Вычисляем нанесенный урон
        const damageDealt = oldHP - newHP;
        
        // Если это NPC и HP стал 0 или меньше, удаляем токен
        if (token.isNPC && newHP <= 0) {
          // Сохраняем информацию о токене перед удалением для лога
          const tokenName = token.name;
          const tokenId = token.id;
          const tokenPosition = { x: token.gridX || 0, y: token.gridY || 0 };
          delete room.state.tokens[tokenId];
          
          // Добавляем лог об удалении NPC токена
          addLog(
            room,
            "token_remove",
            {
              tokenId: tokenId,
              tokenName: tokenName,
              position: tokenPosition,
              reason: "NPC defeated (HP = 0)",
            },
            socket.id,
            userName
          );
          
          // Выходим из обработки, так как токен уже удален
          break;
        }
        
        // Добавляем лог о нанесении урона
        if (damageDealt > 0) {
          addLog(
            room,
            "token_damage",
            {
              tokenId: token.id,
              tokenName: token.name,
              damage: damageDealt,
              oldHP: oldHP,
              newHP: newHP,
              isUnconscious: newHP === 0,
              isNPC: token.isNPC,
            },
            socket.id,
            userName
          );
        }
      }
      if (payload.hidden !== undefined) {
        token.hidden = payload.hidden;
      }
      if (typeof payload.gridX === "number") {
        token.gridX = payload.gridX;
      }
      if (typeof payload.gridY === "number") {
        token.gridY = payload.gridY;
      }
      break;
    }

    case "TOKEN_HIDE": {
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      const token = room.state.tokens[payload.id];
      if (!token) {
        return { ok: false, error: "TOKEN_NOT_FOUND" };
      }
      token.hidden = true;
      // Добавляем лог скрытия токена с именем персонажа
      addLog(
        room,
        "token_hide",
        {
          tokenId: token.id,
          tokenName: token.name,
        },
        socket.id,
        userName
      );
      break;
    }

    case "TOKEN_SHOW": {
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      const token = room.state.tokens[payload.id];
      if (!token) {
        return { ok: false, error: "TOKEN_NOT_FOUND" };
      }
      token.hidden = false;
      // Добавляем лог показа токена
      addLog(
        room,
        "token_show",
        {
          tokenId: token.id,
          tokenName: token.name,
        },
        socket.id,
        userName
      );
      break;
    }

    case "TOKEN_REMOVE": {
      if (!payload || !payload.id || typeof payload.id !== "string") {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      const token = room.state.tokens[payload.id];
      if (!token) {
        return { ok: false, error: "TOKEN_NOT_FOUND" };
      }
      // Сохраняем информацию о токене перед удалением для лога
      const tokenInfo = {
        tokenId: token.id,
        tokenName: token.name,
        position: { x: token.gridX, y: token.gridY },
      };
      delete room.state.tokens[payload.id];
      // Добавляем лог удаления токена
      addLog(room, "token_remove", tokenInfo, socket.id, userName);
      break;
    }

    case "DICE_ROLL": {
      if (
        !payload ||
        typeof payload.sides !== "number" ||
        typeof payload.result !== "number"
      ) {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      // Определяем критический результат для D20
      let criticalType = null;
      if (payload.sides === 20) {
        if (payload.result === 1) {
          criticalType = "failure"; // Критическая неудача
        } else if (payload.result === 20) {
          criticalType = "success"; // Критическая удача
        }
      }
      // Добавляем лог броска кубика
      addLog(
        room,
        "dice",
        {
          diceType: `D${payload.sides}`,
          result: payload.result,
          sides: payload.sides,
          criticalType: criticalType,
        },
        socket.id,
        userName
      );
      break;
    }

    case "DICE_ROLL_CUSTOM": {
      if (
        !payload ||
        !Array.isArray(payload.dice) ||
        !Array.isArray(payload.results) ||
        typeof payload.modifier !== "number" ||
        typeof payload.sum !== "number" ||
        typeof payload.description !== "string"
      ) {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      // Проверяем, что количество кубиков соответствует количеству результатов
      if (payload.dice.length !== payload.results.length) {
        return { ok: false, error: "INVALID_PAYLOAD" };
      }
      // Добавляем лог кастомного броска кубика
      addLog(
        room,
        "dice_custom",
        {
          dice: payload.dice,
          results: payload.results,
          modifier: payload.modifier,
          sum: payload.sum,
          description: payload.description,
        },
        socket.id,
        userName
      );
      break;
    }

    default:
      return { ok: false, error: "UNKNOWN_ACTION_TYPE" };
  }

  // Увеличиваем версию после успешного применения
  room.state.version += 1;

  return { ok: true };
}

app.get("/health", (req, res) => res.json({ ok: true }));

// Endpoint для загрузки изображений токенов
app.post("/upload-token-image", upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  
  // Возвращаем URL для доступа к файлу
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ 
    ok: true, 
    url: fileUrl,
    filename: req.file.filename
  });
});

// Endpoint для загрузки изображений карт
app.post("/upload-map-image", uploadMap.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  
  // Возвращаем URL для доступа к файлу
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ 
    ok: true, 
    url: fileUrl,
    filename: req.file.filename
  });
});

app.post("/rooms", (req, res) => {
  // Создание комнаты по HTTP, чтобы клиент мог получить код без сокета
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();

  rooms.set(code, {
    createdAt: Date.now(),
    members: new Map(),
    state: createRoomState(),
    gmId: null, // будет установлен при первом присоединении
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
    
    // Если комната пустая (нет GM), первый присоединившийся становится GM
    if (!room.gmId && room.members.size === 0) {
      room.gmId = socket.id;
    }
    
    room.members.set(socket.id, { name: name?.trim() || "Player" });

    socket.join(code);
    socket.data.roomCode = code;

    // Определяем роль пользователя
    const role = room.gmId === socket.id ? "GM" : "Player";

    const members = [...room.members.entries()].map(([id, m]) => ({
      id,
      name: m.name,
      role: id === room.gmId ? "GM" : "Player"
    }));

    // ответ присоединившемуся
    ack?.({ ok: true, code, me: socket.id, role, members, state: room.state });

    // обновление для всех в комнате
    io.to(code).emit("room:members", { members });
  });

  socket.on("room:action", ({ action }, ack) => {
    const code = socket.data.roomCode;
    if (!code || !rooms.has(code)) {
      ack?.({ ok: false, error: "NOT_IN_ROOM" });
      return;
    }

    const room = rooms.get(code);

    // Применяем действие к состоянию
    const result = applyAction(room, action, socket);
    if (!result.ok) {
      ack?.(result);
      return;
    }

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
      name: m.name,
      role: id === room.gmId ? "GM" : "Player"
    }));
    io.to(code).emit("room:members", { members });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
