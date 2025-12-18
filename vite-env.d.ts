
// Fix: Instead of redeclaring 'process' as a global variable which may conflict 
// with existing environment types, we augment the NodeJS namespace.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}

// Ensure the project recognizes process.env even if global Node types are missing
interface Process {
  env: {
    API_KEY: string;
  };
}
