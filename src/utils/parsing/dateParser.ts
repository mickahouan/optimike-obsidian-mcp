/**
 * @fileoverview Provides utilities for parsing natural language date strings
 * into Date objects or detailed parsing results using the 'chrono-node' library.
 * @module src/utils/parsing/dateParser
 */

import * as chrono from "chrono-node";
import { BaseErrorCode, McpError } from "../../types-global/errors.js";
import { ErrorHandler, logger, RequestContext } from "../internal/index.js";

/**
 * Parses a natural language date string (e.g., "tomorrow", "in 5 days", "2024-01-15")
 * into a JavaScript `Date` object.
 *
 * @async
 * @param {string} text - The natural language date string to parse.
 * @param {RequestContext} context - The request context for logging and error tracking.
 * @param {Date} [refDate] - Optional reference date for parsing relative date expressions.
 *   Defaults to the current date and time if not provided.
 * @returns {Promise<Date | null>} A promise that resolves to a `Date` object representing
 *   the parsed date, or `null` if `chrono-node` could not parse the input string into a date.
 * @throws {McpError} If an unexpected error occurs during the parsing process,
 *   an `McpError` with `BaseErrorCode.PARSING_ERROR` is thrown.
 */
async function parseDateString(
  text: string,
  context: RequestContext,
  refDate?: Date,
): Promise<Date | null> {
  const operation = "parseDateString";
  // Ensure context for logging includes all relevant details
  const logContext: RequestContext = {
    ...context,
    operation,
    inputText: text,
    refDate: refDate?.toISOString(),
  };
  logger.debug(`Attempting to parse date string: "${text}"`, logContext);

  return await ErrorHandler.tryCatch(
    async () => {
      // chrono.parseDate returns a Date object or null if no date is found.
      const parsedDate = chrono.parseDate(text, refDate, { forwardDate: true });
      if (parsedDate) {
        logger.debug(
          `Successfully parsed "${text}" to ${parsedDate.toISOString()}`,
          logContext,
        );
        return parsedDate;
      } else {
        // This is not an error, but chrono-node couldn't find a date.
        logger.info(
          `Could not parse a date from string: "${text}"`,
          logContext,
        );
        return null;
      }
    },
    {
      operation,
      context: logContext, // Pass the enriched logContext
      input: { text, refDate: refDate?.toISOString() }, // Log refDate as ISO string for consistency
      errorCode: BaseErrorCode.PARSING_ERROR, // Default error code for unexpected parsing failures
    },
  );
}

/**
 * Parses a natural language date string and returns detailed parsing results,
 * including all components and their confidence levels, as provided by `chrono-node`.
 *
 * @async
 * @param {string} text - The natural language date string to parse.
 * @param {RequestContext} context - The request context for logging and error tracking.
 * @param {Date} [refDate] - Optional reference date for parsing relative date expressions.
 *   Defaults to the current date and time if not provided.
 * @returns {Promise<chrono.ParsedResult[]>} A promise that resolves to an array of
 *   `chrono.ParsedResult` objects. The array will be empty if no date components
 *   could be parsed from the input string.
 * @throws {McpError} If an unexpected error occurs during the parsing process,
 *   an `McpError` with `BaseErrorCode.PARSING_ERROR` is thrown.
 */
async function parseDateStringDetailed(
  text: string,
  context: RequestContext,
  refDate?: Date,
): Promise<chrono.ParsedResult[]> {
  const operation = "parseDateStringDetailed";
  const logContext: RequestContext = {
    ...context,
    operation,
    inputText: text,
    refDate: refDate?.toISOString(),
  };
  logger.debug(
    `Attempting detailed parse of date string: "${text}"`,
    logContext,
  );

  return await ErrorHandler.tryCatch(
    async () => {
      // chrono.parse returns an array of results.
      const results = chrono.parse(text, refDate, { forwardDate: true });
      logger.debug(
        `Detailed parse of "${text}" resulted in ${results.length} result(s).`,
        logContext,
      );
      return results;
    },
    {
      operation,
      context: logContext,
      input: { text, refDate: refDate?.toISOString() },
      errorCode: BaseErrorCode.PARSING_ERROR,
    },
  );
}

/**
 * Provides methods for parsing natural language date strings.
 * - `parseToDate`: Parses a string to a single `Date` object or `null`.
 * - `getDetailedResults`: Provides comprehensive parsing results from `chrono-node`.
 */
export const dateParser = {
  /**
   * Parses a natural language date string into a `Date` object.
   * @see {@link parseDateString}
   */
  parseToDate: parseDateString,
  /**
   * Parses a natural language date string and returns detailed `chrono.ParsedResult` objects.
   * @see {@link parseDateStringDetailed}
   */
  getDetailedResults: parseDateStringDetailed,
};
