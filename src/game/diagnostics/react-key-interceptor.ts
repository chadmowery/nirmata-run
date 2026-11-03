/**
 * Diagnostic interceptor for React key collision warnings in browser environments.
 * Intercepts console.error on the client to provide rich contextual telemetry for duplicate keys.
 */
export function installReactKeyLogger(): void {
  if (typeof window === 'undefined') return;
  const win = window as unknown as { __reactKeyLoggerInstalled?: boolean };
  if (win.__reactKeyLoggerInstalled) return;
  win.__reactKeyLoggerInstalled = true;

  const originalConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';
    if (firstArg.includes('Encountered two children with the same key')) {
      const duplicateKey = args[1] ?? 'unknown';
      const stack = new Error().stack;
      const componentStack = args
        .slice(2)
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
        .filter(Boolean)
        .join('\n');

      const detailedMessage = [
        `\n==================== [REACT DUPLICATE KEY CULPRIT DETECTED] ====================`,
        `[browser] React duplicate key warning intercepted with detailed context:`,
        `Culprit Key: "${duplicateKey}"`,
        `Original Warning: ${firstArg}`,
        componentStack ? `\n--- Component Hierarchy / Stack ---\n${componentStack}` : '',
        stack ? `\n--- JavaScript Call Stack ---\n${stack}` : '',
        `=================================================================================\n`,
      ]
        .filter(Boolean)
        .join('\n');

      originalConsoleError.call(console, detailedMessage, ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}
