import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type RefreshAuthTokenMessage = SfPdpIpcMessage & {
  type: 'refreshAuthToken';
};

export function isRefreshAuthTokenMessage(
  message: SfPdpIpcMessage,
): message is RefreshAuthTokenMessage {
  return message.type === 'refreshAuthToken';
}

export function createRefreshAuthTokenMessage(id: number): RefreshAuthTokenMessage {
  return {
    id,
    type: 'refreshAuthToken',
    timestamp: Date.now(),
  };
}
