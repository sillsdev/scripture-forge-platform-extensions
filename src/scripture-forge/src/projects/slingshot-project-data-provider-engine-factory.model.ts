import {
  IProjectDataProviderEngine,
  IProjectDataProviderEngineFactory,
  ProjectMetadataWithoutFactoryInfo,
} from '@papi/core';
import SlingshotProjectDataProviderEngine, {
  SLINGSHOT_PROJECT_INTERFACES,
} from './slingshot-project-data-provider-engine.model';
import ScriptureForgeAPI, { ScriptureForgeProjectInfo } from './scripture-forge-api.model';

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
  implements IProjectDataProviderEngineFactory<typeof SLINGSHOT_PROJECT_INTERFACES>
{
  private projectInfoByAppProjectId = new Map<string, ScriptureForgeProjectInfo>();

  constructor(private scriptureForgeAPI: ScriptureForgeAPI) {}

  async getAvailableProjects(): Promise<ProjectMetadataWithoutFactoryInfo[]> {
    const projectsInfo = await this.scriptureForgeAPI.getProjects();
    return projectsInfo
      ? projectsInfo.map((projectInfo) => {
          const appProjectId = getSlingshotAppProjectId(projectInfo.paratextId);

          this.projectInfoByAppProjectId.set(appProjectId, projectInfo);

          // TODO: If the project info updates, update existing PDP

          return {
            projectInterfaces: SLINGSHOT_PROJECT_INTERFACES,
            id: appProjectId,
            name: projectInfo.shortName,
          };
        })
      : [];
  }

  async createProjectDataProviderEngine(
    appProjectId: string,
  ): Promise<IProjectDataProviderEngine<typeof SLINGSHOT_PROJECT_INTERFACES>> {
    const projectInfo = this.projectInfoByAppProjectId.get(appProjectId);
    if (!projectInfo)
      throw new Error(`Scripture Forge Project info not found for app project id ${appProjectId}`);
    return new SlingshotProjectDataProviderEngine(
      this.scriptureForgeAPI,
      appProjectId,
      projectInfo,
    );
  }
}
