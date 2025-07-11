import { RpcClient } from './rpc-client';
import { InternalRequestHandler } from './rpc.model';
import { SingleMethodDocumentation } from './openrpc.model';

export const NetworkObjectTypes = {
  DATA_PROVIDER: 'dataProvider',
  OBJECT: 'object',
  PROJECT_DATA_PROVIDER_FACTORY: 'pdpFactory',
  PROJECT_DATA_PROVIDER: 'pdp',
} as const;

export type NetworkObjectType = (typeof NetworkObjectTypes)[keyof typeof NetworkObjectTypes];

export type NetworkObjectRegistrationData = {
  objectId: string;
  objectType: NetworkObjectType;
  functions: Record<string, InternalRequestHandler>;
  documentation?: Record<string, SingleMethodDocumentation>;
};

export async function registerNetworkObject(
  rpcClient: RpcClient,
  registrationData: NetworkObjectRegistrationData,
): Promise<void> {
  const { objectId, objectType, functions, documentation } = registrationData;

  const functionNames = Object.keys(functions);
  if (functionNames.length === 0)
    throw new Error(`Cannot register network object '${objectId}' with no functions.`);

  const registrationPromises = functions.map((handler: InternalRequestHandler, fnName: string) => {
    const docs = documentation && documentation[fnName] ? documentation[fnName] : undefined;
    return rpcClient.registerMethod(`${objectId}.${fnName}`, handler, docs);
  });

  const responses: boolean[] = await Promise.all(registrationPromises);
  if (responses.some((response) => !response))
    throw new Error(`Failed to register all functions for network object '${objectId}'.`);

  const registrationMessage = {
    id: objectId,
    objectType,
    functionNames,
  };
  rpcClient.emitEventOnNetwork('object:onDidCreateNetworkObject', registrationMessage);
}
