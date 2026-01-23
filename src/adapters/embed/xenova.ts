import { pipeline } from "@xenova/transformers";

type EmbedFunction = (text: string) => Promise<number[]>;

export const resolveTransformersModel = (
  hint?: string,
  dimension?: number,
  embeddingModel?: string,
): string => {
  const normalisedHint = hint?.toLowerCase() ?? "";
  const normalisedModel = embeddingModel?.toLowerCase() ?? "";

  // If Smart Connections already stored a HuggingFace id (common when using Transformers),
  // use it directly to guarantee query-vs-vault compatibility.
  if (embeddingModel && embeddingModel.includes("/") && !embeddingModel.includes(" ")) {
    return embeddingModel;
  }

  // snowflake arctic embed (xs)
  if (
    normalisedHint.includes("snowflake") ||
    normalisedHint.includes("arctic") ||
    normalisedModel.includes("snowflake") ||
    normalisedModel.includes("arctic")
  ) {
    // Respect expected dimension when available.
    // - embed-xs is 384d
    // - embed2 is typically 1024d
    if (dimension === 1024 || normalisedHint.includes("embed2") || normalisedModel.includes("embed2")) {
      return "Snowflake/snowflake-arctic-embed2";
    }
    return "Snowflake/snowflake-arctic-embed-xs";
  }

  // e5 models
  if (normalisedHint.includes("e5") || normalisedModel.includes("e5")) {
    // Prefer multilingual if hinted.
    if (normalisedHint.includes("multi") || normalisedModel.includes("multi")) {
      return "Xenova/multilingual-e5-small";
    }
    return "Xenova/e5-small-v2";
  }

  if (
    (normalisedHint.includes("bge") && normalisedHint.includes("384")) ||
    normalisedModel.includes("bge-small")
  ) {
    return "Xenova/bge-small-en-v1.5";
  }

  if (dimension === 384) {
    // Default 384d retrieval model
    return "Xenova/bge-small-en-v1.5";
  }

  if (
    dimension === 768 ||
    normalisedHint.includes("bge-base") ||
    normalisedModel.includes("bge-base")
  ) {
    return "Xenova/bge-base-en-v1.5";
  }

  if (
    dimension === 1024 ||
    normalisedHint.includes("bge-m3") ||
    normalisedModel.includes("bge-m3")
  ) {
    return "Xenova/bge-m3";
  }

  return "Xenova/bge-small-en-v1.5";
};

const embedderCache = new Map<string, EmbedFunction>();

export const getEmbedder = async (
  modelHint?: string,
  dimension?: number,
  embeddingModel?: string,
): Promise<EmbedFunction> => {
  const model = resolveTransformersModel(modelHint, dimension, embeddingModel);

  const cached = embedderCache.get(model);
  if (cached) return cached;

  const featureExtractor = await pipeline("feature-extraction", model);
  const embedder: EmbedFunction = async (text: string) => {
    const output = await featureExtractor(text, {
      pooling: "mean",
      normalize: true,
    });

    return Array.from(output.data as Float32Array);
  };

  embedderCache.set(model, embedder);
  return embedder;
};
