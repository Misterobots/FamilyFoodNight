
// Fix: Use any for process to avoid redeclaration conflicts with global Node.js types 
// that are present during build/config phases, while still allowing access to 
// process.env.API_KEY in the application code.
declare var process: any;
