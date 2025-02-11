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
  languageRegion: string;
  languageScript: string;
  languageTag: string;
  isRightToLeft: boolean;
  /**
   * Scripture Forge's ID for the project. This is NOT the usual ID for the project; see
   * {@link ScriptureForgeProjectInfo.paratextId}
   *
   * If `null`, the project has not set up in Scripture Forge.
   */
  projectId: string | null;
  isConnectable: boolean;
  isConnected: boolean;
};

export default class ScriptureForgeAPI {}
