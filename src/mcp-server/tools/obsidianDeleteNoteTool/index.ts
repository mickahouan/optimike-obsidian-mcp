/**
 * @fileoverview Barrel file for the 'obsidian_delete_note' MCP tool.
 *
 * This file serves as the public entry point for the obsidian_delete_note tool module.
 * It re-exports the primary registration function (`registerObsidianDeleteNoteTool`)
 * from the './registration.js' module. This pattern simplifies imports for consumers
 * of the tool, allowing them to import necessary components from a single location.
 *
 * Consumers (like the main server setup) should import the registration function
 * from this file to integrate the tool into the MCP server instance.
 */
export { registerObsidianDeleteNoteTool } from "./registration.js";
