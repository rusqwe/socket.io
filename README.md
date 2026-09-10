# Socket.IO Chat

Чат на Socket.IO с поддержкой комнат, индикатором набора текста и списком участников.

## Структура проекта

```
socket.io/
├── server/                   # Серверный код (TypeScript)
│   ├── server.ts           # Express + Socket.IO сервер
│   ├── types/              # Общие типы
│   │   ├── events.ts       # События client↔server
│   │   ├── messages.ts     # Типы сообщений
│   │   └── socket.d.ts     # Расширение Socket
│   └── utils/
│       └── validators.ts   # Валидация входных данных
├── client/                 # Исходный код клиента (TypeScript)
│   └── chat.ts             # Клиентская логика
├── public/                 # Статические файлы (раздаются сервером)
│   ├── index.html          # HTML-разметка
│   ├── chat.js             # Скомпилированный JS (генерируется)
│   └── styles/
│       └── main.css        # Стили
├── dist/                   # Скомпилированный сервер (генерируется)
├── package.json
├── tsconfig.json           # Конфиг TS для сервера
└── tsconfig.client.json    # Конфиг TS для клиента
```

## Установка

```bash
npm install
```

## Сборка

```bash
# Сборка сервера и клиента
npm run build

# Или по отдельности
npm run build:server
npm run build:client
```

## Запуск

```bash
# Production
npm start

# Development (требует ts-node)
npm run dev
```

Сервер запускается на `http://localhost:3000` (или порт из `PORT`).

## Возможности

- Регистрация по имени пользователя
- Переключение между комнатами (General, Random, Test)
- Отправка сообщений в реальном времени
- Индикатор набора текста
- Список участников комнаты
- Уведомления о входе/выходе
- Статус подключения

## Миграция на TypeScript

Проект полностью переписан на TypeScript.
- Серверный код: `src/` → компилируется в `dist/` через `tsconfig.json`
- Клиентский код: `client/` → компилируется в `public/` через `tsconfig.client.json`
