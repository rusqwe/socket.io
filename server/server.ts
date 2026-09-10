import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { Room, ChatMessage, SystemMessage, TypingEvent } from './types/messages.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  TypedSocket,
} from './types/events.js';
import {
  isValidUsername,
  isValidRoomId,
  isValidChatMessage,
  isValidTypingEvent,
} from './utils/validators.js';

// --- ES modules support in Node ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Константы ---
const ROOMS: Room[] = [
  { id: 'general', name: 'General' },
  { id: 'random', name: 'Random' },
  { id: 'test', name: 'Test' },
];
const ROOMS_MESSAGE: Record<string, Array<ChatMessage>> = {};
for (let index = 0; index < ROOMS.length; index++) {
  ROOMS_MESSAGE[ROOMS[index].id] = [];
}
// --- Express + Socket.IO ---
const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server);

// Раздаём статические файлы из папки public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Обработка подключений ---
io.on('connection', (socket: TypedSocket) => {
  console.log(`Подключился пользователь: ${socket.id}`);

  // Устанавливаем имя пользователя
  socket.on('set-username', (name: string, isReconnect?: boolean) => {
    if (!isValidUsername(name)) {
      console.warn(`Невалидное имя пользователя от ${socket.id}`);
      return;
    }
    socket.username = name.trim();
    socket.isReconnect = isReconnect ?? false;
    console.log(`Имя пользователя: ${socket.username} (${socket.id})${isReconnect ? ' (reconnect)' : ''}`);

    // Если это реконнект и пользователь уже в комнате — не шлём уведомления
    if (isReconnect && socket.roomId) {
      // Обновляем список участников без уведомлений
      updateRoomMembers(socket.roomId);
      return;
    }
  });

  // Отправляем список доступных комнат
  socket.emit('rooms-list', ROOMS);

  // Вход в комнату
  socket.on('join-room', (roomId: string) => {
    if (!isValidRoomId(roomId)) {
      console.warn(`Невалидный ID комнаты: ${roomId}`);
      return;
    }

    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Пользователь ${socket.id} вошёл в комнату: ${roomId}`);

    const username = socket.username || socket.id;

    // Если это реконнект — не шлём ложное уведомление "вошёл в комнату"
    if (socket.isReconnect) {
      socket.isReconnect = false;
      sendHistory(socket, roomId);
      updateRoomMembers(roomId);
      return;
    }

    // Отправляем историю сообщений при входе в комнату
    sendHistory(socket, roomId);

    // Уведомляем остальных в комнате
    socket.to(roomId).emit('system-message', {
      text: `${username} вошёл в комнату`,
      room: roomId,
    });

    // Отправляем обновлённый список участникам комнаты
    updateRoomMembers(roomId);
  });

  // Обработка сообщений чата
  socket.on('chat-message', (data: { room: string; text: string }) => {
    if (!isValidChatMessage(data)) {
      console.warn(`Невалидное сообщение от ${socket.id}:`, data);
      return;
    }

    const username = socket.username || socket.id;
    console.log(`[${data.room}] ${username}: ${data.text}`);

    const message: ChatMessage = {
      username,
      text: data.text,
      room: data.room,
      timestamp: new Date().toISOString(),
    };
    insertRoomsMessage(data.room, message);
    io.to(data.room).emit('chat-message', message);
  });

  // Индикатор набора текста
  socket.on('typing', (data: { room: string }) => {
    if (!isValidTypingEvent(data)) return;

    const username = socket.username || socket.id;
    const typingEvent: TypingEvent = { ...data, username };

    socket.to(data.room).emit('user-typing', typingEvent);
  });

  socket.on('stop-typing', (data: { room: string }) => {
    if (!isValidTypingEvent(data)) return;

    const username = socket.username || socket.id;
    const typingEvent: TypingEvent = { ...data, username };

    socket.to(data.room).emit('user-stop-typing', typingEvent);
  });

  // Покинуть комнату
  socket.on('leave-room', (roomId: string) => {
    if (!isValidRoomId(roomId)) return;

    socket.leave(roomId);
    socket.roomId = undefined;
    console.log(`Пользователь ${socket.id} покинул комнату: ${roomId}`);
    updateRoomMembers(roomId);
  });

  // Обработка отключения
  socket.on('disconnect', (reason: string) => {
    if (socket.roomId) {
      const username = socket.username || socket.id;
      socket.to(socket.roomId).emit('system-message', {
        text: `${username} покинул комнату`,
        room: socket.roomId,
      });
      updateRoomMembers(socket.roomId);
    }
    console.log(`Пользователь ${socket.id} отключился (${reason})`);
  });
});

/**
 * Обновляем список участников комнаты
 */
function updateRoomMembers(roomId: string, excludeSocketId?: string): void {
  const room = io.sockets.adapter.rooms.get(roomId);
  const members: string[] = room
    ? Array.from(room)
      .map((id: string) => {
        if (id === excludeSocketId) return null;
        const socket = io.sockets.sockets.get(id);
        return socket ? (socket.username || id) : id;
      })
      .filter(Boolean) as string[]
    : [];

  io.to(roomId).emit('room-members', members);
}
/**
 * Сохраняем сообщения для комнаты
 */
function insertRoomsMessage(roomId: string, message: ChatMessage): void {
  ROOMS_MESSAGE[roomId].push(message);
  if (ROOMS_MESSAGE[roomId].length > 50) {
    ROOMS_MESSAGE[roomId].shift();
  }
}

/**
 * Отправить историю сообщений комнате
 */
function sendHistory(socket: TypedSocket, roomId: string): void {
  const history = ROOMS_MESSAGE[roomId] ?? [];
  socket.emit('chat-history', history);
}
// --- Запуск сервера ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
