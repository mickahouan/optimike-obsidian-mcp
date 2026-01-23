import { getEmbedder as getXenovaEmbedder, resolveTransformersModel } from "./xenova.js";
import { getEmbedder as getOllamaEmbedder } from "./ollama.js";
import { getEmbedder as getOpenAIEmbedder } from "./openai.js";

type EmbedFunction = (text: string) => Promise<number[]>;

export type QueryEmbedderProvider = "auto" | "xenova" | "ollama" | "openai";

export type QueryEmbedderSelection = {
  provider: Exclude<QueryEmbedderProvider, "auto">;
  model: string;
  embed: EmbedFunction;
};

export type QueryEmbedderOptions = {
  provider?: string;
  modelHint?: string;
  // Explicit override (strongest). Can be a HuggingFace id (xenova), an Ollama model name, or an OpenAI model.
  model?: string;
  // What Smart Connections stored in .smart-env (often a HuggingFace id when using Transformers).
  vaultModel?: string;
  dimension?: number;
  ollamaBaseUrl?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiDimensions?: number;
};

const looksLikeHuggingFaceId = (id: string): boolean => id.includes("/") && !id.includes(" ");

const looksLikeOpenAIEmbeddingModel = (id: string): boolean =>
  id.startsWith("text-embedding-") || id.startsWith("openai/");

const normaliseProvider = (provider?: string): QueryEmbedderProvider => {
  const raw = (provider ?? "auto").trim().toLowerCase();
  if (raw === "xenova" || raw === "transformers") return "xenova";
  if (raw === "ollama") return "ollama";
  if (raw === "openai") return "openai";
  return "auto";
};

const inferProviderFromModel = (
  model: string,
): Exclude<QueryEmbedderProvider, "auto"> => {
  if (looksLikeOpenAIEmbeddingModel(model)) return "openai";
  if (looksLikeHuggingFaceId(model)) return "xenova";
  return "ollama";
};

export const getQueryEmbedder = async (
  opts: QueryEmbedderOptions,
): Promise<QueryEmbedderSelection> => {
  const provider = normaliseProvider(opts.provider);

  // Strongest precedence: explicit model override
  const modelCandidate =
    opts.model?.trim() || opts.vaultModel?.trim() || "";

  const resolvedProvider: Exclude<QueryEmbedderProvider, "auto"> =
    provider === "auto"
      ? modelCandidate
        ? inferProviderFromModel(modelCandidate)
        : "xenova"
      : provider;

  if (resolvedProvider === "xenova") {
    const resolvedModel = resolveTransformersModel(
      opts.modelHint,
      opts.dimension,
      modelCandidate || undefined,
    );
    const embed = await getXenovaEmbedder(
      opts.modelHint,
      opts.dimension,
      modelCandidate || undefined,
    );
    return { provider: "xenova", model: resolvedModel, embed };
  }

  if (resolvedProvider === "openai") {
    const model = modelCandidate || "text-embedding-3-small";
    const embed = await getOpenAIEmbedder({
      apiKey: opts.openaiApiKey,
      baseUrl: opts.openaiBaseUrl,
      model,
      dimensions: opts.openaiDimensions,
    });

    return { provider: "openai", model, embed };
  }

  // ollama
  const model = modelCandidate;
  if (!model) {
    throw new Error(
      "QUERY_EMBEDDER=ollama requires QUERY_EMBEDDER_MODEL or a model to be present in .smart-env",
    );
  }

  const embed = await getOllamaEmbedder(model, opts.ollamaBaseUrl);
  return { provider: "ollama", model, embed };
};
