import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type GetProjectsMessage = SfPdpIpcMessage & {
  type: 'getProjects';
};

export function isGetProjectsMessage(message: SfPdpIpcMessage): message is GetProjectsMessage {
  return message.type === 'getProjects';
}

export function createGetProjectsMessage(id: number): GetProjectsMessage {
  return {
    id,
    type: 'getProjects',
    timestamp: Date.now(),
  };
}
