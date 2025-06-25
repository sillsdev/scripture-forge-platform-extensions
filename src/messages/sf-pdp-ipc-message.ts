export const SfPdpIpcMessageTypes = [
  'authToken',
  'error',
  'getProjects',
  'initialize',
  'ping',
  'pong',
  'projectResults',
  'shutdown',
] as const;

// Define the type for IPC messages used in the Scripture Forge Project Data Provider (SF-PDP)
export type SfPdpIpcMessage = {
  id: number;
  type: (typeof SfPdpIpcMessageTypes)[number];
  timestamp: number;
};

export function isStaleMessage(message: SfPdpIpcMessage, timeoutMs: number = 5000): boolean {
  return Date.now() - message.timestamp > timeoutMs;
}
