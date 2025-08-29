import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type PingMessage = SfPdpIpcMessage & {
  type: 'ping';
  uptimeSec: number;
};

export function isPingMessage(message: SfPdpIpcMessage): message is PingMessage {
  return message.type === 'ping';
}

export function createPingMessage(id: number): PingMessage {
  return {
    id,
    type: 'ping',
    timestamp: Date.now(),
    uptimeSec: process.uptime(),
  };
}
