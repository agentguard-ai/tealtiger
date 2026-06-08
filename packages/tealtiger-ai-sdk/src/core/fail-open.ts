/**
 * TealTiger AI SDK — Fail-Open Logging Utility
 *
 * Provides a structured ERROR-level logging helper for governance module
 * failures in fail-open mode. All fail-open log entries follow a consistent
 * format that includes the correlation_id, module name, and error description.
 *
 * The default error channel is `console.error`. A secondary error channel
 * can be configured via `setErrorChannel` for custom logging infrastructure
 * (e.g., external log aggregators, monitoring services).
 *
 * @module core/fail-open
 */

/**
 * Signature for error channel handlers.
 * Called with the formatted log message whenever a fail-open error is recorded.
 */
export type ErrorChannelHandler = (message: string) => void;

/**
 * Internal secondary error channel reference.
 * When set, `logFailOpenError` will invoke this handler in addition to `console.error`.
 */
let secondaryErrorChannel: ErrorChannelHandler | null = null;

/**
 * Log a structured ERROR-level message for a governance module failure in fail-open mode.
 *
 * Format: `[TealTiger] Governance module failure (fail-open): correlation_id={id} module={name} error={message}`
 *
 * This function:
 * 1. Emits a structured log via `console.error`
 * 2. If a secondary error channel is configured, invokes it with the same message
 *
 * @param correlationId - The request correlation ID (UUID v4)
 * @param moduleName - The name of the governance module that failed
 * @param error - The error that occurred (Error object or any thrown value)
 */
export function logFailOpenError(
  correlationId: string,
  moduleName: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const formattedLog = `[TealTiger] Governance module failure (fail-open): correlation_id=${correlationId} module=${moduleName} error=${message}`;

  console.error(formattedLog);

  if (secondaryErrorChannel) {
    try {
      secondaryErrorChannel(formattedLog);
    } catch {
      // Secondary channel failure must not propagate — swallow silently
    }
  }
}

/**
 * Set a secondary error channel that receives all fail-open error messages.
 *
 * This enables routing fail-open errors to external logging infrastructure
 * (e.g., Datadog, CloudWatch, Sentry) in addition to `console.error`.
 *
 * Pass `null` to remove the secondary channel.
 *
 * @param handler - The error channel handler, or null to clear
 */
export function setErrorChannel(handler: ErrorChannelHandler | null): void {
  secondaryErrorChannel = handler;
}

/**
 * Get the currently configured secondary error channel.
 * Primarily exposed for testing purposes.
 *
 * @returns The current handler or null if none is configured
 */
export function getErrorChannel(): ErrorChannelHandler | null {
  return secondaryErrorChannel;
}
