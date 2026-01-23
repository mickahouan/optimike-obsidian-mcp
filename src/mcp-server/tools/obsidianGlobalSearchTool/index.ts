/**
 * @fileoverview Barrel file for the 'obsidian_global_search' MCP tool.
 *
 * This file serves as the public entry point for the obsidian_global_search tool module.
 * It re-exports the primary registration function (`registerObsidianGlobalSearchTool`)
 * from the './registration.js' module. This pattern simplifies imports for consumers
 * of the tool, allowing them to import necessary components from a single location.
 *
 * Consumers (like the main server setup) should import the registration function
 * from this file to integrate the tool into the MCP server instance.
 */

export { registerObsidianGlobalSearchTool } from "./registration.js"; // Ensure '.js' extension for ES module resolution
