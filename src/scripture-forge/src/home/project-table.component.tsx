import papi from '@papi/frontend';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import {
  // Button,
  // cn,
  // Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  usePromise,
} from 'platform-bible-react';
import { useCallback, useState } from 'react';

type SortConfig = {
  key: 'fullName' | 'language' | 'action';
  direction: 'ascending' | 'descending';
};

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
export default function ProjectTable() {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'language',
    direction: 'ascending',
  });

  const [projectsInfo, isLoadingProjectsInfo] = usePromise(
    useCallback(async () => {
      // if (!isLoggedIn) return [];

      const projectMetadata = await papi.projectLookup.getMetadataForAllProjects({
        includeProjectInterfaces: ['scriptureForge.slingshotDraftInfo'],
      });
      const projectInfo = await Promise.all(
        projectMetadata.map(async (metadata) => {
          const pdp = await papi.projectDataProviders.get('platform.base', metadata.id);
          // const draftInfoPdp = await papi.projectDataProviders.get(
          //   'scriptureForge.slingshotDraftInfo',
          //   metadata.id,
          // );
          return {
            projectId: metadata.id,
            isEditable: await pdp.getSetting('platform.isEditable'),
            fullName: await pdp.getSetting('platform.fullName'),
            name: await pdp.getSetting('platform.name'),
            language: await pdp.getSetting('platform.language'),
            // Commented out because I am getting a 404 from fetchWithAuthorization when getDraftInfo calls getCurrentlyGeneratingDraftStatus
            // draftInfo: await draftInfoPdp.getDraftInfo(undefined),
          };
        }),
      );
      return projectInfo;
    }, []),
    [],
  );

  const handleSort = (key: SortConfig['key']) => {
    const newSortConfig: SortConfig = { key, direction: 'ascending' };
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      newSortConfig.direction = 'descending';
    }
    setSortConfig(newSortConfig);
  };

  const buildTableHead = (key: SortConfig['key'], label: string) => (
    <TableHead onClick={() => handleSort(key)}>
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

  // const buildTableAction = (projectId: string, draftInfo: SlingshotDraftInfo) => {
  //   const { connectionState } = draftInfo;

  //   if (connectionState === 'canJoin') {
  //     return <Button className="tw-text-sm">Join in Scripture Forge</Button>;
  //   }
  //   if (connectionState === 'canSetUp') {
  //     return <Button className="tw-text-sm">Connect in Scripture Forge</Button>;
  //   }
  //   if (connectionState === 'hasFinishedDraft') {
  //     return (
  //       <Button
  //         className="tw-text-sm"
  //         onClick={() =>
  //           papi.commands.sendCommand('platformScriptureEditor.openResourceViewer', projectId)
  //         }
  //       >
  //         View Draft
  //       </Button>
  //     );
  //   }
  //   if (connectionState === 'cannotSetUp' || connectionState === 'cannotAccessDrafts') {
  //     return (
  //       <Label className="tw-text-xs">
  //         To join this project in Scripture Forge, ask the administrator of the Paratext project to
  //         connect the project in Scripture Forge.
  //       </Label>
  //     );
  //   }
  //   if (connectionState === 'noFinishedDraft') {
  //     return <Label className="tw-text-xs">No drafts for this project</Label>;
  //   }

  //   return undefined;
  // };

  if (isLoadingProjectsInfo) {
    return <Spinner />;
  }

  return (
    <Table stickyHeader>
      <TableHeader stickyHeader>
        <TableRow>
          <TableHead /> {/* For project shortName */}
          {buildTableHead('fullName', 'Full Name')}
          {buildTableHead('language', 'Language')}
          {buildTableHead('action', 'Action')}
        </TableRow>
      </TableHeader>
      <TableBody>
        {projectsInfo.length > 0 ? (
          projectsInfo.map((projectInfo) => (
            <TableRow
              key={projectInfo.projectId}
              // className={cn({
              // 'tw-bg-muted/50 tw-text-muted-foreground':
              // projectInfo.draftInfo.connectionState === 'cannotSetUp',
              // })}
            >
              <TableCell>{projectInfo.name}</TableCell>
              <TableCell>{projectInfo.fullName}</TableCell>
              <TableCell>{projectInfo.language}</TableCell>
              <TableCell>
                {/* {buildTableAction(projectInfo.projectId, projectInfo.draftInfo)} */}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>No projects</TableRow>
        )}
      </TableBody>
    </Table>
  );
}
