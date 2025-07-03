import {
  IProjectDataProviderEngine,
  IProjectDataProviderEngineFactory,
  ProjectMetadataWithoutFactoryInfo,
} from '@papi/core';
import ScriptureForgeProjectDataProviderEngine, {
  SCRIPTURE_FORGE_PROJECT_INTERFACES,
} from './scripture-forge-project-data-provider-engine.model';

export default class ScriptureForgeProjectDataProviderEngineFactory
  implements IProjectDataProviderEngineFactory<typeof SCRIPTURE_FORGE_PROJECT_INTERFACES>
{
  private pdpeByAppProjectId = new Map<string, ScriptureForgeProjectDataProviderEngine>();

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  async getAvailableProjects(): Promise<ProjectMetadataWithoutFactoryInfo[]> {
    // TODO: Retrieve real project IDs here
    return [
      {
        projectInterfaces: SCRIPTURE_FORGE_PROJECT_INTERFACES,
        id: '<INSERT HARD CODED PROJECT ID FOR NOW>',
      },
    ];
  }

  async createProjectDataProviderEngine(
    appProjectId: string,
  ): Promise<IProjectDataProviderEngine<typeof SCRIPTURE_FORGE_PROJECT_INTERFACES>> {
    const pdpe = new ScriptureForgeProjectDataProviderEngine(appProjectId);
    this.pdpeByAppProjectId.set(appProjectId, pdpe);
    return pdpe;
  }
}
