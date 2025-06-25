import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type InitializeMessage = SfPdpIpcMessage & {
  type: 'initialize';
  /** OAuth token required for connecting to the SF WebSocket */
  authToken: string;
  /** Base URL for the SF HTTP connection */
  httpBaseUrl: string;
  /** Base URL for the SF WebSocket connection */
  wssBaseUrl: string;
  /** Port for the PAPI WebSocket connection */
  papiPort: number;
};

export function isInitializeMessage(message: SfPdpIpcMessage): message is InitializeMessage {
  return message.type === 'initialize';
}

export function createInitializeMessage(
  id: number,
  authToken: string,
  httpBaseUrl: string,
  wssBaseUrl: string,
  papiPort: number,
): InitializeMessage {
  return {
    id,
    type: 'initialize',
    timestamp: Date.now(),
    authToken,
    httpBaseUrl,
    wssBaseUrl,
    papiPort,
  };
}
