declare module 'rich-text' {
  import Delta from 'quill-delta';
  import { type Type } from 'sharedb/lib/sharedb';

  export const type: Type;

  export { Delta };
}
