
/**
 * Type definitions for Vite environment variables and the global process object.
 * Manually defining these types resolves errors when vite/client is not found
 * and avoids conflicts with existing process declarations.
 */

// Fix: Manually define the ImportMeta interfaces instead of relying on vite/client
interface ImportMetaEnv {
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Fix: Augment the global NodeJS namespace to include the API_KEY environment variable.
 * This avoids the "Cannot redeclare block-scoped variable 'process'" error by extending
 * the existing global definition instead of trying to create a new one.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    [key: string]: string | undefined;
  }
}
