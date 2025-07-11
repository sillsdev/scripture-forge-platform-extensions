import { logger } from '@papi/backend';
import { ChildProcess } from 'child_process';
import {
  createInitializeMessage,
  createPingMessage,
  createPongMessage,
  type SfPdpMessage,
} from 'sf-pdp-messages';
import ScriptureForgeAuthenticationProvider from '../auth/scripture-forge-authentication-provider.model';

// NOTE: Use https://qa.scriptureforge.org on QA, or https://scriptureforge.org on live for origin
export const SCRIPTURE_FORGE_HTTPS_BASE_URL = 'https://qa.scriptureforge.org';

const WEBSOCKET_PORT = 8876;

let childProcess: ChildProcess | undefined;
let sfAuthProvider: ScriptureForgeAuthenticationProvider | undefined;
let nextMessageId = 0;

export function initializeChildProcess(
  process: ChildProcess,
  authProvider: ScriptureForgeAuthenticationProvider,
): void {
  if (childProcess) {
    throw new Error('Child process is already set');
  }
  childProcess = process;
  sfAuthProvider = authProvider;

  if (childProcess.stdout) {
    childProcess.stdout.on('data', (data) => {
      logger.info(`SF PDP: ${data.toString().trim()}`);
    });
  }

  if (childProcess.stderr) {
    childProcess.stderr.on('data', (data) => {
      logger.error(`SF PDP: ${data.toString().trim()}`);
    });
  }

  childProcess.on('exit', (code) => {
    if (code === 0) {
      logger.info('SF PDP exited gracefully');
    } else {
      logger.error(`SF PDP exited with code ${code}`);
    }
  });

  childProcess.on('message', (message: SfPdpMessage) => {
    handleMessage(message);
  });

  childProcess.send(createPingMessage(getNextMessageId()));
}

function getNextMessageId(): number {
  nextMessageId += 1;
  return nextMessageId;
}

async function handleMessage(message: SfPdpMessage): Promise<void> {
  logger.verbose('Received message:', JSON.stringify(message));

  switch (message.type) {
    case 'ping':
      childProcess?.send(createPongMessage(getNextMessageId()));
      return;
    case 'pong':
      await sendInitializeMessage();
      return;
    default:
      logger.warn('Unexpected SF PDP message:', JSON.stringify(message));
  }
}

async function sendInitializeMessage(): Promise<void> {
  const authToken = await sfAuthProvider?.getAccessToken();
  if (!authToken) throw new Error('No auth token available for SF PDP');
  childProcess?.send(
    createInitializeMessage(
      getNextMessageId(),
      authToken,
      SCRIPTURE_FORGE_HTTPS_BASE_URL,
      WEBSOCKET_PORT,
    ),
  );
}
