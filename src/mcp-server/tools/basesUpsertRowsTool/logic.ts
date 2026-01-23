/**
 * @fileoverview Logic for the `bases_upsert_rows` MCP tool.
 */

import { z } from "zod";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
import {
  BaseUpsertRequest,
  BaseUpsertResponse,
} from "../../../services/obsidianRestAPI/types.js";
import {
  logger,
  RequestContext,
  requestContextService,
} from "../../../utils/index.js";

const OperationSchema = z
  .object({
    file: z
      .string()
      .min(1)
      .describe(
        "Chemin de la note ciblée (relatif au coffre), ex. 'SEO/Pages/13-Aix.md'.",
      ),
    set: z
      .record(z.any())
      .optional()
      .describe("Valeurs de frontmatter à appliquer."),
    unset: z
      .array(z.string().min(1))
      .optional()
      .describe("Clés de frontmatter à supprimer."),
    expected_mtime: z
      .number()
      .optional()
      .describe(
        "Timestamp mtime attendu (verrou optimiste). Conflit => 409 renvoyé par le bridge.",
      ),
  })
  .describe("Opération d'upsert frontmatter pour une note.");

export const BasesUpsertRowsInputSchema = z
  .object({
    base_id: z
      .string()
      .min(1)
      .describe("Identifiant (chemin) de la base utilisée pour contextualiser la mise à jour."),
    operations: z
      .array(OperationSchema)
      .min(1)
      .describe("Tableau d'opérations d'upsert frontmatter."),
    continueOnError: z
      .boolean()
      .default(false)
      .describe("Quand true, poursuit les opérations malgré les erreurs individuelles."),
  })
  .describe(
    "Met à jour en lot les propriétés de notes référencées par une base (.base). Respecte le verrou mtime et interdit les clés formula.* / file.* côté bridge.",
  );

export type BasesUpsertRowsInput = z.infer<typeof BasesUpsertRowsInputSchema>;

export async function processBasesUpsertRows(
  params: BasesUpsertRowsInput,
  parentContext: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<BaseUpsertResponse> {
  const payload: BaseUpsertRequest = {
    operations: params.operations.map((operation) => ({
      file: operation.file,
      set: operation.set,
      unset: operation.unset,
      expected_mtime: operation.expected_mtime,
    })),
    continueOnError: params.continueOnError,
  };

  const context = requestContextService.createRequestContext({
    parentContext,
    operation: "BasesUpsertRows",
    params: {
      base_id: params.base_id,
      operations: params.operations.length,
      continueOnError: params.continueOnError,
    },
  });

  logger.debug("Upserting rows via REST bridge", context);
  return obsidianService.upsertBaseRows(params.base_id, payload, context);
}
