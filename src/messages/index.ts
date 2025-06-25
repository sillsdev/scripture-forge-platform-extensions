import { ErrorMessage } from './error-message';
import { GetProjectsMessage } from './get-projects-message';
import { InitializeMessage } from './initialize-message';
import { PingMessage } from './ping-message';
import { PongMessage } from './pong-message';
import { ProjectResultsMessage } from './project-results-message';
import { ShutdownMessage } from './shutdown-message';

export { type ErrorMessage, createErrorMessage, isErrorMessage } from './error-message';
export {
  type GetProjectsMessage,
  createGetProjectsMessage,
  isGetProjectsMessage,
} from './get-projects-message';
export {
  type InitializeMessage,
  createInitializeMessage,
  isInitializeMessage,
} from './initialize-message';
export { type PingMessage, createPingMessage, isPingMessage } from './ping-message';
export { type PongMessage, createPongMessage, isPongMessage } from './pong-message';
export {
  type ProjectResultsMessage,
  createProjectResultsMessage,
  isProjectResultsMessage,
} from './project-results-message';
export { type SfPdpIpcMessage, SfPdpIpcMessageTypes, isStaleMessage } from './sf-pdp-ipc-message';
export { type ShutdownMessage, createShutdownMessage, isShutdownMessage } from './shutdown-message';

export type SfPdpMessage =
  | ErrorMessage
  | GetProjectsMessage
  | InitializeMessage
  | PingMessage
  | PongMessage
  | ProjectResultsMessage
  | ShutdownMessage;
