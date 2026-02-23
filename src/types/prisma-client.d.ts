declare module "@prisma/client" {
  export const MessageType: {
    TEXT: "TEXT";
    PHOTO: "PHOTO";
    COMMAND: "COMMAND";
    CALLBACK: "CALLBACK";
    SYSTEM: "SYSTEM";
    OTHER: "OTHER";
  };
  export type MessageType = (typeof MessageType)[keyof typeof MessageType];

  export const MessageDirection: {
    IN: "IN";
    OUT: "OUT";
  };
  export type MessageDirection =
    (typeof MessageDirection)[keyof typeof MessageDirection];

  export class PrismaClient {
    [key: string]: any;
    constructor(...args: any[]);
  }
}
