import { SlingshotDraftBuildInfo } from 'scripture-forge';
import { StatusCodes } from 'http-status-codes';
import { Usj } from '@biblionexus-foundation/scripture-utilities';
import ScriptureForgeAuthenticationProvider from '../auth/scripture-forge-authentication-provider.model';

const PROJECT_ENDPOINT = '/paratext-api/projects';

/**
 * Information about a project as received from Scripture Forge's `paratext-api/projects` endpoint
 *
 * Projects can be in one of multiple states regarding connectivity:
 *
 * - Not set up in Scripture Forge, and user cannot set it up: `projectId` is `null`, `isConnectable`
 *   is `false`, `isConnected` is `false`. An admin must set up the project in Scripture Forge.
 * - Not set up in Scripture Forge, and user can set it up: `projectId` is `null`, `isConnectable` is
 *   `true`, `isConnected` is `false`. The user is an admin who can set up the project in Scripture
 *   Forge.
 * - Set up in Scripture Forge but this user is not connected: `projectId` is not `null`,
 *   `isConnectable` is `true`, `isConnected` is `false`. The user can "join" the project.
 * - Set up in Scripture Forge and this user is connected: `projectId` is not `null`, `isConnectable`
 *   is `true`, `isConnected` is `true`. The user is fully connected and ready to open Slingshot
 *   drafts
 */
export type ScriptureForgeProjectInfo = {
  /**
   * ID of the project according to Paratext (and presumably everything other than Scripture Forge;
   * see {@link ScriptureForgeProjectInfo.projectId})
   */
  paratextId: string;
  name: string;
  shortName: string;
  languageRegion: string | null;
  languageScript: string | null;
  languageTag: string | null;
  isRightToLeft: boolean | null;
  /**
   * Scripture Forge's ID for the project. This is NOT the usual ID for the project; see
   * {@link ScriptureForgeProjectInfo.paratextId}
   *
   * If `null`, the project has not set up in Scripture Forge.
   */
  projectId: string | null;
  isConnectable: boolean;
  isConnected: boolean;
  /** Whether drafting is set up on the project */
  isDraftingEnabled: boolean;
  /** Whether the project has a finished draft */
  hasDraft: boolean;
};

/**
 * Class for interacting with Scripture Forge API. Allows you to get project info, Slingshot draft
 * info, and Slingshot draft contents
 *
 * https://docs.google.com/document/d/1M2KjgHlJcUlFWLOlykzZiKsbDCRECrLn2Ykk78s2ZdA/edit?tab=t.0
 *
 * https://documenter.getpostman.com/view/14137778/2sAYdZuu9t#7e49b5c0-5649-4800-ba57-975e0ffa14c1
 */
export default class ScriptureForgeApi {
  #authenticationProvider: ScriptureForgeAuthenticationProvider;

  constructor(authenticationProvider: ScriptureForgeAuthenticationProvider) {
    this.#authenticationProvider = authenticationProvider;
  }

  /**
   * Get list of projects you have access to in Scripture Forge.
   *
   * @returns Array of {@link ScriptureForgeProjectInfo} objects describing each project. If the
   *   request fails or returns {@link StatusCodes.NO_CONTENT}, returns the status code.
   */
  async getProjects(): Promise<ScriptureForgeProjectInfo[] | StatusCodes> {
    const projectResponse =
      await this.#authenticationProvider.fetchWithAuthorization(PROJECT_ENDPOINT);

    if (!projectResponse.ok || projectResponse.status === StatusCodes.NO_CONTENT) {
      return projectResponse.status;
    }

    // We can infer that this json will come back as an array of ScriptureForgeProjectInfo objects
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    return (await projectResponse.json()) as ScriptureForgeProjectInfo[];
  }

  /**
   * Attempts to join the project for the currently logged in user.
   *
   * @param projectId - The Scripture Forge identifier for the project.
   * @returns A promise that resolves to `undefined` if successful or the status code returned from
   *   the endpoint if unsuccessful
   */
  async joinProject(projectId: string): Promise<undefined | StatusCodes> {
    const joinProjectEndpoint = `/paratext-api/projects/${projectId}/join`;
    const joinProjectResponse = await this.#authenticationProvider.fetchWithAuthorization(
      joinProjectEndpoint,
      { method: 'POST' },
    );

    if (!joinProjectResponse.ok) return joinProjectResponse.status;

    return undefined;
  }

  /**
   * Fetches the status of the last completed draft build for a given project.
   *
   * @param projectId - The Scripture Forge identifier for the project.
   * @returns A promise that resolves to the status of the last completed draft build, either as a
   *   SlingshotDraftBuildInfo object or a StatusCodes value indicating an error or special
   *   condition.
   */
  async getLastCompletedDraftStatus(
    projectId: string,
  ): Promise<SlingshotDraftBuildInfo | StatusCodes> {
    const lastCompletedDraftStatusEndpoint = `/machine-api/v3/translation/engines/project:${projectId}/actions/getLastCompletedPreTranslationBuild`;
    const lastCompletedDraftStatusResponse =
      await this.#authenticationProvider.fetchWithAuthorization(lastCompletedDraftStatusEndpoint);

    if (
      !lastCompletedDraftStatusResponse.ok ||
      lastCompletedDraftStatusResponse.status === StatusCodes.NO_CONTENT
    )
      return lastCompletedDraftStatusResponse.status;

    // We can infer that this json will come back as a SlingshotDraftBuildInfo
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    return (await lastCompletedDraftStatusResponse.json()) as SlingshotDraftBuildInfo;
  }

  /**
   * Fetches the status of the currently generating draft build for a given project.
   *
   * @param projectId - The Scripture Forge identifier for the project.
   * @returns A promise that resolves to the status of the currently generating draft build, either
   *   as a SlingshotDraftBuildInfo object or a StatusCodes value indicating an error or special
   *   condition.
   */
  async getCurrentlyGeneratingDraftStatus(
    projectId: string,
  ): Promise<SlingshotDraftBuildInfo | StatusCodes> {
    const currentlyGeneratingDraftStatusEndpoint = `/machine-api/v3/translation/builds/id:${projectId}?preTranslate=true`;
    const currentlyGeneratingDraftStatusResponse =
      await this.#authenticationProvider.fetchWithAuthorization(
        currentlyGeneratingDraftStatusEndpoint,
      );

    if (
      !currentlyGeneratingDraftStatusResponse.ok ||
      currentlyGeneratingDraftStatusResponse.status === StatusCodes.NO_CONTENT
    )
      return currentlyGeneratingDraftStatusResponse.status;

    // We can infer that this json will come back as a SlingshotDraftBuildInfo
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    return (await currentlyGeneratingDraftStatusResponse.json()) as SlingshotDraftBuildInfo;
  }

  /**
   * Fetches the USX for a given chapter of a given project from the a completed draft build.
   *
   * @param projectId - The Scripture Forge identifier for the project.
   * @param bookNum - The book number.
   * @param chapterNum - The chapter number.
   * @returns A promise that resolves to the USX for the given chapter, or undefined if the request
   *   fails, or the string 'cannotAccessDrafts' if the user cannot access the draft.
   */
  async getDraftChapterUsx(
    projectId: string,
    bookNum: number,
    chapterNum: number,
  ): Promise<string | StatusCodes> {
    const getDraftChapterUsxEndpoint = `/machine-api/v3/translation/engines/project:${projectId}/actions/preTranslate/${bookNum}_${chapterNum}/usx`;
    const getDraftChapterUsxResponse = await this.#authenticationProvider.fetchWithAuthorization(
      getDraftChapterUsxEndpoint,
    );

    if (
      !getDraftChapterUsxResponse.ok ||
      getDraftChapterUsxResponse.status === StatusCodes.NO_CONTENT
    )
      return getDraftChapterUsxResponse.status;

    // The usx will come as a text string
    return getDraftChapterUsxResponse.text();
  }

  /**
   * Fetches the USX for a given chapter of a given project from the a completed draft build.
   *
   * @param projectId - The Scripture Forge identifier for the project.
   * @param bookNum - The book number.
   * @param chapterNum - The chapter number.
   * @returns A promise that resolves to the USX for the given chapter, or undefined if the request
   *   fails, or the string 'cannotAccessDrafts' if the user cannot access the draft.
   */
  async getDraftChapterUsj(
    projectId: string,
    bookNum: number,
    chapterNum: number,
  ): Promise<Usj | StatusCodes> {
    const getDraftChapterUsjEndpoint = `/machine-api/v3/translation/engines/project:${projectId}/actions/preTranslate/${bookNum}_${chapterNum}/usj`;
    const getDraftChapterUsjResponse = await this.#authenticationProvider.fetchWithAuthorization(
      getDraftChapterUsjEndpoint,
    );

    if (
      !getDraftChapterUsjResponse.ok ||
      getDraftChapterUsjResponse.status === StatusCodes.NO_CONTENT
    )
      return getDraftChapterUsjResponse.status;

    // We can infer that this json will come back as Usj
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    return (await getDraftChapterUsjResponse.json()) as Usj;
  }
}
