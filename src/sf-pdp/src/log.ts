const logLevels = ['error', 'warn', 'info', 'debug', 'verbose'] as const;
const logLevelError = logLevels.indexOf('error');
const logLevelWarn = logLevels.indexOf('warn');
const logLevelInfo = logLevels.indexOf('info');
const logLevelDebug = logLevels.indexOf('debug');
const logLevelVerbose = logLevels.indexOf('verbose');
let currentLogLevel: number = logLevels.indexOf('info');

export function setLoggingLevel(level: (typeof logLevels)[number]): void {
  currentLogLevel = logLevels.indexOf(level);
}

// Return a string of the format "[YYYY-MM-dd HH:mm:ss.SSS] [<level>] [sfdp]"
function logLineTemplate(level: (typeof logLevels)[number]): string {
  return `[${new Date().toISOString().replace('T', ' ').replace('Z', '')}] [${level}] [sfdp]`;
}

// This file's purpose is to channel logging through the console in a consistent format.
/* eslint-disable no-console */

export function error(...args: unknown[]): void {
  if (currentLogLevel >= logLevelError) console.error(logLineTemplate('error'), ...args);
}

export function warn(...args: unknown[]): void {
  if (currentLogLevel >= logLevelWarn) console.warn(logLineTemplate('warn'), ...args);
}

export function info(...args: unknown[]): void {
  if (currentLogLevel >= logLevelInfo) console.info(logLineTemplate('info'), ...args);
}

export function debug(...args: unknown[]): void {
  if (currentLogLevel >= logLevelDebug) console.debug(logLineTemplate('debug'), ...args);
}

export function verbose(...args: unknown[]): void {
  if (currentLogLevel >= logLevelVerbose) console.log(logLineTemplate('verbose'), ...args);
}

export function flush(): void {
  process.stdout.write('', () => {
    process.stderr.write('', () => {
      // Flushing complete
    });
  });
}
