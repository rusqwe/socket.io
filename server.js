const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаём статические файлы из папки public/
app.use(express.static(path.join(__dirname, 'public')));

// Список комнат
const ROOMS = [
  { id: 'general', name: 'General' },
  { id: 'random', name: 'Random' },
  { id: 'test', name: 'Test' }
];

io.on('connection', (socket) => {
  console.log(`Подключился пользователь: ${socket.id}`);

  // Устанавливаем имя пользователя
  socket.on('set-username', (name) => {
    socket.username = name;
    console.log(`Имя пользователя: ${name} (${socket.id})`);
  });

  // Отправляем список доступных комнат
  socket.emit('rooms-list', ROOMS);

  // Вход в комнату
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Пользователь ${socket.id} вошёл в комнату: ${roomId}`);

    // Уведомляем остальных в комнате
    socket.to(roomId).emit('system-message', {
      text: `${socket.username || socket.id} вошёл в комнату`,
      room: roomId
    });

    // Отправляем обновлённый список участникам комнаты
    updateRoomMembers(roomId);
  });

  // Обработка сообщений чата
  socket.on('chat-message', ({ room, text }) => {
    console.log(`[${room}] ${socket.username || socket.id}: ${text}`);
    io.to(room).emit('chat-message', {
      username: socket.username || socket.id,
      text,
      room,
      timestamp: new Date().toISOString()
    });
  });

  // Индикатор набора текста
  socket.on('typing', ({ room }) => {
    socket.to(room).emit('user-typing', {
      username: socket.username || socket.id,
      room
    });
  });

  socket.on('stop-typing', ({ room }) => {
    socket.to(room).emit('user-stop-typing', {
      username: socket.username || socket.id,
      room
    });
  });

  // Покинуть комнату
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.roomId = null;
    console.log(`Пользователь ${socket.id} покинул комнату: ${roomId}`);
    updateRoomMembers(roomId, socket.id);
  });

  // Обработка отключения
  socket.on('disconnect', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('system-message', {
        text: `${socket.username || socket.id} покинул комнату`,
        room: socket.roomId
      });
      updateRoomMembers(socket.roomId, socket.id);
    }
    console.log(`Пользователь ${socket.id} отключился`);
  });
});

// Обновляем список участников комнаты (исключая socketId, если нужно)
function updateRoomMembers(roomId, excludeSocketId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  const members = room
    ? Array.from(room).map(id => {
      if (id === excludeSocketId) return null;
      const s = io.sockets.sockets.get(id);
      return s ? (s.username || id) : id;
    }).filter(Boolean)
    : [];
  io.to(roomId).emit('room-members', members);
}

// Запускаем сервер
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
