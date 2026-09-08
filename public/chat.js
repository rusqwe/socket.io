const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const messagesArea = document.getElementById('messages-area');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const roomTabs = document.getElementById('room-tabs');
const currentRoomName = document.getElementById('current-room-name');
const userBadge = document.getElementById('user-badge');
const typingIndicator = document.getElementById('typing-indicator');
const roomMembersEl = document.getElementById('room-members');
const connectionStatusEl = document.getElementById('connection-status');
const statusTextEl = connectionStatusEl.querySelector('.status-text');

let username = '';
let currentRoom = '';
let rooms = [];
let typingTimer = null;
let isTyping = false;

const socket = io();

// ===== Вход =====
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinChat();
});

function joinChat() {
  username = usernameInput.value.trim();
  if (!username) {
    usernameInput.focus();
    return;
  }
  loginScreen.style.display = 'none';
  chatScreen.style.display = 'flex';
  userBadge.textContent = username;

  // Отправляем имя на сервер
  socket.emit('set-username', username);
}

// ===== Список комнат =====
socket.on('rooms-list', (data) => {
  rooms = data;
  roomTabs.innerHTML = '';
  data.forEach(room => {
    const btn = document.createElement('button');
    btn.className = 'room-tab';
    btn.textContent = room.name;
    btn.addEventListener('click', () => switchRoom(room.id));
    roomTabs.appendChild(btn);
  });
});

// ===== Список участников =====
socket.on('room-members', (members) => {
  if (members.length === 0) {
    roomMembersEl.textContent = '';
    return;
  }
  roomMembersEl.innerHTML = `Участники: <span>${members.join(', ')}</span>`;
});

function switchRoom(roomId) {
  // Покидаем предыдущую комнату
  if (currentRoom) {
    socket.emit('leave-room', currentRoom);
  }
  currentRoom = roomId;
  const room = rooms.find(r => r.id === roomId);
  currentRoomName.textContent = room ? room.name : roomId;

  // Обновляем вкладки
  document.querySelectorAll('.room-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent === (room ? room.name : roomId));
  });

  // Очищаем сообщения
  messagesArea.innerHTML = '';

  // Подключаемся к комнате
  socket.emit('join-room', roomId);
}

// ===== Сообщения =====
socket.on('chat-message', (data) => {
  if (data.room !== currentRoom) return;
  appendMessage(data.username, data.text, data.timestamp, data.username === username);
});

socket.on('system-message', (data) => {
  if (data.room !== currentRoom) return;
  appendSystemMessage(data.text);
});

function appendMessage(username, text, timestamp, isOwn) {
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;

  let metaHTML = '';
  metaHTML += `<span class="username">${escapeHTML(username)}</span>`;
  if (timestamp) {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    metaHTML += `<span class="time">${time}</span>`;
  }
  if (metaHTML) {
    metaHTML = `<div class="meta">${metaHTML}</div>`;
  }

  div.innerHTML = metaHTML + `<div class="text">${escapeHTML(text)}</div>`;
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  if (!isOwn) document.getElementById('notification-sound').play();
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = text;
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ===== Отправка сообщения =====
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentRoom) return;
  if (!socket.connected) {
    appendSystemMessage('❌ Нет подключения к серверу');
    return;
  }
  socket.emit('chat-message', { room: currentRoom, text });
  messageInput.value = '';
  messageInput.focus();
  socket.emit('stop-typing', { room: currentRoom });
  isTyping = false;
}

// ===== Индикатор набора =====
messageInput.addEventListener('input', () => {
  if (!currentRoom) return;
  if (!isTyping) {
    socket.emit('typing', { room: currentRoom });
    isTyping = true;
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('stop-typing', { room: currentRoom });
    isTyping = false;
  }, 2000);
});

socket.on('user-typing', (data) => {
  if (data.room !== currentRoom) return;
  typingIndicator.textContent = `${data.username} печатает...`;
});

socket.on('user-stop-typing', (data) => {
  if (data.room !== currentRoom) return;
  typingIndicator.textContent = '';
});

// ===== Событие выхода из комнаты =====
socket.on('leave-room', (roomId) => {
  if (roomId === currentRoom) {
    messagesArea.innerHTML = '';
  }
});

// ===== Статус подключения =====
socket.on('disconnect', (reason) => {
  connectionStatusEl.classList.add('disconnected');
  statusTextEl.textContent = 'Отключено';
  messageInput.disabled = true;
  messageInput.placeholder = 'Нет подключения к серверу';
  roomMembersEl.innerHTML = '';
  appendSystemMessage('⚠️ Соединение с сервером потеряно');
});

socket.on('connect', () => {
  connectionStatusEl.classList.remove('disconnected');
  statusTextEl.textContent = 'Подключено';
  messageInput.disabled = false;
  messageInput.placeholder = 'Напишите сообщение...';
  appendSystemMessage('✅ Подключено, выберите команту');

  // Повторно отправляем имя при переподключении
  if (username) {
    socket.emit('set-username', username);
    if (currentRoom) {
      socket.emit('join-room', currentRoom);
    }
  }
});

// ===== Вспомогательные функции =====
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
