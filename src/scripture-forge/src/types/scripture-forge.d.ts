declare module 'scripture-forge' {
  import {
    DataProviderDataType,
    DataProviderSubscriberOptions,
    DataProviderUpdateInstructions,
  } from '@papi/core';
  import type { IProjectDataProvider } from 'papi-shared-types';
  import { UnsubscriberAsync } from 'platform-bible-utils';

  /** Names for pre-defined server configurations */
  export type ServerConfigurationPresetNames = 'dev' | 'qa' | 'live';

  /** Configuration information for connecting to Scripture Forge and authentication servers */
  export type ServerConfiguration = {
    /** Settings related to connecting to the Scripture Forge API */
    scriptureForge: {
      domain: string;
    };
    /** Settings related to authenticating with the authentication server */
    auth: {
      domain: string;
      clientId: string;
    };
  };

  /** States the Scripture Forge Slingshot build can be in */
  export type SlingshotDraftBuildState =
    | 'QUEUED'
    | 'PENDING'
    | 'ACTIVE'
    | 'FINISHING'
    | 'COMPLETED'
    | 'FAULTED'
    | 'CANCELED';

  /** Information about a Scripture Forge Slingshot draft build */
  export type SlingshotDraftBuildInfo = {
    queueDepth: number;
    additionalInfo: {
      buildId: string;
      corporaIds: string[];
      /**
       * Date finished in [date time string
       * format](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format)
       */
      dateFinished: string;
      parallelCorporaIds: string[];
      step: number;
      translationEngineId: string;
    };
    revision: number;
    engine: {
      id: string;
      href: string;
    };
    /** Decimal between 0 and 1 representing percent completion of the draft generation process */
    percentCompleted: number;
    /** Error message if any */
    message: string;
    state: SlingshotDraftBuildState;
    id: string;
    href: string;
  };

  /**
   * Various possible states of a Scripture Forge project and its Slingshot draft
   *
   * - `notLoggedIn`: The user needs to log in to see information (maybe the user just got logged out)
   * - `cannotSetUp`: The project is not set up in Scripture Forge, and this user cannot set it up.
   *   User should contact an admin
   * - `canSetUp`: The project is not set up in Scripture Forge, but this user can set it up. Direct
   *   user to `/projects` in Scripture Forge
   * - `canJoin`: The project is set up in Scripture Forge, and this user can join it. Automatically
   *   join and retry (maybe this should be done on the backend, so maybe this state won't exist
   *   long)
   * - `cannotAccessDrafts`: The project is set up in Scripture Forge, but this user is not allowed to
   *   access Slingshot drafts. User should contact an admin
   * - `noFinishedDraft`: This user has joined the project, but there are no drafts. Direct user to
   *   `/projects/{projectId}/draft-generation` in Scripture Forge
   * - `hasFinishedDraft`: This user has joined the project, and there is a finished draft.
   */
  export type SlingshotProjectConnectionState =
    | 'notLoggedIn'
    | 'cannotSetUp'
    | 'canSetUp'
    | 'canJoin'
    | 'cannotAccessDrafts'
    | 'noFinishedDraft'
    | 'hasFinishedDraft';

  /** Information about a Scripture Forge project and Slingshot drafts */
  export type SlingshotDraftInfo = {
    /**
     * Indicates in what stage of the process of connecting and generating Slingshot drafts this
     * project is in
     */
    connectionState: SlingshotProjectConnectionState;
    /**
     * Information about the latest Slingshot draft in Scripture Forge. Will not be provided if the
     * user cannot access drafts (states `cannotAccessDrafts` and before) or there is not a finished
     * draft (state `noFinishedDraft`)
     */
    lastCompletedDraftStatus?: SlingshotDraftBuildInfo;
    /**
     * Information about the currently generating Slingshot draft. Will not be provided if the user
     * cannot access drafts (states `cannotAccessDrafts` and before) or there is not a draft being
     * generated right now
     */
    currentlyGeneratingDraftStatus?: SlingshotDraftBuildInfo;
  };

  export type SlingshotDraftInfoProjectInterfaceDataTypes = {
    DraftInfo: DataProviderDataType<undefined, SlingshotDraftInfo, never>;
  };

  /** Provides information about Scripture Forge project and Slingshot drafts */
  export type ISlingshotDraftInfoProjectDataProvider =
    IProjectDataProvider<SlingshotDraftInfoProjectInterfaceDataTypes> & {
      /**
       * Gets information about this Scripture Forge project, whether Slingshot drafts are
       * available, and more
       *
       * @param selector `undefined` - No selector needed
       */
      getDraftInfo(selector: undefined): Promise<SlingshotDraftInfo>;
      /** This data cannot be changed. Trying to use this setter this will always throw */
      setDraftInfo(
        selector: undefined,
        data: never,
      ): Promise<DataProviderUpdateInstructions<SlingshotDraftInfoProjectInterfaceDataTypes>>;
      /**
       * Subscribe to run a callback function when the Slingshot draft info changes
       *
       * @param selector `undefined` - No selector needed
       * @param callback Function to run with the updated draft info for this project
       * @param options Various options to adjust how the subscriber emits updates
       * @returns Unsubscriber function (run to unsubscribe from listening for updates)
       */
      subscribeDraftInfo(
        selector: undefined,
        callback: (draftInfo: SlingshotDraftInfo) => void,
        options?: DataProviderSubscriberOptions,
      ): Promise<UnsubscriberAsync>;
    };
}

declare module 'papi-shared-types' {
  import {
    ISlingshotDraftInfoProjectDataProvider,
    ServerConfiguration,
    ServerConfigurationPresetNames,
  } from 'scripture-forge';

  export interface SettingTypes {
    /**
     * Configuration determining which servers to use for Scripture Forge and authentication. You
     * can use the presets {@link ServerConfigurationPresetNames}, or you can specify your own
     * configuration in JSON following the {@link ServerConfiguration} type in the `scripture-forge`
     * extension.
     */
    'scriptureForge.serverConfiguration': ServerConfigurationPresetNames | ServerConfiguration;
    /** Whether to show a notice about Slingshot feature limits on the Scripture Forge web view. */
    'scriptureForge.shouldShowSlingshotDisclaimer': boolean;
  }

  export interface ProjectSettingTypes {
    /**
     * This project's ID according to Scripture Forge. It is generated upon connecting a project to
     * Scripture Forge. This is distinct from the project's ID according to Paratext. Empty means
     * the project is not connected to Scripture Forge.
     */
    'scriptureForge.scriptureForgeProjectId': string;
  }

  export interface CommandHandlers {
    /**
     * If not already logged in, logs the user in by opening Scripture Forge's authentication page
     * in browser.
     *
     * Any previous ongoing attempts to log in will be canceled.
     *
     * Throws if unsuccessful.
     *
     * @returns `true` if the user was not already logged in and is now logged in, `false` if the
     *   user was already logged in
     */
    'scriptureForge.login': () => Promise<boolean>;
    /**
     * Logs out of Scripture Forge.
     *
     * Throws if unsuccessful.
     */
    'scriptureForge.logout': () => Promise<void>;
    /**
     * Determine if the user is logged in to Scripture Forge
     *
     * @returns `true` if the user is logged in, `false` if the user is not logged in
     */
    'scriptureForge.isLoggedIn': () => Promise<boolean>;
    /**
     * Opens a new Scripture Forge home web view and returns the WebView id
     *
     * @returns WebView id for new Scripture Forge home WebView or `undefined` if not created
     */
    'scriptureForge.openScriptureForge': () => Promise<string | undefined>;
  }

  export interface ProjectDataProviderInterfaces {
    'scriptureForge.slingshotDraftInfo': ISlingshotDraftInfoProjectDataProvider;
  }
}
