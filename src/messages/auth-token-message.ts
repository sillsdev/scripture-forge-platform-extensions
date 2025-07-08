import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type AuthTokenMessage = SfPdpIpcMessage & {
  type: 'authToken';
  token: string;
};

export function isAuthTokenMessage(message: SfPdpIpcMessage): message is AuthTokenMessage {
  return message.type === 'authToken';
}

export function createAuthTokenMessage(id: number, token: string): AuthTokenMessage {
  return {
    id,
    type: 'authToken',
    timestamp: Date.now(),
    token,
  };
}
