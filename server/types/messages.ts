export interface Room {
  id: string;
  name: string;
}

export interface ChatMessage {
  username: string;
  text: string;
  room: string;
  timestamp: string;
}

export interface SystemMessage {
  text: string;
  room: string;
}

export interface TypingEvent {
  username?: string;
  room: string;
}

export interface RoomMembersEvent {
  members: string[];
}
