import { WebSocket } from '@papi/backend';
import type { ClientOptions } from 'ws';
import { SCRIPTURE_FORGE_HTTPS_BASE_URL } from './rce-utils';

export class CustomOriginWebSocket extends WebSocket {
  constructor(address: string, protocols?: string | string[], options: ClientOptions = {}) {
    // Add or override the Origin header
    options.headers = {
      ...(options.headers || {}),
      origin: SCRIPTURE_FORGE_HTTPS_BASE_URL,
    };
    super(address, protocols, options);
  }
}
