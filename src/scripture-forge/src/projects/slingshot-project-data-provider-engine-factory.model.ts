import {
  IProjectDataProviderEngine,
  IProjectDataProviderEngineFactory,
  ProjectMetadataWithoutFactoryInfo,
} from '@papi/core';
import { logger } from '@papi/backend';
import { Dispose, getErrorMessage, Mutex, PlatformEvent, Unsubscriber } from 'platform-bible-utils';
import { StatusCodes } from 'http-status-codes';
import SlingshotProjectDataProviderEngine, {
  SLINGSHOT_PROJECT_INTERFACES,
} from './slingshot-project-data-provider-engine.model';
import ScriptureForgeApi, { ScriptureForgeProjectInfo } from './scripture-forge-api.model';
import { NOT_LOGGED_IN_ERROR_MESSAGE } from '../auth/scripture-forge-authentication-provider.model';

/**
 * Duration in milliseconds to throttle the `getProjects` API call. We will return the previous
 * result until this amount of time has passed
 */
const GET_PROJECTS_THROTTLE_MS = 5 * 1000;

/**
 * Returns the project id the application will use to identify Slingshot drafts for a Scripture
 * Forge project id. Using a modified Paratext project ID because each Scripture Forge project has
 * one (it doesn't always have its own Scripture Forge project id) and so we do not overlap with the
 * actual paratext project if the user has it installed in the app
 *
 * @param projectId Paratext project id
 * @returns Project id identifying the Slingshot draft project
 */
function getSlingshotAppProjectId(projectId: string): string {
  return `${projectId}-slingshot-draft`;
}

export default class SlingshotProjectDataProviderEngineFactory
  implements IProjectDataProviderEngineFactory<typeof SLINGSHOT_PROJECT_INTERFACES>, Dispose
{
  private projectInfoByAppProjectId = new Map<string, ScriptureForgeProjectInfo>();
  private pdpeByAppProjectId = new Map<string, SlingshotProjectDataProviderEngine>();
  /** Last time we ran `getProjects` on the API so we can throttle it */
  private lastGetProjectsTime: number = 0;
  private lastAvailableProjects: ProjectMetadataWithoutFactoryInfo[] = [];
  private getProjectsMutex = new Mutex();
  /**
   * If we know we are logged out and therefore shouldn't try to check for projects. If this is
   * `false`, it doesn't mean we are logged in but that we need to try getting projects again
   */
  private isLoggedOut = false;
  private onDidSessionChangeUnsubscriber: Unsubscriber;

  constructor(
    private scriptureForgeApi: ScriptureForgeApi,
    onDidSessionChange: PlatformEvent<undefined>,
  ) {
    this.onDidSessionChangeUnsubscriber = onDidSessionChange(() => {
      this.isLoggedOut = false;
    });
  }

  async getAvailableProjects(): Promise<ProjectMetadataWithoutFactoryInfo[]> {
    return this.#getAvailableProjects();
  }

  async createProjectDataProviderEngine(
    appProjectId: string,
  ): Promise<IProjectDataProviderEngine<typeof SLINGSHOT_PROJECT_INTERFACES>> {
    const projectInfo = this.projectInfoByAppProjectId.get(appProjectId);
    if (!projectInfo)
      throw new Error(`Scripture Forge Project info not found for app project id ${appProjectId}`);
    const pdpe = new SlingshotProjectDataProviderEngine(
      this.scriptureForgeApi,
      appProjectId,
      projectInfo,
      async () => {
        // Force update available projects
        await this.#getAvailableProjects(true);
      },
    );
    this.pdpeByAppProjectId.set(appProjectId, pdpe);
    return pdpe;
  }

  async dispose(): Promise<boolean> {
    return this.onDidSessionChangeUnsubscriber();
  }

  /**
   * Gets available projects from cache or reaches out to get new project info
   *
   * @param force If `true`, will get new project info
   */
  async #getAvailableProjects(force = false) {
    if (force) this.lastGetProjectsTime = 0;
    // If we're not forcing and we know we're logged out, return empty array instead of failing
    // again because we know we're already logged out
    else if (this.isLoggedOut) return [];

    if (Date.now() - this.lastGetProjectsTime < GET_PROJECTS_THROTTLE_MS)
      return this.lastAvailableProjects;

    const lastAvailableProjectsBeforeMutex = this.lastAvailableProjects;

    return this.getProjectsMutex.runExclusive(async () => {
      // If another call got a new set of available projects while waiting on the mutex, return it
      if (!force && lastAvailableProjectsBeforeMutex !== this.lastAvailableProjects)
        return this.lastAvailableProjects;

      let projectsInfo: Awaited<ReturnType<typeof this.scriptureForgeApi.getProjects>>;
      try {
        projectsInfo = await this.scriptureForgeApi.getProjects();
      } catch (e) {
        const errorMessage = getErrorMessage(e);
        logger.warn(
          `Slingshot PDPEF caught Scripture Forge API error while getting available projects. ${errorMessage}`,
        );

        // Keep track if we're logged out so we don't keep spamming the logs
        if (errorMessage === NOT_LOGGED_IN_ERROR_MESSAGE) this.isLoggedOut = true;

        return [];
      }

      if (typeof projectsInfo === 'number') {
        if (projectsInfo !== StatusCodes.NO_CONTENT)
          logger.warn(
            `Slingshot PDPEF received error while getting available projects: ${projectsInfo}`,
          );
        return [];
      }

      this.lastGetProjectsTime = Date.now();

      this.lastAvailableProjects = projectsInfo.map((projectInfo) => {
        const appProjectId = getSlingshotAppProjectId(projectInfo.paratextId);

        this.projectInfoByAppProjectId.set(appProjectId, projectInfo);

        // Update existing PDPE with the new project info
        const pdpe = this.pdpeByAppProjectId.get(appProjectId);
        if (pdpe) pdpe.projectInfo = projectInfo;

        return { projectInterfaces: SLINGSHOT_PROJECT_INTERFACES, id: appProjectId };
      });

      return this.lastAvailableProjects;
    });
  }
}
