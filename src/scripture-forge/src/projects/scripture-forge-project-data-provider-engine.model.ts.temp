import { SerializedVerseRef } from '@sillsdev/scripture';
import { BaseProjectDataProviderEngine } from '@papi/backend';
import {
  DataProviderUpdateInstructions,
  IBaseProjectDataProviderEngine,
  MandatoryProjectDataTypes,
} from '@papi/core';
import type {
  DeltaOperation,
  ScriptureForgeProjectDocument,
  ScriptureForgeProjectInterfaceDataTypes,
} from 'scripture-forge';
import Delta from 'quill-delta';
import type { ProjectSettingTypes } from 'papi-shared-types';
import { ScriptureForgeBackEndConnection } from '../backend/scripture-forge-back-end-connection';

/**
 * The `projectInterface`s the slingshot pdpf serves
 *
 * This does NOT include `platformScripture.USJ_Chapter` even though the PDP provides this because
 * we do not want it to show up in the Open Resource dialog.
 */
// TypeScript is upset without `satisfies` here because `as const` makes the array readonly but it
// needs to be used in ProjectMetadata as not readonly :p
export const SCRIPTURE_FORGE_PROJECT_INTERFACES = [
  'platform.base',
  'scriptureForge.project',
] as const satisfies ['platform.base', 'scriptureForge.project'];

export default class ScriptureForgeProjectDataProviderEngine
  extends BaseProjectDataProviderEngine<typeof SCRIPTURE_FORGE_PROJECT_INTERFACES>
  implements IBaseProjectDataProviderEngine<typeof SCRIPTURE_FORGE_PROJECT_INTERFACES>
{
  #accessToken: string = '<INSERT HARD CODED TOKEN FOR NOW>';

  /**
   * @param scriptureForgeApi Object to use to get project and draft info
   * @param appProjectId Application project id for the project/draft represented by this PDP.
   *   Matches what the app uses but not necessarily the Paratext project id or the Scripture Forge
   *   project id
   * @param projectInfo Information about the project as received from Scripture Forge
   * @param updateProjectInfo Function to call to request that the project info be retrieved again
   *   and updated here (like if we join, for example)
   */
  constructor(private appProjectId: string) {
    super();
  }

  async getProject(): Promise<ScriptureForgeProjectDocument> {
    await ScriptureForgeBackEndConnection.connect(this.#accessToken);
    return (await ScriptureForgeBackEndConnection.getProjectDoc(this.appProjectId)).data;
  }

  async setProject(): Promise<
    DataProviderUpdateInstructions<
      MandatoryProjectDataTypes & ScriptureForgeProjectInterfaceDataTypes
    >
  > {
    throw new Error(
      `Cannot change project info on Scripture Forge PDP with app project id ${this.appProjectId}`,
    );
  }

  async getChapterDeltaOperations(verseRef: SerializedVerseRef): Promise<DeltaOperation[]> {
    await ScriptureForgeBackEndConnection.connect(this.#accessToken);
    const doc = await ScriptureForgeBackEndConnection.getChapterDoc(this.appProjectId, verseRef);
    return doc.data.ops;
  }

  async setChapterDeltaOperations(
    verseRef: SerializedVerseRef,
    updatesToApply: DeltaOperation[],
  ): Promise<
    DataProviderUpdateInstructions<
      MandatoryProjectDataTypes & ScriptureForgeProjectInterfaceDataTypes
    >
  > {
    await ScriptureForgeBackEndConnection.connect(this.#accessToken);
    const doc = await ScriptureForgeBackEndConnection.getChapterDoc(this.appProjectId, verseRef);
    doc.submitOp(new Delta(updatesToApply));
    return true;
  }

  async getExtensionData(): Promise<string | undefined> {
    throw new Error(
      `Extension data is not available on Scripture Forge PDP with app project id ${this.appProjectId}`,
    );
  }

  async setExtensionData(): Promise<
    DataProviderUpdateInstructions<
      MandatoryProjectDataTypes & ScriptureForgeProjectInterfaceDataTypes
    >
  > {
    throw new Error(
      `Extension data is not available on Scripture Forge PDP with app project id ${this.appProjectId}`,
    );
  }

  async getSetting<ProjectSettingName extends keyof ProjectSettingTypes>(
    key: ProjectSettingName,
  ): Promise<ProjectSettingTypes[ProjectSettingName]> {
    throw new Error(`Getting ${key} not implemented yet for ${this.appProjectId}`);
  }

  async setSetting(): Promise<
    DataProviderUpdateInstructions<
      MandatoryProjectDataTypes & ScriptureForgeProjectInterfaceDataTypes
    >
  > {
    throw new Error(
      `Cannot change project settings on Slingshot PDP with app project id ${this.appProjectId}`,
    );
  }

  async resetSetting(): Promise<boolean> {
    throw new Error(
      `Cannot change project settings on Slingshot PDP with app project id ${this.appProjectId}`,
    );
  }
}
