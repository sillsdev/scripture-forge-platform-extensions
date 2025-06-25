import { SfPdpIpcMessage } from './sf-pdp-ipc-message';

export type ProjectResultsMessage = SfPdpIpcMessage & {
  type: 'projectResults';
  projectIds: string[];
};

export function isProjectResultsMessage(
  message: SfPdpIpcMessage,
): message is ProjectResultsMessage {
  return message.type === 'projectResults';
}

export function createProjectResultsMessage(
  id: number,
  projectIds: string[],
): ProjectResultsMessage {
  return {
    id,
    type: 'projectResults',
    timestamp: Date.now(),
    projectIds,
  };
}
