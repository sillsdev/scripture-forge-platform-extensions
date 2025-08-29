import { ProjectResultsMessage } from 'sf-pdp-messages';
import {
  NetworkObjectRegistrationData,
  NetworkObjectTypes,
  registerNetworkObject,
} from '../papi-websocket/network-object';
import { RpcClient } from '../papi-websocket/rpc-client';
import { ScriptureForgeProjectDataProvider } from './pdp';
import * as logger from '../log';

const SCRIPTURE_FORGE_PROJECT_INTERFACES = [
  'platform.base',
  'scriptureForge.chapterDeltaOperations',
  'scriptureForge.scriptureForgeProject',
] as const;

type ProjectMetadataWithoutFactoryInfo = {
  /** ID of a project (must be unique and case insensitive) */
  id: string;
  projectInterfaces: typeof SCRIPTURE_FORGE_PROJECT_INTERFACES;
};

let rpcClient: RpcClient | undefined;
export function setRpcClient(client: RpcClient): void {
  rpcClient = client;
}

let getProjectsMessage: (() => Promise<ProjectResultsMessage>) | undefined;
export function setGetProjectsMessage(
  projectsMessageRetriever: () => Promise<ProjectResultsMessage>,
): void {
  getProjectsMessage = projectsMessageRetriever;
}

const knownPdps = new Map<string, ScriptureForgeProjectDataProvider>();

async function getAvailableProjects(): Promise<ProjectMetadataWithoutFactoryInfo[]> {
  if (!getProjectsMessage)
    throw new Error('getProjectsMessage is not set. Please set it before calling this function.');
  const retVal: ProjectMetadataWithoutFactoryInfo[] = [];
  const projectsMessage = await getProjectsMessage();
  projectsMessage.projectIds.forEach((projectId) => {
    retVal.push({
      id: projectId,
      projectInterfaces: SCRIPTURE_FORGE_PROJECT_INTERFACES,
    });
  });
  logger.debug(`Available SF projects: ${JSON.stringify(projectsMessage.projectIds)}`);
  return retVal;
}

function generateRandomLetters(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

async function getProjectDataProviderId(projectId: string): Promise<string> {
  const existingPdp = knownPdps.get(projectId);
  if (existingPdp) return existingPdp.pdpId;

  if (!rpcClient) throw new Error('Internal error - RPC client is not set.');
  const pdpId = `SF0${generateRandomLetters(20)}-pdp-data`;
  const projectPdp = new ScriptureForgeProjectDataProvider(projectId, rpcClient, pdpId);
  await registerNetworkObject(rpcClient, projectPdp.networkObjectRegistrationData);

  knownPdps.set(projectId, projectPdp);
  return pdpId;
}

const pdpFactoryFunctions = {
  getAvailableProjects,
  getProjectDataProviderId,
};

export const scriptureForgePdpFactory: NetworkObjectRegistrationData = {
  objectId: 'platform.scriptureForgeProjects-pdpf',
  objectType: NetworkObjectTypes.PROJECT_DATA_PROVIDER_FACTORY,
  functions: pdpFactoryFunctions,
  attributes: {
    projectInterfaces: SCRIPTURE_FORGE_PROJECT_INTERFACES,
  },
};
