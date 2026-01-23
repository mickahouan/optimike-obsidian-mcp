/**
 * @fileoverview Provides a utility class for parsing potentially partial JSON strings,
 * with support for handling and logging optional LLM <think> blocks.
 * It wraps the 'partial-json' library.
 * @module src/utils/parsing/jsonParser
 */

import {
  parse as parsePartialJson,
  Allow as PartialJsonAllow,
} from "partial-json";
import { BaseErrorCode, McpError } from "../../types-global/errors.js";
import {
  logger,
  RequestContext,
  requestContextService,
} from "../internal/index.js"; // Corrected import path for internal utils

/**
 * Enum mirroring `partial-json`'s `Allow` constants. These constants specify
 * what types of partial JSON structures are permissible during parsing.
 * They can be combined using bitwise OR (e.g., `Allow.STR | Allow.OBJ`).
 *
 * - `Allow.OBJ`: Allows partial objects (e.g., `{"key": "value",`)
 * - `Allow.ARR`: Allows partial arrays (e.g., `[1, 2,`)
 * - `Allow.STR`: Allows partial strings (e.g., `"abc`)
 * - `Allow.NUM`: Allows partial numbers (e.g., `1.2e+`)
 * - `Allow.BOOL`: Allows partial booleans (e.g., `tru`)
 * - `Allow.NULL`: Allows partial nulls (e.g., `nul`)
 * - `Allow.ALL`: Allows all types of partial JSON structures (default).
 */
export const Allow = PartialJsonAllow;

// Regex to find a <think> block at the start of a string,
// capturing its content and the rest of the string.
const thinkBlockRegex = /^<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/;

/**
 * Utility class for parsing JSON strings that may be partial or incomplete.
 * It wraps the 'partial-json' library to provide a consistent parsing interface
 * and includes logic to handle and log optional `<think>...</think>` blocks
 * that might precede the JSON content (often found in LLM outputs).
 */
class JsonParser {
  /**
   * Parses a JSON string, which may be partial or prefixed with an LLM `<think>` block.
   *
   * @template T The expected type of the parsed JavaScript value. Defaults to `any`.
   * @param {string} jsonString - The JSON string to parse.
   * @param {number} [allowPartial=Allow.ALL] - A bitwise OR combination of `Allow` constants
   *   specifying which types of partial JSON structures are permissible (e.g., `Allow.OBJ | Allow.ARR`).
   *   Defaults to `Allow.ALL`, permitting any form of partial JSON.
   * @param {RequestContext} [providedContext] - Optional `RequestContext` for logging,
   *   especially for capturing `<think>` block content or parsing errors.
   * @returns {T} The parsed JavaScript value.
   * @throws {McpError} Throws an `McpError` with `BaseErrorCode.VALIDATION_ERROR` if:
   *   - The string is empty after removing a `<think>` block.
   *   - The remaining content does not appear to be a valid JSON structure (object, array, or permitted primitive).
   *   - The `partial-json` library encounters a parsing error.
   */
  parse<T = any>(
    jsonString: string,
    allowPartial: number = Allow.ALL,
    providedContext?: RequestContext,
  ): T {
    const operation = "JsonParser.parse";
    // Ensure opContext is always a valid RequestContext for internal logging
    const opContext =
      providedContext ||
      requestContextService.createRequestContext({ operation });

    let stringToParse = jsonString;
    let thinkContentExtracted: string | undefined;

    const match = jsonString.match(thinkBlockRegex);

    if (match) {
      thinkContentExtracted = match[1].trim();
      const restOfString = match[2];

      if (thinkContentExtracted) {
        logger.debug("LLM <think> block content extracted.", {
          ...opContext,
          operation,
          thinkContent: thinkContentExtracted,
        });
      } else {
        logger.debug("Empty LLM <think> block detected and removed.", {
          ...opContext,
          operation,
        });
      }
      stringToParse = restOfString; // Continue parsing with the remainder of the string
    }

    stringToParse = stringToParse.trim(); // Trim whitespace from the string that will be parsed

    if (!stringToParse) {
      const errorMsg =
        "JSON string is empty after potential <think> block removal and trimming.";
      logger.warning(errorMsg, {
        ...opContext,
        operation,
        originalInput: jsonString,
      });
      throw new McpError(BaseErrorCode.VALIDATION_ERROR, errorMsg, {
        ...opContext,
        operation,
      });
    }

    try {
      // The pre-check for firstChar and specific primitive types has been removed.
      // We now directly rely on parsePartialJson to validate the structure according
      // to the 'allowPartial' flags. If parsePartialJson fails, it will throw an
      // error which is caught below and wrapped in an McpError.
      return parsePartialJson(stringToParse, allowPartial) as T;
    } catch (error: any) {
      const errorMessage = `Failed to parse JSON content: ${error.message}`;
      logger.error(errorMessage, error, {
        ...opContext, // Use the guaranteed valid opContext
        operation,
        contentAttempted: stringToParse,
        thinkContentFound: thinkContentExtracted,
      });
      throw new McpError(BaseErrorCode.VALIDATION_ERROR, errorMessage, {
        ...opContext, // Use the guaranteed valid opContext
        operation,
        originalContent: stringToParse,
        thinkContentProcessed: !!thinkContentExtracted,
        rawError:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      });
    }
  }
}

/**
 * Singleton instance of the `JsonParser`.
 * Use this instance for all partial JSON parsing needs.
 *
 * Example:
 * ```typescript
 * import { jsonParser, Allow, RequestContext } from './jsonParser';
 * import { requestContextService } from '../internal'; // Assuming requestContextService is exported from internal utils
 * const context: RequestContext = requestContextService.createRequestContext({ operation: 'MyOperation' });
 * try {
 *   const data = jsonParser.parse('<think>Thinking...</think>{"key": "value", "arr": [1,', Allow.ALL, context);
 *   console.log(data); // Output: { key: "value", arr: [ 1 ] }
 * } catch (e) {
 *   console.error("Parsing failed:", e);
 * }
 * ```
 */
export const jsonParser = new JsonParser();
