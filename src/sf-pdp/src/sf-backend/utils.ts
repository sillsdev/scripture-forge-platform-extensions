/**
 * Determines whether a variable has the specified property on it.
 *
 * @param variable The variable to check.
 * @param property Typically the name of a property, but could be a number of symbol.
 * @returns `true` if the object has the property, `false` otherwise.
 */
export function hasProperty<TVariable, TProperty extends PropertyKey>(
  variable: TVariable,
  property: TProperty,
): variable is TVariable & Record<TProperty, unknown> {
  return (
    variable &&
    (typeof variable === 'object' || typeof variable === 'function') &&
    property in variable
  );
}

/**
 * Determines whether an object has the specified property and value.
 *
 * @param variable The variable to check.
 * @param property Typically the name of a property, but could be a number of symbol.
 * @param value The value of the property.
 * @returns `true` if the object has the property with the specified value, `false` otherwise.
 */
export function hasPropertyWithValue<TVariable, TProperty extends PropertyKey>(
  variable: TVariable,
  property: TProperty,
  value: unknown,
): variable is TVariable & Record<TProperty, unknown> {
  return hasProperty(variable, property) && variable[property] === value;
}

/**
 * Determines whether an object has the specified string property.
 *
 * @param variable The variable to check.
 * @param property Typically the name of a property, but could be a number of symbol.
 * @returns `true` if the object has the property with a string type, `false` otherwise.
 */
export function hasStringProperty<TVariable, TProperty extends PropertyKey>(
  variable: TVariable,
  property: TProperty,
): variable is TVariable & Record<TProperty, string> {
  return hasProperty(variable, property) && typeof variable[property] === 'string';
}

/**
 * Determines whether the given value is a message sending an op to the server.
 *
 * @param data The data to be sent to the server.
 * @returns `true` if the value is a message sending operation.
 */
export function isMessageSendingOp(value: unknown): value is { a: 'op' } {
  return hasPropertyWithValue(value, 'a', 'op');
}

/**
 * Attempts to parse a JSON string into an object of type T.
 *
 * @param value The value to parse as JSON.
 * @returns The parsed object of type T, or `undefined` if the value is not a string or parsing
 *   fails.
 */
export function tryParseJSON<T>(value: unknown): T | undefined {
  if (typeof value !== 'string') return undefined;
  return JSON.parse(value);
}
