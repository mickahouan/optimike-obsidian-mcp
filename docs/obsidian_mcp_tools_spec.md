# Obsidian MCP Tool Specification

This document outlines the potential tools for an Obsidian MCP server based on the capabilities of the Obsidian Local REST API plugin.

## Core File/Vault Operations

### 1. `obsidian_read_file`

- **Description:** Retrieves the content of a specified file within the Obsidian vault.
- **Parameters:**
  - `filePath` (string, required): Vault-relative path to the file.
  - `format` (enum: 'markdown' | 'json', optional, default: 'markdown'): The desired format for the returned content. 'json' returns a `NoteJson` object including frontmatter and metadata.
- **Returns:** The file content as a string (markdown) or a `NoteJson` object.

### 2. `obsidian_update_file`

- **Description:** Modifies the content of an Obsidian note (specified by path, the active file, or a periodic note) by appending, prepending, or overwriting (**whole-file** operations) OR applying granular patches relative to internal structures (**patch** operations). Can create the target if it doesn't exist.
- **Required Parameters:**
  - `targetType` (enum: 'filePath' | 'activeFile' | 'periodicNote'): Specifies the type of target note.
  - `content` (string | object): The content to use for the modification (string for whole-file, string or object for patch).
  - `modificationType` (enum: 'wholeFile' | 'patch'): Specifies whether to perform a whole-file operation or a granular patch.
- **Optional Parameters:**
  - `targetIdentifier` (string): Required if `targetType` is 'filePath' (provide vault-relative path) or 'periodicNote' (provide period like 'daily', 'weekly'). Not used for 'activeFile'.
- **Parameters for `modificationType: 'wholeFile'`:**
  - `wholeFileMode` (enum: 'append' | 'prepend' | 'overwrite', required): The specific whole-file operation.
  - `createIfNeeded` (boolean, optional, default: true): If true, creates the target file/note if it doesn't exist before applying the modification.
  - `overwriteIfExists` (boolean, optional, default: false): Only relevant for `wholeFileMode: 'overwrite'`. If true, allows overwriting an existing file. If false (default) and the file exists when `mode` is 'overwrite', the operation will fail.
- **Parameters for `modificationType: 'patch'`:**
  - `patchOperation` (enum: 'append' | 'prepend' | 'replace', required): The type of patch operation relative to the target.
  - `patchTargetType` (enum: 'heading' | 'block' | 'frontmatter', required): The type of internal structure to target.
  - `patchTarget` (string, required): The specific heading text, block ID, or frontmatter key to target.
  - `patchTargetDelimiter` (string, optional): Delimiter for nested headings (default '::').
  - `patchTrimTargetWhitespace` (boolean, optional, default: false): Whether to trim whitespace around the patch target.
  - `patchCreateTargetIfMissing` (boolean, optional, default: false): Whether to create the target (e.g., heading, frontmatter key) if it's missing before patching.
- **Returns:** Success confirmation.

### 3. `obsidian_delete_file`

- **Description:** Deletes a specified file from the vault.
- **Parameters:**
  - `filePath` (string, required): Vault-relative path to the file to delete.
- **Returns:** Success confirmation.

### 4. `obsidian_list_files`

- **Description:** Lists files and directories within a specified folder in the vault.
- **Parameters:**
  - `dirPath` (string, required): Vault-relative path to the directory. Use an empty string `""` or `/` for the vault root.
- **Returns:** An array of strings, where each string is a file or directory name (directories end with `/`).

## Search Operations

### 5. `obsidian_global_search`

- **Description:** Performs text search across vault content, with server-side support for regex, wildcards, and date filtering.
- **Parameters:**
  - `query` (string, required): The text string or regex pattern to search for.
  - `contextLength` (number, optional, default: 100): The number of characters surrounding each match to include as context.
  - `modified_since` (string, optional): Filter for files modified _after_ this date/time (e.g., '2 weeks ago', '2024-01-15', 'yesterday'). Parsed by dateParser utility.
  - `modified_until` (string, optional): Filter for files modified _before_ this date/time (e.g., 'today', '2024-03-20 17:00'). Parsed by dateParser utility.
- **Returns:** An array of search results (structure TBD, likely similar to `SimpleSearchResult` but potentially filtered further based on implementation).
- **Note:** Requires custom server-side implementation for advanced filtering (regex, dates) as the underlying simple API endpoint likely doesn't support them directly. May involve listing files, reading content, and applying filters in the MCP server.

### 6. `obsidian_json_search`

- **Description:** Performs a complex search using Dataview DQL or JsonLogic. Advanced filtering (regex, dates) depends on the capabilities of the chosen query language.
- **Parameters:**
  - `query` (string | object, required): The query string (for DQL) or JSON object (for JsonLogic).
  - `contentType` (enum: 'application/vnd.olrapi.dataview.dql+txt' | 'application/vnd.olrapi.jsonlogic+json', required): Specifies the format of the `query` parameter.
- **Returns:** An array of `ComplexSearchResult` objects.

## Metadata & Properties Operations

### 7. `obsidian_get_tags`

- **Description:** Retrieves all tags defined in the YAML frontmatter of markdown files within your Obsidian vault, along with their usage counts and associated file paths. Optionally, limit the search to a specific folder.
- **Parameters:**
  - `path` (string, optional): Folder path (relative to vault root) to restrict the tag search.
- **Returns:** An object mapping tags to their counts and associated file paths.

### 8. `obsidian_get_properties`

- **Description:** Retrieves properties (like title, tags, status) from the YAML frontmatter of a specified Obsidian note. Returns all defined properties, including any custom fields.
- **Parameters:**
  - `filepath` (string, required): Path to the note file (relative to vault root).
- **Returns:** An object containing all frontmatter key-value pairs.

### 9. `obsidian_update_properties`

- **Description:** Updates properties within the YAML frontmatter of a specified Obsidian note. By default, array properties (like tags) are merged; use the 'replace' option to overwrite them instead. Handles custom fields.
- **Parameters:**
  - `filepath` (string, required): Path to the note file (relative to vault root).
  - `properties` (object, required): Key-value pairs of properties to update.
  - `replace` (boolean, optional, default: false): If true, array properties will be completely replaced instead of merged.
- **Returns:** Success confirmation.

## Command Operations

### 10. `obsidian_execute_command`

- **Description:** Executes a registered Obsidian command using its unique ID.
- **Parameters:**
  - `commandId` (string, required): The ID of the command to execute (e.g., "app:go-back", "editor:toggle-bold").
- **Returns:** Success confirmation.

### 11. `obsidian_list_commands`

- **Description:** Retrieves a list of all available commands within the Obsidian application.
- **Parameters:** None.
- **Returns:** An array of `ObsidianCommand` objects, each containing the command's `id` and `name`.

## UI/Navigation & Active File Operations

### 12. `obsidian_open_file`

- **Description:** Opens a specified file in the Obsidian application interface. Creates the file if it doesn't exist.
- **Parameters:**
  - `filePath` (string, required): Vault-relative path to the file to open.
  - `newLeaf` (boolean, optional, default: false): If true, opens the file in a new editor tab (leaf).
- **Returns:** Success confirmation.

### 13. `obsidian_get_active_file`

- **Description:** Retrieves the content of the currently active file in the Obsidian editor.
- **Parameters:**
  - `format` (enum: 'markdown' | 'json', optional, default: 'markdown').
- **Returns:** The active file's content as a string or a `NoteJson` object.

### 14. `obsidian_delete_active_file`

- **Description:** Deletes the currently active file in Obsidian.
- **Parameters:** None.
- **Returns:** Success confirmation.

## Periodic Notes Operations

### 15. `obsidian_get_periodic_note`

- **Description:** Retrieves the content of a periodic note (e.g., daily, weekly).
- **Parameters:**
  - `period` (enum: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly', required): The type of periodic note to retrieve.
  - `format` (enum: 'markdown' | 'json', optional, default: 'markdown').
- **Returns:** The periodic note's content as a string or a `NoteJson` object.

### 16. `obsidian_delete_periodic_note`

- **Description:** Deletes a specified periodic note.
- **Parameters:**
  - `period` (enum: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly', required): The type of periodic note to delete.
- **Returns:** Success confirmation.

## Status Check

### 17. `obsidian_check_status`

- **Description:** Checks the connection status and authentication validity of the Obsidian Local REST API plugin.
- **Parameters:** None.
- **Returns:** An `ApiStatusResponse` object containing authentication status, service name, and version information.

## Phase 2

#### 1. `obsidian_manage_frontmatter`

- **Purpose**: To read, add, update, or remove specific keys from a note's YAML frontmatter without having to parse and rewrite the entire file content.
- **Input Schema**:
  - `filePath`: `z.string()` - Path to the target note.
  - `operation`: `z.enum(['get', 'set', 'delete'])` - The action to perform.
  - `key`: `z.string()` - The frontmatter key to target (e.g., "status").
  - `value`: `z.any().optional()` - The value to set for the key (required for `set`).
- **Output**: `{ success: true, message: "...", value: ... }` (returns the value for 'get', or the updated frontmatter).
- **Why it's useful**: This is far more robust and reliable than using `search_replace` on the raw text of the frontmatter. An agent could manage a note's status, due date, or other metadata fields programmatically.

#### 2. `obsidian_manage_tags`

- **Purpose**: To add or remove tags from a note. The tool's logic would be smart enough to handle tags in both the frontmatter (`tags: [tag1, tag2]`) and inline (`#tag3`).
- **Input Schema**:
  - `filePath`: `z.string()` - Path to the target note.
  - `operation`: `z.enum(['add', 'remove', 'list'])` - The action to perform.
  - `tags`: `z.array(z.string())` - An array of tags to add or remove (without the '#').
- **Output**: `{ success: true, message: "...", currentTags: ["tag1", "tag2", "tag3"] }`
- **Why it's useful**: Provides a semantic way to categorize notes, which is a core Obsidian workflow. The agent could tag notes based on their content or as part of a larger task.

#### 3. `obsidian_dataview_query`

- **Purpose**: To execute a Dataview query (DQL) and return the structured results. This is the most powerful querying tool in the Obsidian ecosystem.
- **Input Schema**:
  - `query`: `z.string()` - The Dataview Query Language (DQL) string.
- **Output**: A JSON representation of the Dataview table or list result. `{ success: true, results: [{...}, {...}] }`
- **Why it's useful**: The agent could answer questions like:
  - "List all unfinished tasks from my project notes." (`TASK from #project WHERE !completed`)
  - "Show me all books I rated 5 stars." (`TABLE rating from #book WHERE rating = 5`)
  - "Find all meeting notes from the last 7 days." (`LIST from #meeting WHERE file.cday >= date(today) - dur(7 days)`)

This tool would be incredibly potent but requires the user to have the Dataview plugin installed. It would leverage the `searchComplex` method already in your `ObsidianRestApiService`.
