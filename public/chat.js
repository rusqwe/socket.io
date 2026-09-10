"use strict";
function getElements() {
    return {
        loginScreen: document.getElementById('login-screen'),
        chatScreen: document.getElementById('chat-screen'),
        usernameInput: document.getElementById('username-input'),
        joinBtn: document.getElementById('join-btn'),
        messagesArea: document.getElementById('messages-area'),
        messageInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-btn'),
        roomTabs: document.getElementById('room-tabs'),
        currentRoomName: document.querySelector('#current-room-name'),
        userBadge: document.getElementById('user-badge'),
        typingIndicator: document.getElementById('typing-indicator'),
        roomMembersEl: document.getElementById('room-members'),
        connectionStatusEl: document.getElementById('connection-status'),
        statusTextEl: document.querySelector('.status-text'),
    };
}
// ===== Состояние =====
let username = '';
let currentRoom = '';
let rooms = [];
let typingTimer = null;
let isTyping = false;
// ===== Подключение =====
// @ts-ignore: socket.io клиент глобально доступен через CDN
const socket = io();
// ===== Инициализация =====
const el = getElements();
// ===== Вход =====
el.joinBtn.addEventListener('click', joinChat);
el.usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')
        joinChat();
});
function joinChat() {
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
socket.on('rooms-list', (data) => {
    rooms = data;
    el.roomTabs.innerHTML = '';
    data.forEach((room) => {
        const btn = document.createElement('button');
        btn.className = 'room-tab' + (room.id === currentRoom ? ' active' : '');
        btn.textContent = room.name;
        btn.addEventListener('click', () => switchRoom(room.id));
        el.roomTabs.appendChild(btn);
    });
});
// ===== Список участников =====
socket.on('room-members', (members) => {
    if (members.length === 0) {
        el.roomMembersEl.textContent = '';
        return;
    }
    el.roomMembersEl.innerHTML = `Участники: <span>${members.join(', ')}</span>`;
});
function switchRoom(roomId) {
    // Покидаем предыдущую комнату
    if (currentRoom) {
        socket.emit('leave-room', currentRoom);
    }
    currentRoom = roomId;
    const room = rooms.find((r) => r.id === roomId);
    el.currentRoomName.textContent = room ? room.name : roomId;
    // Обновляем вкладки
    document.querySelectorAll('.room-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.textContent === (room ? room.name : roomId));
    });
    // Очищаем сообщения
    el.messagesArea.innerHTML = '';
    // Подключаемся к комнате
    socket.emit('join-room', roomId);
}
// ===== Сообщения =====
socket.on('chat-message', (data) => {
    if (data.room !== currentRoom)
        return;
    appendMessage(data.username, data.text, data.timestamp, data.username === username);
});
socket.on('chat-history', (messages) => {
    messages.forEach((msg) => {
        appendMessage(msg.username, msg.text, msg.timestamp, msg.username === username);
    });
});
socket.on('system-message', (data) => {
    if (data.room !== currentRoom)
        return;
    appendSystemMessage(data.text);
});
function appendMessage(username, text, timestamp, isOwn) {
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
        const audio = document.getElementById('notification-sound');
        if (audio)
            audio.play().catch(() => { });
    }
}
function appendSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    el.messagesArea.appendChild(div);
    el.messagesArea.scrollTop = el.messagesArea.scrollHeight;
}
// ===== Отправка сообщения =====
el.sendBtn.addEventListener('click', sendMessage);
el.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')
        sendMessage();
});
function sendMessage() {
    const text = el.messageInput.value.trim();
    if (!text || !currentRoom)
        return;
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
    if (!currentRoom)
        return;
    if (!isTyping) {
        socket.emit('typing', { room: currentRoom });
        isTyping = true;
    }
    if (typingTimer)
        clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('stop-typing', { room: currentRoom });
        isTyping = false;
    }, 2000);
});
socket.on('user-typing', (data) => {
    if (data.room !== currentRoom)
        return;
    el.typingIndicator.textContent = `${data.username || data.room} печатает...`;
});
socket.on('user-stop-typing', (data) => {
    if (data.room !== currentRoom)
        return;
    el.typingIndicator.textContent = '';
});
// ===== Событие выхода из комнаты =====
socket.on('leave-room', (roomId) => {
    if (roomId === currentRoom) {
        el.messagesArea.innerHTML = '';
    }
});
// ===== Статус подключения =====
socket.on('disconnect', (_reason) => {
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
    }
    else {
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
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}
//# sourceMappingURL=chat.js.map