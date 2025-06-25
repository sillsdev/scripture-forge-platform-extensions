declare module 'scripture-forge' {
  import { SerializedVerseRef } from '@sillsdev/scripture';
  import { Op } from 'quill-delta';
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
      webSocket: string;
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
   * - 'connected': The user is fully connected to the project and has draft access.
   */
  export type SlingshotProjectConnectionState =
    | 'notLoggedIn'
    | 'cannotSetUp'
    | 'canSetUp'
    | 'canJoin'
    | 'cannotAccessDrafts'
    | 'connected';

  /**
   * Various possible states of a Scripture Forge project's Slingshot draft setup progress
   *
   * - `draftingNotAvailable`: Slingshot drafting capabilities have not been granted to this project.
   *   If the user is connected to the project, direct user to ask an admin to set up drafting or
   *   set up drafting at `/projects/{projectId}/draft-generation`
   * - `noFinishedDraft`: There are no finished drafts. If the user is connected to the project and
   *   can access drafts, direct user to `/projects/{projectId}/draft-generation` in Scripture
   *   Forge. Otherwise, direct user to contact an admin
   * - `hasFinishedDraft`: There is a finished draft. If the user is connected, let them open the
   *   draft
   */
  export type SlingshotDraftSetupState =
    | 'draftingNotAvailable'
    | 'noFinishedDraft'
    | 'hasFinishedDraft';

  /** Information about a Scripture Forge project and Slingshot drafts */
  export type SlingshotDraftInfo = {
    /**
     * Indicates what stage of the process of connecting to Scripture Forge and drafting this user
     * is in
     */
    connectionState: SlingshotProjectConnectionState;
    /** Indicates what stage of the process of generating Slingshot drafts this project is in */
    draftSetupState: SlingshotDraftSetupState;
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
       * Attempts to join the project for the currently logged in user.
       *
       * @returns `true` if successfully joined, `false` if already joined, and throws if there was
       *   a problem
       */
      join(): Promise<boolean>;
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

  export type DeltaOperation = Op;

  export type ChapterDeltaOperationsDataTypes = {
    ChapterDeltaOperations: DataProviderDataType<
      SerializedVerseRef,
      DeltaOperation[],
      DeltaOperation[]
    >;
  };

  export type IChapterDeltaOperationsDataProvider =
    IProjectDataProvider<ChapterDeltaOperationsDataTypes>;

  export type ScriptureForgeProjectInterfaceDataTypes = {
    Project: DataProviderDataType<undefined, ScriptureForgeProjectDocument, never>;
  };

  export type IScriptureForgeProjectDataProvider =
    IProjectDataProvider<ScriptureForgeProjectInterfaceDataTypes>;

  // #region Project Document Types

  /**
   * Information about a Scripture Forge project, including its configuration and permissions.
   *
   * Largely a copy of "SFProject" in "sf-project.ts" in the web-xforge repo.
   */
  export type ScriptureForgeProjectDocument = {
    name: string;
    rolePermissions: { [role: string]: string[] };
    userRoles: { [userRef: string]: string };
    userPermissions: { [userRef: string]: string[] };
    /** Whether the project has its capability to synchronize project data turned off. */
    syncDisabled?: boolean;
    paratextId: string;
    shortName: string;
    writingSystem: WritingSystem;
    isRightToLeft?: boolean;
    translateConfig: TranslateConfig;
    checkingConfig: CheckingConfig;
    resourceConfig?: ResourceConfig;
    texts: TextInfo[];
    noteTags?: NoteTag[];
    sync: Sync;
    editable: boolean;
    defaultFontSize?: number;
    defaultFont?: string;
    maxGeneratedUsersPerShareKey?: number;
    biblicalTermsConfig: BiblicalTermsConfig;
    copyrightBanner?: string;
    copyrightNotice?: string;
    paratextUsers: ParatextUserProfile[];
  };

  export type BaseProject = {
    paratextId: string;
    shortName: string;
  };

  export type BiblicalTermsConfig = {
    biblicalTermsEnabled: boolean;
    errorMessage?: string;
    hasRenderings: boolean;
  };

  export type Chapter = {
    number: number;
    lastVerse: number;
    isValid: boolean;
    permissions: { [userRef: string]: string };
    hasAudio?: boolean;
    hasDraft?: boolean;
    draftApplied?: boolean;
  };

  export enum CheckingAnswerExport {
    All = 'all',
    MarkedForExport = 'marked_for_export',
    None = 'none',
  }

  export type CheckingConfig = {
    checkingEnabled: boolean;
    usersSeeEachOthersResponses: boolean;
    answerExportMethod: CheckingAnswerExport;
    noteTagId?: number;
    hideCommunityCheckingText?: boolean;
  };

  export type DraftConfig = {
    additionalTrainingData: boolean;
    additionalTrainingSourceEnabled: boolean;
    additionalTrainingSource?: TranslateSource;
    alternateSourceEnabled: boolean;
    alternateSource?: TranslateSource;
    alternateTrainingSourceEnabled: boolean;
    alternateTrainingSource?: TranslateSource;
    lastSelectedTrainingBooks: number[];
    lastSelectedTrainingDataFiles: string[];
    lastSelectedTrainingScriptureRange?: string;
    lastSelectedTrainingScriptureRanges?: ProjectScriptureRange[];
    lastSelectedTranslationBooks: number[];
    lastSelectedTranslationScriptureRange?: string;
    lastSelectedTranslationScriptureRanges?: ProjectScriptureRange[];
    servalConfig?: string;
    usfmConfig?: DraftUsfmConfig;
  };

  export type DraftUsfmConfig = {
    paragraphFormat: ParagraphBreakFormat;
  };

  export type NoteTag = {
    tagId: number;
    name: string;
    icon: string;
    creatorResolve: boolean;
  };

  export enum ParagraphBreakFormat {
    BestGuess = 'best_guess',
    Remove = 'remove',
    MoveToEnd = 'move_to_end',
  }

  export type ParatextUserProfile = {
    username: string;
    opaqueUserId: string;
    sfUserId?: string;
  };

  /** A per-project scripture range. */
  export type ProjectScriptureRange = {
    projectId: string;
    scriptureRange: string;
  };

  export enum ProjectType {
    Standard = 'Standard',
    Resource = 'Resource',
    BackTranslation = 'BackTranslation',
    Daughter = 'Daughter',
    Transliteration = 'Transliteration',
    TransliterationManual = 'TransliterationManual',
    TransliterationWithEncoder = 'TransliterationWithEncoder',
    StudyBible = 'StudyBible',
    ConsultantNotes = 'ConsultantNotes',
    GlobalConsultantNotes = 'GlobalConsultantNotes',
    GlobalAnthropologyNotes = 'GlobalAnthropologyNotes',
    StudyBibleAdditions = 'StudyBibleAdditions',
    Auxiliary = 'Auxiliary',
    AuxiliaryResource = 'AuxiliaryResource',
    MarbleResource = 'MarbleResource',
    Xml = 'Xml',
    XmlResource = 'XmlResource',
    XmlDictionary = 'XmlDictionary',
    SourceLanguage = 'SourceLanguage',
    Dictionary = 'Dictionary',
    EnhancedResource = 'EnhancedResource',
  }

  export type ResourceConfig = {
    createdTimestamp: Date;
    manifestChecksum: string;
    permissionsChecksum: string;
    revision: number;
  };

  export type Sync = {
    queuedCount: number;
    lastSyncSuccessful?: boolean;
    dateLastSuccessfulSync?: string;
    syncedToRepositoryVersion?: string;
    /**
     * Indicates if PT project data from the last send/receive operation was incorporated into the
     * SF project docs
     */
    dataInSync?: boolean;
    lastSyncErrorCode?: number;
  };

  export type TextInfo = {
    bookNum: number;
    hasSource: boolean;
    chapters: Chapter[];
    permissions: { [userRef: string]: string };
  };

  export type TranslateConfig = {
    translationSuggestionsEnabled: boolean;
    source?: TranslateSource;
    defaultNoteTagId?: number;
    preTranslate: boolean;
    draftConfig: DraftConfig;
    projectType?: ProjectType;
    baseProject?: BaseProject;
  };

  export enum TranslateShareLevel {
    Anyone = 'anyone',
    Specific = 'specific',
  }

  export type TranslateSource = {
    paratextId: string;
    projectRef: string;
    name: string;
    shortName: string;
    writingSystem: WritingSystem;
    isRightToLeft?: boolean;
  };

  export type WritingSystem = {
    script?: string;
    region?: string;
    tag: string;
  };

  // #endregion
}

declare module 'papi-shared-types' {
  import {
    IChapterDeltaOperationsDataProvider,
    IScriptureForgeProjectDataProvider,
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
    'scriptureForge.openAutoDrafts': () => Promise<string | undefined>;
  }

  export interface ProjectDataProviderInterfaces {
    'scriptureForge.chapterDeltaOperations': IChapterDeltaOperationsDataProvider;
    'scriptureForge.scriptureForgeProject': IScriptureForgeProjectDataProvider;
    'scriptureForge.slingshotDraftInfo': ISlingshotDraftInfoProjectDataProvider;
  }
}
