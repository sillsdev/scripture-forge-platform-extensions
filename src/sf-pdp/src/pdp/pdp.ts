import { DeltaOperation, ScriptureForgeProjectDocument } from 'scripture-forge';
import { SerializedVerseRef } from '@sillsdev/scripture';
import { ScriptureForgeBackEndConnection } from '../sf-backend/scripture-forge-back-end-connection';
import { bindClassMethods } from '../papi-websocket/util';
import { Delta } from '../sf-backend/rce-utils';
import { RpcClient } from '../papi-websocket/rpc-client';
import {
  NetworkObjectRegistrationData,
  NetworkObjectTypes,
} from '../papi-websocket/network-object';

export class ScriptureForgeProjectDataProvider {
  private readonly projectId: string;
  private readonly rpcClient: RpcClient;
  private readonly dataProviderId: string;
  private readonly dataUpdateEventName: string;

  constructor(projectId: string, rpcClient: RpcClient, dataProviderId: string) {
    bindClassMethods.call(this);
    this.projectId = projectId;
    this.rpcClient = rpcClient;
    this.dataProviderId = dataProviderId;
    this.dataUpdateEventName = `${this.dataProviderId}:onDidUpdate`;
  }

  get pdpId(): string {
    return this.dataProviderId;
  }

  get networkObjectRegistrationData(): NetworkObjectRegistrationData {
    return {
      objectId: this.dataProviderId,
      objectType: NetworkObjectTypes.PROJECT_DATA_PROVIDER,
      functions: {
        getProject: this.getProject.bind(this),
        getChapterDeltaOperations: this.getChapterDeltaOperations.bind(this),
        setChapterDeltaOperations: this.setChapterDeltaOperations.bind(this),
      },
    };
  }

  async getProject(): Promise<ScriptureForgeProjectDocument> {
    return (await ScriptureForgeBackEndConnection.getProjectDoc(this.projectId)).data;
  }

  async getChapterDeltaOperations(verseRef: SerializedVerseRef): Promise<DeltaOperation[]> {
    return (await ScriptureForgeBackEndConnection.getChapterDoc(this.projectId, verseRef)).data.ops;
  }

  async setChapterDeltaOperations(
    verseRef: SerializedVerseRef,
    updatesToApply: DeltaOperation[],
  ): Promise<void> {
    const doc = await ScriptureForgeBackEndConnection.getChapterDoc(this.projectId, verseRef);
    doc.submitOp(new Delta(updatesToApply));
    this.rpcClient.emitEventOnNetwork(this.dataUpdateEventName, 'ChapterDeltaOperations');
  }
}
