/**
 * @fileoverview Barrel file for the 'obsidian_list_notes' MCP tool.
 *
 * This file serves as the public entry point for the obsidian_list_notes tool module.
 * It re-exports the primary registration function (`registerObsidianListNotesTool`)
 * from the './registration.js' module. This pattern simplifies imports for consumers
 * of the tool, allowing them to import necessary components from a single location.
 *
 * Consumers (like the main server setup) should import the registration function
 * from this file to integrate the tool into the MCP server instance.
 */
export { registerObsidianListNotesTool } from "./registration.js";
