/**
 * Type declarations for cloudflare:test module
 * Used by @cloudflare/vitest-pool-workers for testing
 */
declare module "cloudflare:test" {
  import { ExecutionContext } from "@cloudflare/workers-types";
  import { Env } from "../src/index";

  /**
   * Test environment bindings
   */
  export const env: Env;

  /**
   * Create an execution context for testing
   */
  export function createExecutionContext(): ExecutionContext;

  /**
   * Wait for all promises in the execution context to complete
   */
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;

  /**
   * Reference to the worker itself (for RPC testing)
   */
  export const SELF: any;
}
