import OpenAI from "openai";

type EmbedFunction = (text: string) => Promise<number[]>;

type OpenAIEmbedderOptions = {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  dimensions?: number;
};

const embedderCache = new Map<string, EmbedFunction>();
const clientCache = new Map<string, OpenAI>();

const getClient = (apiKey: string, baseUrl?: string): OpenAI => {
  const key = `${baseUrl ?? ""}::${apiKey}`;
  const cached = clientCache.get(key);
  if (cached) return cached;

  const client = new OpenAI({ apiKey, baseURL: baseUrl });
  clientCache.set(key, client);
  return client;
};

export const getEmbedder = async (
  options: OpenAIEmbedderOptions,
): Promise<EmbedFunction> => {
  const model = options.model?.trim();
  if (!model) {
    throw new Error("OpenAI embedder requires a model name (e.g. text-embedding-3-small)");
  }

  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when QUERY_EMBEDDER=openai");
  }

  const baseUrl = options.baseUrl?.trim();
  const dimensions = options.dimensions;

  const cacheKey = `${baseUrl ?? ""}::${model}::${dimensions ?? ""}::${apiKey}`;
  const cached = embedderCache.get(cacheKey);
  if (cached) return cached;

  const client = getClient(apiKey, baseUrl);

  const embed: EmbedFunction = async (text: string) => {
    const input = text.trim();
    if (!input) return [];

    const response = await client.embeddings.create({
      model,
      input,
      ...(Number.isFinite(dimensions) ? { dimensions } : {}),
    });

    const embedding = response.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("OpenAI embeddings API returned an unexpected payload");
    }

    return embedding;
  };

  embedderCache.set(cacheKey, embed);
  return embed;
};
