import {
  NetworkObjectRegistrationData,
  NetworkObjectTypes,
  registerNetworkObject,
} from '../papi-websocket/network-object';
import { RpcClient } from '../papi-websocket/rpc-client';
import { ScriptureForgeProjectDataProvider } from './pdp';

const SCRIPTURE_FORGE_PROJECT_INTERFACES = ['platform.base', 'scriptureForge.project'] as const;

type ProjectMetadataWithoutFactoryInfo = {
  /** ID of a project (must be unique and case insensitive) */
  id: string;
  projectInterfaces: typeof SCRIPTURE_FORGE_PROJECT_INTERFACES;
};

let rpcClient: RpcClient | undefined;
export function setRpcClient(client: RpcClient): void {
  rpcClient = client;
}

const knownPdps = new Map<string, ScriptureForgeProjectDataProvider>();

async function getProjects(): Promise<ProjectMetadataWithoutFactoryInfo[]> {
  return [
    {
      id: '<INSERT PROJECT ID HERE>',
      projectInterfaces: SCRIPTURE_FORGE_PROJECT_INTERFACES,
    },
  ];
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
  const pdpId = `object:SF0${generateRandomLetters(20)}-pdp-data`;
  const projectPdp = new ScriptureForgeProjectDataProvider(projectId, rpcClient, pdpId);
  await registerNetworkObject(rpcClient, projectPdp.networkObjectRegistrationData);

  knownPdps.set(projectId, projectPdp);
  return pdpId;
}

const pdpFactoryFunctions = {
  getProjects,
  getProjectDataProviderId,
};

export const scriptureForgePdpFactory: NetworkObjectRegistrationData = {
  objectId: 'object:platform.scriptureForgeProjects-pdpf',
  objectType: NetworkObjectTypes.PROJECT_DATA_PROVIDER_FACTORY,
  functions: pdpFactoryFunctions,
};
