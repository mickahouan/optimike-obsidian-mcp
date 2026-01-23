/**
 * @fileoverview Provides a generic ID generator class for creating unique,
 * prefixed identifiers and standard UUIDs. It supports custom character sets,
 * lengths, and separators for generated IDs.
 * @module src/utils/security/idGenerator
 */

import { randomBytes, randomUUID as cryptoRandomUUID } from "crypto";
import { BaseErrorCode, McpError } from "../../types-global/errors.js";
// Logger is not directly used in this module after previous refactoring, which is fine.
// If logging were to be added (e.g., for prefix registration), RequestContext would be needed.
// import { logger, RequestContext } from '../internal/index.js';

/**
 * Defines the structure for configuring entity prefixes, mapping entity types (strings)
 * to their corresponding ID prefixes (strings).
 */
export interface EntityPrefixConfig {
  [key: string]: string;
}

/**
 * Options for customizing ID generation.
 */
export interface IdGenerationOptions {
  /** The length of the random part of the ID. Defaults to `IdGenerator.DEFAULT_LENGTH`. */
  length?: number;
  /** The separator string used between a prefix and the random part. Defaults to `IdGenerator.DEFAULT_SEPARATOR`. */
  separator?: string;
  /** The character set from which the random part of the ID is generated. Defaults to `IdGenerator.DEFAULT_CHARSET`. */
  charset?: string;
}

/**
 * A generic ID Generator class for creating and managing unique identifiers.
 * It can generate IDs with entity-specific prefixes or standard UUIDs.
 */
export class IdGenerator {
  /** Default character set for the random part of generated IDs (uppercase alphanumeric). */
  private static DEFAULT_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  /** Default separator used between a prefix and the random part of an ID. */
  private static DEFAULT_SEPARATOR = "_";
  /** Default length for the random part of generated IDs. */
  private static DEFAULT_LENGTH = 6;

  private entityPrefixes: EntityPrefixConfig = {};
  private prefixToEntityType: Record<string, string> = {};

  /**
   * Constructs an `IdGenerator` instance.
   * @param {EntityPrefixConfig} [entityPrefixes={}] - An optional map of entity types
   *   to their desired ID prefixes (e.g., `{ project: 'PROJ', task: 'TASK' }`).
   */
  constructor(entityPrefixes: EntityPrefixConfig = {}) {
    this.setEntityPrefixes(entityPrefixes);
  }

  /**
   * Sets or updates the entity prefix configuration and rebuilds the internal
   * reverse lookup table (prefix to entity type).
   * @param {EntityPrefixConfig} entityPrefixes - A map of entity types to their prefixes.
   */
  public setEntityPrefixes(entityPrefixes: EntityPrefixConfig): void {
    this.entityPrefixes = { ...entityPrefixes }; // Create a copy

    // Rebuild reverse mapping for efficient lookup (case-insensitive for prefix matching)
    this.prefixToEntityType = Object.entries(this.entityPrefixes).reduce(
      (acc, [type, prefix]) => {
        acc[prefix.toUpperCase()] = type; // Store prefix in uppercase for consistent lookup
        // Consider if lowercase or original case mapping is also needed based on expected input.
        // For now, assuming prefixes are matched case-insensitively by uppercasing input prefix.
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /**
   * Retrieves a copy of the current entity prefix configuration.
   * @returns {EntityPrefixConfig} The current entity prefix configuration.
   */
  public getEntityPrefixes(): EntityPrefixConfig {
    return { ...this.entityPrefixes };
  }

  /**
   * Generates a cryptographically secure random string of a specified length
   * from a given character set.
   * @param {number} [length=IdGenerator.DEFAULT_LENGTH] - The desired length of the random string.
   * @param {string} [charset=IdGenerator.DEFAULT_CHARSET] - The character set to use for generation.
   * @returns {string} A random string.
   */
  public generateRandomString(
    length: number = IdGenerator.DEFAULT_LENGTH,
    charset: string = IdGenerator.DEFAULT_CHARSET,
  ): string {
    if (length <= 0) {
      return "";
    }
    const bytes = randomBytes(length);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    return result;
  }

  /**
   * Generates a unique ID, optionally with a specified prefix.
   * @param {string} [prefix] - An optional prefix for the ID.
   * @param {IdGenerationOptions} [options={}] - Optional parameters for customizing
   *   the length, separator, and charset of the random part of the ID.
   * @returns {string} A unique identifier string.
   */
  public generate(prefix?: string, options: IdGenerationOptions = {}): string {
    const {
      length = IdGenerator.DEFAULT_LENGTH,
      separator = IdGenerator.DEFAULT_SEPARATOR,
      charset = IdGenerator.DEFAULT_CHARSET,
    } = options;

    const randomPart = this.generateRandomString(length, charset);

    return prefix ? `${prefix}${separator}${randomPart}` : randomPart;
  }

  /**
   * Generates a unique ID for a specified entity type, using its configured prefix.
   * The format is typically `PREFIX_RANDOMPART`.
   * @param {string} entityType - The type of entity for which to generate an ID (must be registered
   *   via `setEntityPrefixes` or constructor).
   * @param {IdGenerationOptions} [options={}] - Optional parameters for customizing the ID generation.
   * @returns {string} A unique identifier string for the entity (e.g., "PROJ_A6B3J0").
   * @throws {McpError} If the `entityType` is not registered (i.e., no prefix is configured for it).
   */
  public generateForEntity(
    entityType: string,
    options: IdGenerationOptions = {},
  ): string {
    const prefix = this.entityPrefixes[entityType];
    if (!prefix) {
      throw new McpError(
        BaseErrorCode.VALIDATION_ERROR,
        `Unknown entity type: "${entityType}". No prefix configured.`,
      );
    }
    return this.generate(prefix, options);
  }

  /**
   * Validates if a given ID string matches the expected format for a specified entity type,
   * including its prefix, separator, and random part characteristics.
   * @param {string} id - The ID string to validate.
   * @param {string} entityType - The expected entity type of the ID.
   * @param {IdGenerationOptions} [options={}] - Optional parameters to specify the expected
   *   length and separator if they differ from defaults for this validation.
   * @returns {boolean} `true` if the ID is valid for the entity type, `false` otherwise.
   */
  public isValid(
    id: string,
    entityType: string,
    options: IdGenerationOptions = {},
  ): boolean {
    const prefix = this.entityPrefixes[entityType];
    if (!prefix) {
      return false; // Cannot validate if entity type or prefix is unknown
    }

    const {
      length = IdGenerator.DEFAULT_LENGTH,
      separator = IdGenerator.DEFAULT_SEPARATOR,
      // charset is not used for regex validation but for generation
    } = options;

    // Regex assumes default charset (A-Z, 0-9). If charset is customizable for validation,
    // the regex would need to be dynamically built or options.charset used.
    // For now, it matches the default generation charset.
    const pattern = new RegExp(`^${prefix}${separator}[A-Z0-9]{${length}}$`);
    return pattern.test(id);
  }

  /**
   * Strips the prefix from a prefixed ID string.
   * @param {string} id - The ID string (e.g., "PROJ_A6B3J0").
   * @param {string} [separator=IdGenerator.DEFAULT_SEPARATOR] - The separator used in the ID.
   * @returns {string} The part of the ID after the first separator, or the original ID if no separator is found.
   */
  public stripPrefix(
    id: string,
    separator: string = IdGenerator.DEFAULT_SEPARATOR,
  ): string {
    const parts = id.split(separator);
    return parts.length > 1 ? parts.slice(1).join(separator) : id; // Handle cases with multiple separators in random part
  }

  /**
   * Determines the entity type from a prefixed ID string.
   * @param {string} id - The ID string (e.g., "PROJ_A6B3J0").
   * @param {string} [separator=IdGenerator.DEFAULT_SEPARATOR] - The separator used in the ID.
   * @returns {string} The determined entity type.
   * @throws {McpError} If the ID format is invalid or the prefix does not map to a known entity type.
   */
  public getEntityType(
    id: string,
    separator: string = IdGenerator.DEFAULT_SEPARATOR,
  ): string {
    const parts = id.split(separator);
    if (parts.length < 2 || !parts[0]) {
      // Need at least a prefix and a random part
      throw new McpError(
        BaseErrorCode.VALIDATION_ERROR,
        `Invalid ID format: "${id}". Expected format like "PREFIX${separator}RANDOMPART".`,
      );
    }

    const inputPrefix = parts[0].toUpperCase(); // Match prefix case-insensitively
    const entityType = this.prefixToEntityType[inputPrefix];

    if (!entityType) {
      throw new McpError(
        BaseErrorCode.VALIDATION_ERROR,
        `Unknown entity type for prefix: "${parts[0]}" in ID "${id}".`,
      );
    }
    return entityType;
  }

  /**
   * Normalizes an entity ID to ensure the prefix matches the configured case
   * (if specific casing is important for the system) and the random part is uppercase.
   * This implementation assumes prefixes are stored/used consistently and focuses on random part casing.
   * @param {string} id - The ID to normalize.
   * @param {string} [separator=IdGenerator.DEFAULT_SEPARATOR] - The separator used in the ID.
   * @returns {string} The normalized ID string.
   * @throws {McpError} If the entity type cannot be determined from the ID.
   */
  public normalize(
    id: string,
    separator: string = IdGenerator.DEFAULT_SEPARATOR,
  ): string {
    // This will throw if entity type is not found or ID format is wrong
    const entityType = this.getEntityType(id, separator);
    const configuredPrefix = this.entityPrefixes[entityType]; // Get the canonical prefix

    const parts = id.split(separator);
    const randomPart = parts.slice(1).join(separator); // Re-join if separator was in random part

    return `${configuredPrefix}${separator}${randomPart.toUpperCase()}`;
  }
}

/**
 * A default, shared instance of the `IdGenerator`.
 * This instance can be configured with entity prefixes at application startup
 * or used directly for generating unprefixed random IDs or UUIDs.
 *
 * Example:
 * ```typescript
 * import { idGenerator, generateUUID } from './idGenerator';
 *
 * // Configure prefixes (optional, typically at app start)
 * idGenerator.setEntityPrefixes({ user: 'USR', order: 'ORD' });
 *
 * const userId = idGenerator.generateForEntity('user'); // e.g., USR_X7V2L9
 * const simpleId = idGenerator.generate(); // e.g., K3P8A1
 * const standardUuid = generateUUID(); // e.g., '123e4567-e89b-12d3-a456-426614174000'
 * ```
 */
export const idGenerator = new IdGenerator();

/**
 * Generates a standard Version 4 UUID (Universally Unique Identifier).
 * Uses the `crypto.randomUUID()` method for cryptographically strong randomness.
 * @returns {string} A UUID string (e.g., "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx").
 */
export const generateUUID = (): string => {
  return cryptoRandomUUID();
};
