import axios from "axios";
import { promises as fs } from "fs";

type EmbedFunction = (text: string) => Promise<number[]>;

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

const normaliseBaseUrl = (raw?: string): string => {
  const base = (raw?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/u, "");
  return base.length ? base : DEFAULT_OLLAMA_BASE_URL;
};

const isLocalhostBaseUrl = (baseUrl: string): boolean => {
  try {
    const url = new URL(baseUrl);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const replaceHostname = (baseUrl: string, hostname: string): string => {
  const url = new URL(baseUrl);
  url.hostname = hostname;
  return url.toString().replace(/\/+$/u, "");
};

const parseHexGateway = (hex: string): string | null => {
  if (!/^[0-9A-Fa-f]{8}$/.test(hex)) return null;
  // /proc/net/route gateway is little-endian hex (e.g. 0102A8C0 -> 192.168.2.1)
  const bytes = [
    parseInt(hex.slice(6, 8), 16),
    parseInt(hex.slice(4, 6), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(0, 2), 16),
  ];
  return bytes.every((b) => Number.isFinite(b) && b >= 0 && b <= 255)
    ? bytes.join(".")
    : null;
};

const getDefaultGatewayIp = async (): Promise<string | null> => {
  try {
    const raw = await fs.readFile("/proc/net/route", "utf-8");
    const lines = raw.trim().split(/\r?\n/);
    // Header: Iface  Destination  Gateway  Flags ...
    for (const line of lines.slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 3) continue;
      const destination = cols[1];
      const gateway = cols[2];
      if (destination !== "00000000") continue;
      return parseHexGateway(gateway);
    }
  } catch {
    // ignore
  }
  return null;
};

const isConnectionLikeError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown; cause?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  if (
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EPERM"
  ) {
    return true;
  }
  const message = typeof record.message === "string" ? record.message : "";
  return /connect/i.test(message);
};

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "number");

const extractEmbedding = (payload: unknown): number[] | null => {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  // Newer Ollama endpoint: { embeddings: [[...]] }
  const embeddings = record.embeddings;
  if (Array.isArray(embeddings) && embeddings.length > 0) {
    const first = embeddings[0];
    if (isNumberArray(first)) return first;
  }

  // Older style: { embedding: [...] }
  const embedding = record.embedding;
  if (isNumberArray(embedding)) return embedding;

  // Defensive: some servers may return { data: [{ embedding: [...] }] }
  const data = record.data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown> | undefined;
    if (first && isNumberArray(first.embedding)) return first.embedding;
  }

  return null;
};

async function embedViaApiEmbed(
  baseUrl: string,
  model: string,
  text: string,
): Promise<number[]> {
  const url = `${baseUrl}/api/embed`;
  const { data } = await axios.post(
    url,
    { model, input: text },
    { timeout: 120000 },
  );

  const embedding = extractEmbedding(data);
  if (!embedding) {
    throw new Error(`Ollama /api/embed returned an unexpected payload`);
  }
  return embedding;
}

async function embedViaApiEmbeddings(
  baseUrl: string,
  model: string,
  text: string,
): Promise<number[]> {
  const url = `${baseUrl}/api/embeddings`;
  const { data } = await axios.post(
    url,
    { model, prompt: text },
    { timeout: 120000 },
  );

  const embedding = extractEmbedding(data);
  if (!embedding) {
    throw new Error(`Ollama /api/embeddings returned an unexpected payload`);
  }
  return embedding;
}

const embedderCache = new Map<string, EmbedFunction>();

export const getEmbedder = async (
  model: string,
  baseUrl?: string,
): Promise<EmbedFunction> => {
  const normalisedModel = model?.trim();
  if (!normalisedModel) {
    throw new Error("Ollama embedder requires a model name (e.g. snowflake-arctic-embed2)");
  }

  const base = normaliseBaseUrl(baseUrl);
  const cacheKey = `${base}::${normalisedModel}`;
  const cached = embedderCache.get(cacheKey);
  if (cached) return cached;

  const candidateBaseUrls = async (): Promise<string[]> => {
    const candidates = [base];
    if (!isLocalhostBaseUrl(base)) return candidates;

    // Common WSL / Docker host mappings
    try {
      candidates.push(replaceHostname(base, "host.docker.internal"));
    } catch {
      // ignore
    }

    const gw = await getDefaultGatewayIp();
    if (gw) {
      try {
        candidates.push(replaceHostname(base, gw));
      } catch {
        // ignore
      }
    }

    // De-dup
    return Array.from(new Set(candidates));
  };

  const embed: EmbedFunction = async (text: string) => {
    const input = text.trim();
    if (!input) return [];

    const bases = await candidateBaseUrls();
    let lastError: unknown = null;

    for (const baseUrlCandidate of bases) {
      try {
        return await embedViaApiEmbed(baseUrlCandidate, normalisedModel, input);
      } catch (error) {
        lastError = error;
        // Backward compatibility: older Ollama builds used /api/embeddings
        try {
          return await embedViaApiEmbeddings(baseUrlCandidate, normalisedModel, input);
        } catch (error2) {
          lastError = error2;
          // Only continue fallbacks for connection-like errors
          if (!isConnectionLikeError(error2)) break;
        }
      }
    }

    const attempted = bases.join(", ");
    const msg =
      lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown error");
    throw new Error(`Failed to reach Ollama (${attempted}): ${msg}`);
  };

  embedderCache.set(cacheKey, embed);
  return embed;
};
