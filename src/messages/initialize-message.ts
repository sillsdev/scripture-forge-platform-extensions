import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type InitializeMessage = SfPdpIpcMessage & {
  type: 'initialize';
  authToken: string;
  baseUrl: string;
  papiPort: number;
};

export function isInitializeMessage(message: SfPdpIpcMessage): message is InitializeMessage {
  return message.type === 'initialize';
}

export function createInitializeMessage(
  id: number,
  authToken: string,
  baseUrl: string,
  papiPort: number,
): InitializeMessage {
  return {
    id,
    type: 'initialize',
    timestamp: Date.now(),
    authToken,
    baseUrl,
    papiPort,
  };
}
