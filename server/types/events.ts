import { Socket, Server } from 'socket.io';
import { Room, ChatMessage, SystemMessage, TypingEvent } from './messages.js';

/**
 * События, которые клиент отправляет на сервер
 * (сервер их слушает через socket.on)
 */
export interface ClientToServerEvents {
  'set-username': (name: string, isReconnect?: boolean) => void;
  'join-room': (roomId: string) => void;
  'leave-room': (roomId: string) => void;
  'chat-message': (data: { room: string; text: string }) => void;
  'typing': (data: { room: string }) => void;
  'stop-typing': (data: { room: string }) => void;
}

/**
 * События, которые сервер отправляет клиенту
 * (клиент их слушает через socket.on)
 */
export interface ServerToClientEvents {
  'rooms-list': (rooms: Room[]) => void;
  'chat-message': (data: ChatMessage) => void;
  'chat-history': (messages: ChatMessage[]) => void;
  'system-message': (data: SystemMessage) => void;
  'room-members': (members: string[]) => void;
  'user-typing': (data: TypingEvent) => void;
  'user-stop-typing': (data: TypingEvent) => void;
}

/**
 * Расширение Socket с типизированными событиями
 */
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Расширение Server с типизированными событиями
 */
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
