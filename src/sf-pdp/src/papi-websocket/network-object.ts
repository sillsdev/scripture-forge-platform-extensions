import { RpcClient } from './rpc-client';
import { InternalRequestHandler } from './rpc.model';
import { SingleMethodDocumentation } from './openrpc.model';
import * as logger from '../log';

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
  /**
   * Optional object containing properties that describe this network object. The properties
   * associated with this network object depend on the `objectType`.
   */
  attributes?: Record<string, unknown>;
  documentation?: Record<string, SingleMethodDocumentation>;
};

export async function registerNetworkObject(
  rpcClient: RpcClient,
  registrationData: NetworkObjectRegistrationData,
): Promise<void> {
  const { objectId, objectType, functions, attributes, documentation } = registrationData;
  const prefixedObjectId = objectId.startsWith('object:') ? objectId : `object:${objectId}`;

  // Make sure the network object identity function gets registered
  functions[''] = () => true;

  const functionNames = Object.keys(functions);
  if (functionNames.length === 0)
    throw new Error(`Cannot register network object '${objectId}' with no functions.`);

  const registrationPromises = Object.entries(functions).map(([fnName, handler]) => {
    const nameToRegister = fnName === '' ? prefixedObjectId : `${prefixedObjectId}.${fnName}`;
    const docs = documentation && documentation[fnName] ? documentation[fnName] : undefined;
    return rpcClient.registerMethod(nameToRegister, handler, docs);
  });

  const responses: boolean[] = await Promise.all(registrationPromises);
  if (responses.some((response) => !response))
    throw new Error(`Failed to register all functions for network object '${objectId}'.`);
  else
    logger.info(
      `Registered network object '${objectId}' of type '${objectType}' with functions: ${functionNames.join(', ')}`,
    );

  const registrationMessage = {
    id: objectId,
    objectType,
    functionNames,
    attributes,
  };
  rpcClient.emitEventOnNetwork('object:onDidCreateNetworkObject', registrationMessage);
}
