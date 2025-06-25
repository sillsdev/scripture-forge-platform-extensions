import { logger, settings } from '@papi/backend';
import { ChildProcess } from 'child_process';
import {
  createInitializeMessage,
  createPingMessage,
  createPongMessage,
  createProjectResultsMessage,
  type SfPdpMessage,
} from 'sf-pdp-messages';
import { expandServerConfiguration } from '../auth/server-configuration.model';
import ScriptureForgeAuthenticationProvider from '../auth/scripture-forge-authentication-provider.model';
import ScriptureForgeApi from './scripture-forge-api.model';

// PAPI websocket port - It would be good to get this from some config instead of hardcoding it
const WEBSOCKET_PORT = 8876;

let childProcess: ChildProcess | undefined;
let sfAuthProvider: ScriptureForgeAuthenticationProvider | undefined;
let sfApi: ScriptureForgeApi | undefined;
let nextMessageId = 0;

/**
 * Sets up the Scripture Forge Project Data Provider (SF PDP) child process to pass messages back
 * and forth.
 *
 * @param sfPdpProcess - The child process instance representing the SF PDP.
 * @param authProvider - The authentication provider for Scripture Forge.
 * @param scriptureForgeApi - The API instance for interacting with Scripture Forge.
 */
export function initializeChildProcess(
  sfPdpProcess: ChildProcess,
  authProvider: ScriptureForgeAuthenticationProvider,
  scriptureForgeApi: ScriptureForgeApi,
): void {
  if (childProcess) throw new Error('Child process is already set');
  childProcess = sfPdpProcess;
  sfAuthProvider = authProvider;
  sfApi = scriptureForgeApi;

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
    case 'getProjects':
      await sendProjectResultsMessage();
      return;
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

async function sendProjectResultsMessage(): Promise<void> {
  const projectIds: string[] = [];
  const projects = await sfApi?.getProjects();
  logger.debug(`Received SF projects from API: ${JSON.stringify(projects)}`);
  if (Array.isArray(projects)) {
    projects.forEach((project) => {
      if (project.projectId) projectIds.push(project.projectId);
    });
  }
  childProcess?.send(createProjectResultsMessage(getNextMessageId(), projectIds));
}

async function sendInitializeMessage(): Promise<void> {
  logger.debug('Sending initialize message to SF PDP');
  if (sfAuthProvider === undefined)
    throw new Error('ScriptureForgeAuthenticationProvider is not set');

  const serverConfig = expandServerConfiguration(
    await settings.get('scriptureForge.serverConfiguration'),
  );

  // To have an auth token we have to be logged in
  if (!(await sfAuthProvider.isLoggedIn())) {
    logger.debug('ScriptureForgeAuthenticationProvider is not logged in, attempting to log in');
    if (!(await sfAuthProvider.login())) throw new Error('Failed to log in to Scripture Forge');
  } else logger.debug('ScriptureForgeAuthenticationProvider is already logged in');

  const authToken = await sfAuthProvider.getAccessToken();
  if (!authToken) throw new Error('No auth token available for SF PDP');
  childProcess?.send(
    createInitializeMessage(
      getNextMessageId(),
      authToken,
      serverConfig.scriptureForge.domain,
      serverConfig.scriptureForge.webSocket,
      WEBSOCKET_PORT,
    ),
  );
}
