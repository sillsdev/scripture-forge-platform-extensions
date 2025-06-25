import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type PongMessage = SfPdpIpcMessage & {
  type: 'pong';
  timestamp: number;
};

export function isPongMessage(message: SfPdpIpcMessage): message is PongMessage {
  return message.type === 'pong';
}

export function createPongMessage(id: number): PongMessage {
  return {
    id,
    type: 'pong',
    timestamp: Date.now(),
  };
}
