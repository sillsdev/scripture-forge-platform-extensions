import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type ErrorMessage = SfPdpIpcMessage & {
  type: 'error';
  error: string;
  stack?: string;
};

export function isErrorMessage(message: SfPdpIpcMessage): message is ErrorMessage {
  return message.type === 'error';
}

export function createErrorMessage(
  id: number,
  error: string | Error,
  stack?: string,
): ErrorMessage {
  const errorString = error instanceof Error ? error.message : error;
  const errorStack = stack || (error instanceof Error ? error.stack : undefined);

  return {
    id,
    type: 'error',
    timestamp: Date.now(),
    error: errorString,
    stack: errorStack,
  };
}
