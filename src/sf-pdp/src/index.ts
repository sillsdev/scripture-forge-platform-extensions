import {
  AuthTokenMessage,
  createErrorMessage,
  createPingMessage,
  createPongMessage,
  InitializeMessage,
  PingMessage,
  PongMessage,
  SfPdpMessage,
  ShutdownMessage,
} from 'sf-pdp-messages';
import { getErrorMessage } from 'platform-bible-utils';
import { RpcClient } from './papi-websocket/rpc-client';
import * as SfBackend from './sf-backend/scripture-forge-back-end-connection';
import * as log from './log';
import { registerNetworkObject } from './papi-websocket/network-object';
import { scriptureForgePdpFactory } from './pdp/pdp-factory';

/**
 * SF-PDP (Scripture Forge Project Data Provider) Process
 *
 * This is a standalone Node.js process that can be forked from the main scripture-forge extension.
 * It handles project data processing tasks in isolation from the extension host process.
 */

type SfPdpConfig = {
  papiPort?: number;
};

class SfPdpProcess {
  private nextMsgId: number = 0;
  private config: SfPdpConfig = {};
  private receivedPing = false;
  private receivedPong = false;
  private rpcClient: RpcClient | undefined;
  private currentAuthToken: string | undefined;

  private get nextMessageId(): number {
    const id = this.nextMsgId;
    this.nextMsgId += 1;
    return id;
  }

  start(): void {
    log.info('Starting SF-PDP process', { pid: process.pid });

    if (!process.send) this.exitProcess('process is not forked, cannot continue', 1);

    process.on('message', (message: SfPdpMessage) => {
      try {
        this.handleMessage(message);
      } catch (error) {
        this.exitProcess(`error handling IPC message: ${getErrorMessage(error)}`, 100);
      }
    });

    process.on('SIGINT', () => this.exitProcess('received SIGINT', 0));
    process.on('SIGTERM', () => this.exitProcess('received SIGTERM', 0));

    this.sendMessage(createPingMessage(this.nextMessageId));
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private exitProcess(message: string, code: number): void {
    if (code === 0) log.info(`Exiting SF-PDP process gracefully: ${message}`);
    else log.error(`Exiting SF-PDP process with code ${code}: ${message}`);
    log.flush();
    process.exit(code);
  }

  private sendMessage(message: SfPdpMessage): void {
    if (!this.receivedPing || !this.receivedPong) {
      switch (message.type) {
        case 'error':
        case 'ping':
        case 'pong':
          break;
        default:
          log.warn(`Cannot send a message before trading ping/pongs: ${JSON.stringify(message)}`);
          return;
      }
    }

    if (!process.send) throw new Error('Process is not forked, cannot send message');
    process.send(message);
  }

  private handleMessage(message: SfPdpMessage): void {
    log.verbose('Received message:', JSON.stringify(message));

    switch (message.type) {
      case 'authToken':
        this.handleAuthToken(message);
        return;
      case 'initialize':
        this.handleInitialize(message);
        return;
      case 'ping':
        this.handlePing(message);
        return;
      case 'pong':
        this.handlePong(message);
        return;
      case 'shutdown':
        this.handleShutdown(message);
        return;
      default:
        log.warn('Unexpected message:', JSON.stringify(message));
    }
  }

  private handleInitialize(message: InitializeMessage): void {
    if (this.config.papiPort !== undefined || this.rpcClient) {
      log.warn('Already initialized');
      this.sendMessage(createErrorMessage(this.nextMessageId, 'Already initialized'));
      return;
    }

    this.config.papiPort = message.papiPort;
    (async () => {
      try {
        if (!this.config.papiPort) throw new Error('PAPI port is not configured');
        this.rpcClient = new RpcClient(this.config.papiPort);
        // TODO: Insert a proper event handler
        if (!(await this.rpcClient.connect(() => {})))
          throw new Error('Failed to connect RPC client to the PAPI web socket');

        await registerNetworkObject(this.rpcClient, scriptureForgePdpFactory);
      } catch (error) {
        this.exitProcess(`Error initializing PAPI connection: ${getErrorMessage(error)}`, 101);
      }
    })();
  }

  private handlePing(message: PingMessage): void {
    this.receivedPing = true;
    log.info('Received ping:', JSON.stringify(message));
    this.sendMessage(createPongMessage(message.id));
  }

  private handlePong(message: PongMessage): void {
    this.receivedPong = true;
    log.info('Received pong:', JSON.stringify(message));
  }

  private handleAuthToken(message: AuthTokenMessage): void {
    this.currentAuthToken = message.token;
    SfBackend.ScriptureForgeBackEndConnection.connect(this.currentAuthToken);
  }

  private handleShutdown(message: ShutdownMessage): void {
    const reason = message.reason || 'no reason provided';
    this.exitProcess(`received shutdown message (${reason})`, 0);
  }
}

// If this file is being run directly (not required as a module)
if (require.main === module) {
  const process = new SfPdpProcess();
  process.start();
}

export { SfPdpProcess };
export type { SfPdpConfig };
