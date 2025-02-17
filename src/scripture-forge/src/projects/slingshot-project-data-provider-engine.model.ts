import papi, { BaseProjectDataProviderEngine } from '@papi/backend';
import {
  DataProviderUpdateInstructions,
  IBaseProjectDataProviderEngine,
  MandatoryProjectDataTypes,
} from '@papi/core';
import { SlingshotDraftInfoProjectInterfaceDataTypes, SlingshotDraftInfo } from 'scripture-forge';
import type { ProjectSettingTypes } from 'papi-shared-types';
import type { USJChapterProjectInterfaceDataTypes } from 'platform-scripture';
import { VerseRef } from '@sillsdev/scripture';
import { Usj, usxStringToUsj } from '@biblionexus-foundation/scripture-utilities';
import { StatusCodes } from 'http-status-codes';
import { deepEqual } from 'platform-bible-utils';
import ScriptureForgeAPI, { ScriptureForgeProjectInfo } from './scripture-forge-api.model';

/**
 * The `projectInterface`s the slingshot pdpf serves
 *
 * This does NOT include `platformScripture.USJ_Chapter` even though the PDP provides this because
 * we do not want it to show up in the Open Resource dialog.
 */
// TypeScript is upset without `satisfies` here because `as const` makes the array readonly but it
// needs to be used in ProjectMetadata as not readonly :p
export const SLINGSHOT_PROJECT_INTERFACES = [
  'platform.base',
  'scriptureForge.slingshotDraftInfo',
  'platformScripture.USJ_Chapter',
] as const satisfies [
  'platform.base',
  'scriptureForge.slingshotDraftInfo',
  'platformScripture.USJ_Chapter',
];

export default class SlingshotProjectDataProviderEngine
  extends BaseProjectDataProviderEngine<typeof SLINGSHOT_PROJECT_INTERFACES>
  implements IBaseProjectDataProviderEngine<typeof SLINGSHOT_PROJECT_INTERFACES>
{
  private draftInfo: SlingshotDraftInfo | undefined;

  /**
   * @param scriptureForgeAPI Object to use to get project and draft info
   * @param appProjectId Application project id for the project/draft represented by this PDP.
   *   Matches what the app uses but not necessarily the Paratext project id or the Scripture Forge
   *   project id
   * @param projectInfo Information about the project as received from Scripture Forge
   */
  constructor(
    private scriptureForgeAPI: ScriptureForgeAPI,
    private appProjectId: string,
    private projectInfo: ScriptureForgeProjectInfo,
  ) {
    super();
  }

  async getDraftInfo(): Promise<SlingshotDraftInfo> {
    // Determine if user is able to see drafts on the project
    if (!this.projectInfo.projectId) {
      if (!this.projectInfo.isConnectable) return { connectionState: 'cannotSetUp' };
      return { connectionState: 'canSetUp' };
    }
    if (!this.projectInfo.isConnected) {
      if (!this.projectInfo.isConnectable)
        throw new Error(
          `User is not connected to and not able to connect to project with Scripture Forge id ${this.projectInfo.projectId}. Should this be able to happen?`,
        );
      return { connectionState: 'canJoin' };
    }

    // Get info about last completed draft and currently generating draft
    const [lastCompletedDraftStatus, currentlyGeneratingDraftStatus] = await Promise.all([
      this.scriptureForgeAPI.getLastCompletedDraftStatus(this.projectInfo.projectId),
      this.scriptureForgeAPI.getCurrentlyGeneratingDraftStatus(this.projectInfo.projectId),
    ]);

    if (
      lastCompletedDraftStatus === StatusCodes.UNAUTHORIZED ||
      currentlyGeneratingDraftStatus === StatusCodes.UNAUTHORIZED
    )
      return { connectionState: 'notLoggedIn' };
    if (
      lastCompletedDraftStatus === StatusCodes.FORBIDDEN ||
      currentlyGeneratingDraftStatus === StatusCodes.FORBIDDEN
    )
      return { connectionState: 'cannotAccessDrafts' };
    if (
      lastCompletedDraftStatus === StatusCodes.NOT_FOUND ||
      currentlyGeneratingDraftStatus === StatusCodes.NOT_FOUND
    )
      return { connectionState: 'noFinishedDraft' };

    const draftInfo: SlingshotDraftInfo = { connectionState: 'hasFinishedDraft' };

    if (lastCompletedDraftStatus === StatusCodes.NO_CONTENT)
      draftInfo.connectionState = 'noFinishedDraft';
    else if (typeof lastCompletedDraftStatus === 'number')
      throw new Error(
        `Requesting last completed draft status for SF project id ${this.projectInfo.projectId} returned error code ${lastCompletedDraftStatus}! Not sure what to do with this`,
      );

    if (
      typeof currentlyGeneratingDraftStatus === 'number' &&
      currentlyGeneratingDraftStatus !== StatusCodes.NO_CONTENT
    )
      throw new Error(
        `Requesting currently generating draft status for SF project id ${this.projectInfo.projectId} returned error code ${lastCompletedDraftStatus}! Not sure what to do with this`,
      );

    if (lastCompletedDraftStatus !== StatusCodes.NO_CONTENT)
      draftInfo.lastCompletedDraftStatus = lastCompletedDraftStatus;
    if (currentlyGeneratingDraftStatus !== StatusCodes.NO_CONTENT)
      draftInfo.currentlyGeneratingDraftStatus = currentlyGeneratingDraftStatus;

    // Compare to last calculated draft info and send an update if changed
    if (!deepEqual(this.draftInfo, draftInfo)) {
      this.draftInfo = draftInfo;
      this.notifyUpdate('DraftInfo');
    }

    // Return current draft info
    return draftInfo;
  }

  async setDraftInfo(): Promise<
    DataProviderUpdateInstructions<SlingshotDraftInfoProjectInterfaceDataTypes>
  > {
    throw new Error(
      `Cannot change draft info on Slingshot PDP with app project id ${this.appProjectId}`,
    );
  }

  async getChapterUSJ(verseRef: VerseRef): Promise<Usj | undefined> {
    if (!this.projectInfo.projectId) return undefined;

    const draftChapterUsx = await this.scriptureForgeAPI.getDraftChapterUsx(
      this.projectInfo.projectId,
      verseRef.bookNum,
      verseRef.chapterNum,
    );

    if (typeof draftChapterUsx === 'number')
      throw new Error(`Error getting draft chapter USX ${draftChapterUsx}`);

    return draftChapterUsx ? usxStringToUsj(draftChapterUsx) : undefined;
  }

  async setChapterUSJ(): Promise<
    DataProviderUpdateInstructions<USJChapterProjectInterfaceDataTypes>
  > {
    throw new Error(
      `Cannot change chapter USJ on Slingshot PDP with app project id ${this.appProjectId}`,
    );
  }

  async getExtensionData(): Promise<string | undefined> {
    throw new Error(
      `Extension data is not available on Slingshot PDP with app project id ${this.appProjectId}`,
    );
  }

  async setExtensionData(): Promise<
    DataProviderUpdateInstructions<
      MandatoryProjectDataTypes & SlingshotDraftInfoProjectInterfaceDataTypes
    >
  > {
    throw new Error(
      `Extension data is not available on Slingshot PDP with app project id ${this.appProjectId}`,
    );
  }

  async getSetting<ProjectSettingName extends keyof ProjectSettingTypes>(
    key: ProjectSettingName,
  ): Promise<ProjectSettingTypes[ProjectSettingName]> {
    switch (key) {
      case 'platform.fullName':
        return (
          // TypeScript doesn't realize ProjectSettingName is 'platform.fullName' in this case for some reason
          // eslint-disable-next-line no-type-assertion/no-type-assertion
          (this.projectInfo.name as ProjectSettingTypes[ProjectSettingName]) ??
          papi.projectSettings.getDefault(key)
        );
      case 'platform.name':
        return (
          // TypeScript doesn't realize ProjectSettingName is 'platform.name' in this case for some reason
          // eslint-disable-next-line no-type-assertion/no-type-assertion
          (this.projectInfo.shortName as ProjectSettingTypes[ProjectSettingName]) ??
          papi.projectSettings.getDefault(key)
        );
      case 'platform.isEditable':
        return (
          // TypeScript doesn't realize ProjectSettingName is 'platform.isEditable' in this case for some reason
          // eslint-disable-next-line no-type-assertion/no-type-assertion
          false as ProjectSettingTypes[ProjectSettingName]
        );
      case 'platform.language':
        return (
          // This isn't localized, but we don't have a localized language tag
          // TypeScript doesn't realize ProjectSettingName is 'platform.language' in this case for some reason
          // eslint-disable-next-line no-type-assertion/no-type-assertion
          (this.projectInfo.languageTag as ProjectSettingTypes[ProjectSettingName]) ??
          papi.projectSettings.getDefault(key)
        );
      case 'scriptureForge.scriptureForgeProjectId':
        return (
          // TypeScript doesn't realize ProjectSettingName is 'scriptureForge.scriptureForgeProjectId' in this case for some reason
          // eslint-disable-next-line no-type-assertion/no-type-assertion
          (this.projectInfo.projectId as ProjectSettingTypes[ProjectSettingName]) ??
          papi.projectSettings.getDefault(key)
        );
      default:
        return papi.projectSettings.getDefault(key);
    }
  }

  async setSetting(): Promise<
    DataProviderUpdateInstructions<
      MandatoryProjectDataTypes & SlingshotDraftInfoProjectInterfaceDataTypes
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
