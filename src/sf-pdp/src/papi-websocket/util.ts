import { indexOf, stringLength, substring } from 'platform-bible-utils';

// #region Serialization and deserialization functions

/** Separator between parts of a serialized request */
const REQUEST_TYPE_SEPARATOR = ':';

/** Information about a request that tells us what to do with it */
export type RequestType = {
  /** The general category of request */
  category: string;
  /** Specific identifier for this type of request */
  directive: string;
};

/**
 * String version of a request type that tells us what to do with a request.
 *
 * Consists of two strings concatenated by a colon
 */
export type SerializedRequestType = `${string}${typeof REQUEST_TYPE_SEPARATOR}${string}`;

/**
 * Create a request message requestType string from a category and a directive
 *
 * @param category The general category of request
 * @param directive Specific identifier for this type of request
 * @returns Full requestType for use in network calls
 */
export function serializeRequestType(category: string, directive: string): SerializedRequestType {
  if (!category) throw new Error('serializeRequestType: "category" is not defined or empty.');
  if (!directive) throw new Error('serializeRequestType: "directive" is not defined or empty.');

  return `${category}${REQUEST_TYPE_SEPARATOR}${directive}`;
}

/** Split a request message requestType string into its parts */
export function deserializeRequestType(requestType: SerializedRequestType): RequestType {
  if (!requestType) throw new Error('deserializeRequestType: must be a non-empty string');

  const colonIndex = indexOf(requestType, REQUEST_TYPE_SEPARATOR);
  if (colonIndex <= 0 || colonIndex >= stringLength(requestType) - 1)
    throw new Error(
      `deserializeRequestType: Must have two parts divided by a ${REQUEST_TYPE_SEPARATOR} (${requestType})`,
    );
  const category = substring(requestType, 0, colonIndex);
  const directive = substring(requestType, colonIndex + 1);
  return { category, directive };
}

// #endregion

/**
 * Allow an object to bind all its class-defined functions to itself to ensure all references to
 * "this" in its functions refer to the object rather than the caller of the function. For example,
 * if a function on the class is provided to a callback, if "this" isn't bound to the object then
 * "this" will refer to the entity running the callback.
 */
export function bindClassMethods<T extends object>(this: T): void {
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
  methods.forEach((method) => {
    // Allow indexing to work for this object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-type-assertion/no-type-assertion
    const thisAsAny = this as any;
    if (typeof thisAsAny[method] === 'function') {
      thisAsAny[method] = thisAsAny[method].bind(this);
    }
  });
}
