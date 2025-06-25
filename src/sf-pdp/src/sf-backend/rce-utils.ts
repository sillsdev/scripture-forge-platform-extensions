import Delta, { Op } from 'quill-delta';
import RichText from 'rich-text';
import { Connection, Doc as ShareDbDoc, types as ShareDbTypes } from 'sharedb/lib/client';
import { type Socket } from 'sharedb/lib/sharedb';
import { SerializedVerseRef } from '@sillsdev/scripture';

/** This is the key that Scripture Forge uses for storing data about projects */
export const SCRIPTURE_FORGE_PROJECTS_DOCUMENT = 'sf_projects';

/** This is the key that Scripture Forge uses for scripture data per project per chapter */
export const SCRIPTURE_FORGE_CHAPTER_DOCUMENT = 'texts';

/**
 * Generate the ID that stands for one specific chapter amongst all chapters of all books in all
 * projects within Scripture Forge
 */
export function createTextId(projectId: string, serializedVerseRef: SerializedVerseRef): string {
  return `${projectId}:${serializedVerseRef.book}:${serializedVerseRef.chapterNum}:target`;
}

// Exports related to connecting to ShareDB
export { Connection, Socket };

// Exports related to ShareDB documents and document types
export { RichText, ShareDbDoc, ShareDbTypes };

// Exports related to data structures passed back and forth with ShareDB
export { Delta, type Op };
