import { SlingshotDraftBuildState } from 'scripture-forge';

/**
 * Whether a draft state indicates the draft is currently generating as opposed to finished in some
 * way (success or otherwise)
 *
 * @param draftState The state of the draft build
 * @returns `true` if currently generating. `false` otherwise including if state is `undefined`.
 */
export function isDraftCurrentlyGenerating(
  draftState: SlingshotDraftBuildState | undefined,
): boolean {
  return (
    !!draftState &&
    draftState !== 'COMPLETED' &&
    draftState !== 'FAULTED' &&
    draftState !== 'CANCELED'
  );
}
