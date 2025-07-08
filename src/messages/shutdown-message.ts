import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type ShutdownMessage = SfPdpIpcMessage & {
  type: 'shutdown';
  reason?: string;
};

export function isShutdownMessage(message: SfPdpIpcMessage): message is ShutdownMessage {
  return message.type === 'shutdown';
}

export function createShutdownMessage(id: number, reason?: string): ShutdownMessage {
  return {
    id,
    type: 'shutdown',
    timestamp: Date.now(),
    reason,
  };
}
