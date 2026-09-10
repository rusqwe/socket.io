// ===== DOM-элементы =====
interface ChatElements {
  loginScreen: HTMLDivElement;
  chatScreen: HTMLDivElement;
  usernameInput: HTMLInputElement;
  joinBtn: HTMLButtonElement;
  messagesArea: HTMLDivElement;
  messageInput: HTMLInputElement;
  sendBtn: HTMLButtonElement;
  roomTabs: HTMLDivElement;
  currentRoomName: HTMLHeadingElement;
  userBadge: HTMLDivElement;
  typingIndicator: HTMLDivElement;
  roomMembersEl: HTMLDivElement;
  connectionStatusEl: HTMLDivElement;
  statusTextEl: HTMLSpanElement;
}

function getElements(): ChatElements {
  return {
    loginScreen: document.getElementById('login-screen') as HTMLDivElement,
    chatScreen: document.getElementById('chat-screen') as HTMLDivElement,
    usernameInput: document.getElementById('username-input') as HTMLInputElement,
    joinBtn: document.getElementById('join-btn') as HTMLButtonElement,
    messagesArea: document.getElementById('messages-area') as HTMLDivElement,
    messageInput: document.getElementById('message-input') as HTMLInputElement,
    sendBtn: document.getElementById('send-btn') as HTMLButtonElement,
    roomTabs: document.getElementById('room-tabs') as HTMLDivElement,
    currentRoomName: document.querySelector('#current-room-name') as HTMLHeadingElement,
    userBadge: document.getElementById('user-badge') as HTMLDivElement,
    typingIndicator: document.getElementById('typing-indicator') as HTMLDivElement,
    roomMembersEl: document.getElementById('room-members') as HTMLDivElement,
    connectionStatusEl: document.getElementById('connection-status') as HTMLDivElement,
    statusTextEl: document.querySelector('.status-text') as HTMLSpanElement,
  };
}

// ===== Типы для событий Socket.IO =====
interface Room {
  id: string;
  name: string;
}

interface ChatMessage {
  username: string;
  text: string;
  room: string;
  timestamp: string;
}

interface SystemMessage {
  text: string;
  room: string;
}

interface TypingEvent {
  username?: string;
  room: string;
}

// ===== Состояние =====
let username = '';
let currentRoom = '';
let rooms: Room[] = [];
let typingTimer: ReturnType<typeof setTimeout> | null = null;
let isTyping = false;

// ===== Подключение =====
// @ts-ignore: socket.io клиент глобально доступен через CDN
const socket = io();

// ===== Инициализация =====
const el = getElements();

// ===== Вход =====
el.joinBtn.addEventListener('click', joinChat);
el.usernameInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') joinChat();
});

function joinChat(): void {
  username = el.usernameInput.value.trim();
  if (!username) {
    el.usernameInput.focus();
    return;
  }
  el.loginScreen.style.display = 'none';
  el.chatScreen.style.display = 'flex';
  el.userBadge.textContent = username;

  // Отправляем имя на сервер
  socket.emit('set-username', username);
}

// ===== Список комнат =====
socket.on('rooms-list', (data: Room[]) => {
  rooms = data;
  el.roomTabs.innerHTML = '';
  data.forEach((room: Room) => {
    const btn = document.createElement('button');
    btn.className = 'room-tab' + (room.id === currentRoom ? ' active' : '');
    btn.textContent = room.name;
    btn.addEventListener('click', () => switchRoom(room.id));
    el.roomTabs.appendChild(btn);
  });
});

// ===== Список участников =====
socket.on('room-members', (members: string[]) => {
  if (members.length === 0) {
    el.roomMembersEl.textContent = '';
    return;
  }
  el.roomMembersEl.innerHTML = `Участники: <span>${members.join(', ')}</span>`;
});

function switchRoom(roomId: string): void {
  // Покидаем предыдущую комнату
  if (currentRoom) {
    socket.emit('leave-room', currentRoom);
  }
  currentRoom = roomId;
  const room = rooms.find((r) => r.id === roomId);
  el.currentRoomName.textContent = room ? room.name : roomId;

  // Обновляем вкладки
  document.querySelectorAll('.room-tab').forEach((tab) => {
    (tab as HTMLButtonElement).classList.toggle(
      'active',
      (tab as HTMLButtonElement).textContent === (room ? room.name : roomId)
    );
  });

  // Очищаем сообщения
  el.messagesArea.innerHTML = '';

  // Подключаемся к комнате
  socket.emit('join-room', roomId);
}

// ===== Сообщения =====
socket.on('chat-message', (data: ChatMessage) => {
  if (data.room !== currentRoom) return;
  appendMessage(data.username, data.text, data.timestamp, data.username === username);
});

socket.on('chat-history', (messages: ChatMessage[]) => {
  messages.forEach((msg) => {
    appendMessage(msg.username, msg.text, msg.timestamp, msg.username === username);
  });
});

socket.on('system-message', (data: SystemMessage) => {
  if (data.room !== currentRoom) return;
  appendSystemMessage(data.text);
});

function appendMessage(
  username: string,
  text: string,
  timestamp: string | undefined,
  isOwn: boolean
): void {
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;

  let metaHTML = '';
  metaHTML += `<span class="username">${escapeHTML(username)}</span>`;
  if (timestamp) {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    metaHTML += `<span class="time">${time}</span>`;
  }
  if (metaHTML) {
    metaHTML = `<div class="meta">${metaHTML}</div>`;
  }

  div.innerHTML = metaHTML + `<div class="text">${escapeHTML(text)}</div>`;
  el.messagesArea.appendChild(div);
  el.messagesArea.scrollTop = el.messagesArea.scrollHeight;

  if (!isOwn) {
    const audio = document.getElementById('notification-sound') as HTMLAudioElement;
    if (audio) audio.play().catch(() => { });
  }
}

function appendSystemMessage(text: string): void {
  const div = document.createElement('div');
  div.className = 'system-message';
  div.textContent = text;
  el.messagesArea.appendChild(div);
  el.messagesArea.scrollTop = el.messagesArea.scrollHeight;
}

// ===== Отправка сообщения =====
el.sendBtn.addEventListener('click', sendMessage);
el.messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage(): void {
  const text = el.messageInput.value.trim();
  if (!text || !currentRoom) return;
  if (!socket.connected) {
    appendSystemMessage('❌ Нет подключения к серверу');
    return;
  }
  socket.emit('chat-message', { room: currentRoom, text });
  el.messageInput.value = '';
  el.messageInput.focus();
  socket.emit('stop-typing', { room: currentRoom });
  isTyping = false;
}

// ===== Индикатор набора =====
el.messageInput.addEventListener('input', () => {
  if (!currentRoom) return;
  if (!isTyping) {
    socket.emit('typing', { room: currentRoom });
    isTyping = true;
  }
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('stop-typing', { room: currentRoom });
    isTyping = false;
  }, 2000);
});

socket.on('user-typing', (data: TypingEvent) => {
  if (data.room !== currentRoom) return;
  el.typingIndicator.textContent = `${data.username || data.room} печатает...`;
});

socket.on('user-stop-typing', (data: TypingEvent) => {
  if (data.room !== currentRoom) return;
  el.typingIndicator.textContent = '';
});

// ===== Событие выхода из комнаты =====
socket.on('leave-room', (roomId: string) => {
  if (roomId === currentRoom) {
    el.messagesArea.innerHTML = '';
  }
});

// ===== Статус подключения =====
socket.on('disconnect', (_reason: string) => {
  el.connectionStatusEl.classList.add('disconnected');
  el.statusTextEl.textContent = 'Отключено';
  el.messageInput.disabled = true;
  el.messageInput.placeholder = 'Нет подключения к серверу';
  el.roomMembersEl.innerHTML = '';
  appendSystemMessage('⚠️ Соединение с сервером потеряно');
});

socket.on('connect', () => {
  const wasConnected = el.connectionStatusEl.classList.contains('disconnected');
  el.connectionStatusEl.classList.remove('disconnected');
  el.statusTextEl.textContent = 'Подключено';
  el.messageInput.disabled = false;
  el.messageInput.placeholder = 'Напишите сообщение...';

  if (wasConnected) {
    appendSystemMessage('✅ Переподключено');
  } else {
    appendSystemMessage('✅ Подключено');
  }

  // Повторно отправляем имя при переподключении
  if (username) {
    socket.emit('set-username', username, true);
    if (currentRoom) {
      socket.emit('join-room', currentRoom);
    }
  }
});

// ===== Вспомогательные функции =====
function escapeHTML(str: string | undefined | null): string {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
