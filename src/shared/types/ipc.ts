export enum IpcChannels {
  // User Management
  USER_LOGIN = "user:login",
  USER_CREATE = "user:create",

  // Table Management
  TABLE_START = "table:start",
  TABLE_END = "table:end",
  TABLE_STATUS = "table:status",

  // Prayer Time Management
  PRAYER_NEXT = "prayer:next",
  PRAYER_STATUS = "prayer:status",

  // Reservations
  RESERVATION_CREATE = "reservation:create",
  RESERVATION_CANCEL = "reservation:cancel",
}

export interface IpcHandlers {
  [IpcChannels.USER_LOGIN]: {
    request: { username: string; password: string };
    response: { id: number; username: string; role: string } | null;
  };
  // Add other handler types here...
}
