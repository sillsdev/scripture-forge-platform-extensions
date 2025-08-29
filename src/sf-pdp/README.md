# SF-PDP (Scripture Forge Project Data Provider)

This is a standalone Node.js process that can be forked from the main scripture-forge extension to handle project data processing tasks in isolation.

## Purpose

The SF-PDP process allows the scripture-forge extension to:

- Offload heavy data processing tasks
- Maintain responsiveness in the main extension process
- Isolate potentially unstable operations
- Scale processing workloads

## Building

```bash
# Build the process
npm run build

# Build for production
npm run build:production
```

## Running

```bash
# Run the built process
npm start
```

## Integration

The built process artifacts are copied to the scripture-forge extension's assets directory during the main build process. The extension can then fork this process using Node.js's `child_process.fork()` method.

## API

The process communicates with the parent via IPC messages with the following structure:

```typescript
interface SfPdpMessage {
  type: 'init' | 'process' | 'shutdown' | 'ping' | 'response';
  id?: string;
  data?: any;
  error?: string;
}
```

### Message Types

- `ping`: Initialize (and could be used as a health check)
- `pong`: Respond to a ping message
- `getProjects`: Request to get a list of available projects (sent from the SF PDP process to the extension host since the extension host talks with the REST API while the SF PDP process talks with the websocket)
- `projectResults`: Response to a getProjects message
- `error`: Send information about an error that occurred
- `shutdown`: Graceful shutdown (sent by the extension host to the SF PDP process)

### Example Usage

```typescript
import { fork } from 'child_process';
import * as path from 'path';

const sfPdpPath = path.join(__dirname, 'assets', 'sf-pdp', 'index.js');
const child = fork(sfPdpPath);

child.on('exit', (code) => {
  if (code === 0) {
    logger.info('SF PDP exited gracefully');
  } else {
    logger.error(`SF PDP exited with code ${code}`);
  }
});

child.on('message', (message: SfPdpMessage) => {
  handleMessage(message);
});

// Initialize with a ping message
child.send(createPingMessage(getNextMessageId()));
```
