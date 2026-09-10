/**
 * Валидация имени пользователя
 */
export function isValidUsername(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 20;
}

/**
 * Валидация ID комнаты
 */
export function isValidRoomId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Валидация сообщения чата
 */
export function isValidChatMessage(
  data: unknown
): data is { room: string; text: string } {
  if (typeof data !== 'object' || data === null) return false;
  const { room, text } = data as Record<string, unknown>;
  return isValidRoomId(room) && typeof text === 'string' && text.length > 0 && text.length <= 1000;
}

/**
 * Валидация события набора текста
 */
export function isValidTypingEvent(data: unknown): data is { room: string } {
  if (typeof data !== 'object' || data === null) return false;
  const { room } = data as Record<string, unknown>;
  return isValidRoomId(room);
}
