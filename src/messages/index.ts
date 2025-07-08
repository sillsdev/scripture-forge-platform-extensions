import { AuthTokenMessage } from './auth-token-message';
import { ErrorMessage } from './error-message';
import { InitializeMessage } from './initialize-message';
import { PingMessage } from './ping-message';
import { PongMessage } from './pong-message';
import { RefreshAuthTokenMessage } from './refresh-auth-token-message';
import { ShutdownMessage } from './shutdown-message';

export { AuthTokenMessage, createAuthTokenMessage, isAuthTokenMessage } from './auth-token-message';
export { ErrorMessage, createErrorMessage, isErrorMessage } from './error-message';
export {
  InitializeMessage,
  createInitializeMessage,
  isInitializeMessage,
} from './initialize-message';
export { PingMessage, createPingMessage, isPingMessage } from './ping-message';
export { PongMessage, createPongMessage, isPongMessage } from './pong-message';
export {
  RefreshAuthTokenMessage,
  createRefreshAuthTokenMessage,
  isRefreshAuthTokenMessage,
} from './refresh-auth-token-message';
export { SfPdpIpcMessage, SfPdpIpcMessageTypes, isStaleMessage } from './sf-pdp-ipc-message';
export { ShutdownMessage, createShutdownMessage, isShutdownMessage } from './shutdown-message';

export type SfPdpMessage =
  | AuthTokenMessage
  | ErrorMessage
  | InitializeMessage
  | PingMessage
  | PongMessage
  | RefreshAuthTokenMessage
  | ShutdownMessage;
