import { UseWebViewStateHook } from '@papi/core';
import papi, { logger } from '@papi/frontend';
import { ChevronDown, ChevronsUpDown, ChevronUp, ExternalLink } from 'lucide-react';
import {
  Button,
  cn,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'platform-bible-react';
import { formatReplacementString, getErrorMessage, LanguageStrings } from 'platform-bible-utils';
import { PropsWithChildren, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ISlingshotDraftInfoProjectDataProvider,
  ServerConfiguration,
  SlingshotDraftInfo,
  SlingshotDraftSetupState,
  SlingshotProjectConnectionState,
} from 'scripture-forge';

type SortConfig = {
  key: 'fullName' | 'language' | 'draftSetupState' | 'action';
  direction: 'ascending' | 'descending';
};

export type ProjectTableProps = {
  serverConfiguration: ServerConfiguration;
  useWebViewState: UseWebViewStateHook;
  localizedStrings: LanguageStrings;
};

type ProjectInfo = {
  projectId: string;
  isEditable: boolean;
  fullName: string;
  name: string;
  language: string;
  scriptureForgeProjectId: string;
  draftInfo: SlingshotDraftInfo;
  draftInfoPdp: ISlingshotDraftInfoProjectDataProvider;
};

/** Exhaustive ordered list of {@link SlingshotProjectConnectionState}s */
const SLINGSHOT_PROJECT_CONNECTION_STATES: SlingshotProjectConnectionState[] = [
  'notLoggedIn',
  'cannotSetUp',
  'canSetUp',
  'canJoin',
  'cannotAccessDrafts',
  'connected',
];

/** Exhaustive ordered list of {@link SlingshotDraftSetupState}s */
const SLINGSHOT_DRAFT_SETUP_STATES: SlingshotDraftSetupState[] = [
  'draftingNotAvailable',
  'noFinishedDraft',
  'hasFinishedDraft',
];

/**
 * Time in milliseconds to wait before polling again for projects info when there is a draft
 * generating
 */
const DRAFT_GENERATING_POLL_TIME_MS = 30 * 1000;

function ExternalLinkButton({ link, children }: PropsWithChildren<{ link: string }>) {
  return (
    <Button variant="secondary" onClick={() => window.open(link)} className="tw-text-sm">
      <span className="tw-pe-1">{children}</span>
      <ExternalLink />
    </Button>
  );
}

/**
 * Renders a table of projects with sorting functionality.
 *
 * This component fetches project metadata and displays it in a table format. It includes sorting
 * functionality for the columns and displays a loading spinner while the data is being fetched. The
 * table headers are clickable to sort the data by 'Full Name', 'Language', or 'Action'. The sorting
 * direction toggles between ascending and descending.
 *
 * The project data includes various attributes like project ID, editable status, full name, short
 * name, language, and draft information. The component uses hooks such as `useState` for managing
 * the sorting configuration and `usePromise` for handling asynchronous data fetching.
 */
export default function ProjectTable({
  serverConfiguration,
  useWebViewState,
  localizedStrings,
}: ProjectTableProps) {
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  });

  const [sortConfig, setSortConfig] = useWebViewState<SortConfig>('sortConfig', {
    key: 'language',
    direction: 'ascending',
  });

  const [refreshProjectsInfoListener, refreshProjectsInfo] = useReducer((x) => x + 1, 0);

  const [projectsInfo, setProjectsInfo] = useState<ProjectInfo[]>([]);
  /** Which projects the user is currently in the process of joining */
  const [projectIdsJoining, setProjectIdsJoining] = useState<string[]>([]);

  useEffect(() => {
    // Needed to use this in the function to add it to the dependency array to get projects info
    // again when we know something changes
    // eslint-disable-next-line no-unused-expressions
    refreshProjectsInfoListener;

    let isPromiseCurrent = true;
    // Whether there are any projects whose first draft is generating. We will re-retrieve
    // projects info later to check if it finishes.
    let pollTimeout: ReturnType<typeof setTimeout> | undefined;

    async function getProjectsInfo() {
      try {
        const projectMetadata = await papi.projectLookup.getMetadataForAllProjects({
          includeProjectInterfaces: ['scriptureForge.slingshotDraftInfo'],
        });
        const retrievedProjectsInfo = await Promise.all(
          projectMetadata.map(async (metadata): Promise<ProjectInfo> => {
            const pdp = await papi.projectDataProviders.get('platform.base', metadata.id);
            const draftInfoPdp = await papi.projectDataProviders.get(
              'scriptureForge.slingshotDraftInfo',
              metadata.id,
            );
            const draftInfo = await draftInfoPdp.getDraftInfo(undefined);

            if (
              draftInfo.currentlyGeneratingDraftStatus &&
              draftInfo.currentlyGeneratingDraftStatus.state !== 'COMPLETED' &&
              !pollTimeout
            )
              pollTimeout = setTimeout(() => {
                refreshProjectsInfo();
              }, DRAFT_GENERATING_POLL_TIME_MS);

            return {
              projectId: metadata.id,
              isEditable: await pdp.getSetting('platform.isEditable'),
              fullName: await pdp.getSetting('platform.fullName'),
              name: await pdp.getSetting('platform.name'),
              language: await pdp.getSetting('platform.language'),
              scriptureForgeProjectId: await pdp.getSetting(
                'scriptureForge.scriptureForgeProjectId',
              ),
              draftInfo,
              draftInfoPdp,
            };
          }),
        );

        if (isPromiseCurrent) {
          setProjectsInfo(retrievedProjectsInfo);
        }
      } catch (e) {
        logger.warn(
          `ProjectTable failed to get project info for Scripture Forge projects: ${getErrorMessage(e)}`,
        );
      }
    }

    getProjectsInfo();

    return () => {
      isPromiseCurrent = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [refreshProjectsInfoListener]);

  const sortedProjectsInfo = useMemo(() => {
    return projectsInfo.sort((a, b) => {
      switch (sortConfig.key) {
        case 'fullName':
          if (a.fullName < b.fullName) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (a.fullName > b.fullName) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        case 'language':
          if (a.language < b.language) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (a.language > b.language) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        case 'draftSetupState': {
          const aStateIndex = SLINGSHOT_DRAFT_SETUP_STATES.indexOf(a.draftInfo.draftSetupState);
          const bStateIndex = SLINGSHOT_DRAFT_SETUP_STATES.indexOf(b.draftInfo.draftSetupState);
          if (aStateIndex < bStateIndex) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aStateIndex > bStateIndex) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }
        case 'action': {
          const aStateIndex = SLINGSHOT_PROJECT_CONNECTION_STATES.indexOf(
            a.draftInfo.connectionState,
          );
          const bStateIndex = SLINGSHOT_PROJECT_CONNECTION_STATES.indexOf(
            b.draftInfo.connectionState,
          );
          if (aStateIndex < bStateIndex) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aStateIndex > bStateIndex) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }
        default:
          return 0;
      }
    });
  }, [projectsInfo, sortConfig]);

  const handleSort = (key: SortConfig['key']) => {
    const newSortConfig: SortConfig = { key, direction: 'ascending' };
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      newSortConfig.direction = 'descending';
    }
    setSortConfig(newSortConfig);
  };

  const buildTableHead = (key: SortConfig['key'], label: string, className?: string) => (
    <TableHead className={className} onClick={() => handleSort(key)}>
      <div className="tw-flex tw-items-center">
        <div className="tw-font-normal">{label}</div>
        {sortConfig.key !== key && <ChevronsUpDown className="tw-ps-1" size={16} />}
        {sortConfig.key === key &&
          (sortConfig.direction === 'ascending' ? (
            <ChevronUp className="tw-ps-1" size={16} />
          ) : (
            <ChevronDown className="tw-ps-1" size={16} />
          ))}
      </div>
    </TableHead>
  );

  const buildTableDraftSetupStateElement = (projectInfo: ProjectInfo) => {
    const { connectionState, draftSetupState } = projectInfo.draftInfo;
    const isDraftGenerating =
      projectInfo.draftInfo.currentlyGeneratingDraftStatus &&
      projectInfo.draftInfo.currentlyGeneratingDraftStatus.state !== 'COMPLETED';

    let statusText = '';

    if (connectionState === 'cannotSetUp' || connectionState === 'canSetUp')
      statusText = localizedStrings['%scriptureForge_draft_status_notConnected%'];
    else if (connectionState === 'cannotAccessDrafts')
      statusText = localizedStrings['%scriptureForge_draft_status_noAccess%'];

    if (!statusText) {
      switch (draftSetupState) {
        case 'draftingNotAvailable':
          statusText = localizedStrings['%scriptureForge_draft_status_draftingNotAvailable%'];
          break;
        case 'noFinishedDraft':
          statusText = isDraftGenerating
            ? localizedStrings['%scriptureForge_draft_status_generating%']
            : localizedStrings['%scriptureForge_draft_status_noFinishedDraft%'];
          break;
        case 'hasFinishedDraft':
          statusText = isDraftGenerating
            ? localizedStrings['%scriptureForge_draft_status_generating%']
            : localizedStrings['%scriptureForge_draft_status_hasFinishedDraft%'];
          break;
        default:
          throw new Error(
            `Project ${projectInfo.scriptureForgeProjectId} has invalid draftSetupState ${draftSetupState}`,
          );
      }
    }

    return <div className="tw-text-xs">{statusText}</div>;
  };

  const buildTableActionElement = (projectInfo: ProjectInfo) => {
    const { connectionState, draftSetupState } = projectInfo.draftInfo;

    switch (connectionState) {
      case 'notLoggedIn':
        return;
      case 'cannotSetUp':
        return (
          <div className="tw-text-xs">
            {localizedStrings['%scriptureForge_draft_action_cannotSetUp%']}
          </div>
        );
      case 'canSetUp':
        return (
          <ExternalLinkButton link={serverConfiguration.scriptureForge.domain}>
            {localizedStrings['%scriptureForge_draft_action_canSetUp%']}
          </ExternalLinkButton>
        );
      case 'canJoin': {
        const isJoining = projectIdsJoining.includes(projectInfo.projectId);
        return (
          <Button
            disabled={isJoining}
            onClick={async () => {
              try {
                setProjectIdsJoining((projectIdsJoiningCurrent) =>
                  projectIdsJoiningCurrent.concat(projectInfo.projectId),
                );
                await projectInfo.draftInfoPdp.join();
                if (isMounted.current) {
                  setProjectIdsJoining((projectIdsJoiningCurrent) =>
                    projectIdsJoiningCurrent.filter(
                      (projectId) => projectId !== projectInfo.projectId,
                    ),
                  );
                  refreshProjectsInfo();
                }
              } catch (e) {
                logger.warn(
                  `Tried to join project ${projectInfo.scriptureForgeProjectId} but received error. ${getErrorMessage(e)}`,
                );
              }
            }}
            className="tw-text-sm"
          >
            {isJoining ? <Spinner /> : localizedStrings['%scriptureForge_draft_action_canJoin%']}
          </Button>
        );
      }
      case 'cannotAccessDrafts':
        return (
          <div className="tw-text-xs">
            {localizedStrings['%scriptureForge_draft_action_cannotAccessDrafts%']}
          </div>
        );
      case 'connected': {
        const isDraftGenerating =
          projectInfo.draftInfo.currentlyGeneratingDraftStatus &&
          projectInfo.draftInfo.currentlyGeneratingDraftStatus.state !== 'COMPLETED';

        if (draftSetupState === 'hasFinishedDraft')
          return (
            <div className="tw-flex tw-flex-row tw-gap-1">
              {isDraftGenerating && <Spinner />}
              <Button
                variant={isDraftGenerating ? 'secondary' : 'default'}
                className="tw-text-sm"
                onClick={() =>
                  papi.commands.sendCommand(
                    'platformScriptureEditor.openResourceViewer',
                    projectInfo.projectId,
                    {
                      title: '%webView_scriptureForge_editor_title_format%',
                      iconUrl:
                        'papi-extension://scriptureForge/assets/images/lucide-sparkles-0.378.0.svg',
                      decorations: {
                        headers: {
                          'slingshot-ai-header': {
                            title: '%scriptureForge_draft_viewer_header_title%',
                            iconUrl:
                              'papi-extension://scriptureForge/assets/images/lucide-sparkles-0.378.0.svg',
                            descriptionMd: formatReplacementString(
                              localizedStrings[
                                '%scriptureForge_draft_viewer_header_description_md%'
                              ],
                              {
                                scriptureForgeProjectGenerateDraftUrl: `${serverConfiguration.scriptureForge.domain}/projects/${projectInfo.scriptureForgeProjectId}/draft-generation`,
                              },
                            ),
                          },
                        },
                        containers: {
                          'slingshot-ai-container': {
                            style: {
                              border: 'dashed hsl(var(--muted-foreground))',
                            },
                          },
                        },
                      },
                    },
                  )
                }
              >
                {isDraftGenerating
                  ? localizedStrings['%scriptureForge_draft_action_connected_viewOldDraft%']
                  : localizedStrings['%scriptureForge_draft_action_connected_viewDraft%']}
              </Button>
            </div>
          );

        return isDraftGenerating ? (
          <Spinner />
        ) : (
          <ExternalLinkButton
            link={`${serverConfiguration.scriptureForge.domain}/projects/${projectInfo.scriptureForgeProjectId}/draft-generation`}
          >
            {projectInfo.draftInfo.draftSetupState === 'noFinishedDraft'
              ? localizedStrings['%scriptureForge_draft_action_connected_generate%']
              : localizedStrings['%scriptureForge_draft_action_connected_signUpForDrafts%']}
          </ExternalLinkButton>
        );
      }
      default:
        throw new Error(
          `Project ${projectInfo.scriptureForgeProjectId} has invalid connectionState ${connectionState}`,
        );
    }
  };

  return (
    <Table stickyHeader>
      <TableHeader stickyHeader>
        <TableRow>
          <TableHead /> {/* For project shortName */}
          {
            // Non-breaking space between "full" and "name" to avoid letting the column get too small
            buildTableHead(
              'fullName',
              localizedStrings['%scriptureForge_draft_table_header_fullName%'],
            )
          }
          {buildTableHead(
            'language',
            localizedStrings['%scriptureForge_draft_table_header_language%'],
          )}
          {buildTableHead(
            'draftSetupState',
            localizedStrings['%scriptureForge_draft_table_header_draftStatus%'],
          )}
          {buildTableHead('action', localizedStrings['%scriptureForge_draft_table_header_action%'])}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedProjectsInfo.length > 0 ? (
          sortedProjectsInfo.map((projectInfo) => (
            <TableRow
              key={projectInfo.projectId}
              className={cn({
                // Darkened row. Looks disabled
                'tw-bg-muted/50 tw-text-muted-foreground':
                  projectInfo.draftInfo.connectionState === 'cannotSetUp' ||
                  projectInfo.draftInfo.connectionState === 'cannotAccessDrafts',
              })}
            >
              <TableCell>{projectInfo.name}</TableCell>
              <TableCell>{projectInfo.fullName}</TableCell>
              <TableCell>{projectInfo.language}</TableCell>
              <TableCell>{buildTableDraftSetupStateElement(projectInfo)}</TableCell>
              <TableCell>{buildTableActionElement(projectInfo)}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>No projects</TableRow>
        )}
      </TableBody>
    </Table>
  );
}
