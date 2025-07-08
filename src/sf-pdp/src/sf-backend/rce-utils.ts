import Delta, { Op } from 'quill-delta';
import RichText from 'rich-text';
import { Connection, Doc as ShareDbDoc, types as ShareDbTypes } from 'sharedb/lib/client';
import { type Socket } from 'sharedb/lib/sharedb';
import { SerializedVerseRef } from '@sillsdev/scripture';

export const SCRIPTURE_FORGE_PROJECTS_DOCUMENT = 'sf_projects';
export const SCRIPTURE_FORGE_CHAPTER_DOCUMENT = 'texts';

// NOTE: Use https://qa.scriptureforge.org on QA, or https://scriptureforge.org on live for origin
export const SCRIPTURE_FORGE_HTTPS_BASE_URL = 'https://qa.scriptureforge.org';

// wss://scriptureforge.org/ws
export const SCRIPTURE_FORGE_WSS_BASE_URL = 'wss://qa.scriptureforge.org/realtime-api';

export function createTextId(projectId: string, serializedVerseRef: SerializedVerseRef): string {
  return `${projectId}:${serializedVerseRef.book}:${serializedVerseRef.chapterNum}:target`;
}

// Exports related to connecting to ShareDB
export { Connection, Socket };

// Exports related to ShareDB documents and document types
export { RichText, ShareDbDoc, ShareDbTypes };

// Exports related to data structures passed back and forth with ShareDB
export { Delta, type Op };
