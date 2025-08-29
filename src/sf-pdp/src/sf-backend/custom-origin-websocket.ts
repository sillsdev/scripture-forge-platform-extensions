import { ClientOptions, WebSocket } from 'ws';

let origin: string | undefined;

/**
 * Sets the origin for CustomOriginWebSocket. This must be called before creating any instances of
 * CustomOriginWebSocket.
 *
 * @param newOrigin - The origin to set, e.g., 'https://example.com'.
 */
export function setOrigin(newOrigin: string): void {
  origin = newOrigin;
}

/** WebSocket class that allows setting a custom Origin header. */
export class CustomOriginWebSocket extends WebSocket {
  constructor(address: string, protocols?: string | string[], options: ClientOptions = {}) {
    if (!origin) throw new Error('Origin must be set before creating a CustomOriginWebSocket');

    // Add or override the Origin header
    options.headers = {
      ...(options.headers || {}),
      origin,
    };
    super(address, protocols, options);
  }
}
