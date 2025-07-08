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

# Watch for changes during development
npm run watch
```

## Running

```bash
# Run the built process
npm start

# Run in development mode with ts-node
npm run dev
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

- `init`: Initialize the process with configuration
- `process`: Process project data (action, projectId, data)
- `ping`: Health check
- `shutdown`: Graceful shutdown
- `response`: Response to any of the above

### Example Usage

```typescript
import { fork } from 'child_process';
import * as path from 'path';

const sfPdpPath = path.join(__dirname, 'assets', 'sf-pdp', 'index.js');
const child = fork(sfPdpPath);

// Initialize
child.send({
  type: 'init',
  id: 'init-1',
  data: { logLevel: 'debug', workspaceDir: '/path/to/workspace' },
});

// Process data
child.send({
  type: 'process',
  id: 'proc-1',
  data: {
    action: 'validate',
    projectId: 'project-123',
    data: {
      /* project data */
    },
  },
});

// Handle responses
child.on('message', (message) => {
  console.log('Received:', message);
});
```
