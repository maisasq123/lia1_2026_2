import type { InferenceSession, Tensor } from "onnxruntime-web";

export type Normalization = "0-1" | "imagenet" | "0-255";

export type ModelConfig = {
  inputName: string;
  width: number;
  height: number;
  layout: "nchw" | "nhwc";
  dataType: "float32" | "uint8";
  normalization: Normalization;
  autoDetected: boolean;
};

export type ModelInfo = {
  fileName: string;
  sizeBytes: number;
  inputShape: string;
  outputShape: string;
  producer?: string;
  version?: string;
};

export type Prediction = {
  classIndex: number | null;
  originalClass: string;
  confidence: number;
};

export type TranslationTable = {
  map: Map<string, string>;
  entries: { original: string; translated: string }[];
};

let ortModule: typeof import("onnxruntime-web") | null = null;

export async function getOrt() {
  if (!ortModule) {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.wasmPaths =
      "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
    ort.env.logLevel = "error";
    ortModule = ort;
  }
  return ortModule;
}

function shapeToString(dims: readonly (number | string)[] | undefined) {
  if (!dims || dims.length === 0) return "desconhecida";
  return dims.map((d) => (typeof d === "number" && d > 0 ? d : "?")).join("×");
}

type MetaLike = {
  name?: string;
  type?: string;
  shape?: readonly (number | string)[];
  dimensions?: readonly (number | string)[];
};

function readMetadata(session: InferenceSession, kind: "input" | "output") {
  const raw = (session as unknown as Record<string, unknown>)[
    kind === "input" ? "inputMetadata" : "outputMetadata"
  ];
  if (Array.isArray(raw) && raw.length > 0) return raw as MetaLike[];
  const names = kind === "input" ? session.inputNames : session.outputNames;
  return names.map((name) => ({ name }) as MetaLike);
}

export function inspectModel(
  session: InferenceSession,
  file: File,
): { config: ModelConfig; info: ModelInfo } {
  const inputs = readMetadata(session, "input");
  const outputs = readMetadata(session, "output");
  const first = inputs[0] ?? {};
  const dims = (first.shape ?? first.dimensions ?? []) as (number | string)[];

  let width = 224;
  let height = 224;
  let layout: "nchw" | "nhwc" = "nchw";
  let autoDetected = false;

  if (dims.length === 4) {
    const numeric = dims.map((d) => (typeof d === "number" ? d : -1));
    const d1 = numeric[1] ?? -1;
    const d2 = numeric[2] ?? -1;
    const d3 = numeric[3] ?? -1;
    if (d1 === 3 || d1 === 1) {
      layout = "nchw";
      if (d2 > 0 && d3 > 0) {
        height = d2;
        width = d3;
        autoDetected = true;
      }
    } else if (d3 === 3 || d3 === 1) {
      layout = "nhwc";
      if (d1 > 0 && d2 > 0) {
        height = d1;
        width = d2;
        autoDetected = true;
      }
    }
  }


  const type = (first.type ?? "float32") as string;

  return {
    config: {
      inputName: first.name ?? session.inputNames[0] ?? "input",
      width,
      height,
      layout,
      dataType: type.includes("uint8") ? "uint8" : "float32",
      normalization: "0-1",
      autoDetected,
    },
    info: {
      fileName: file.name,
      sizeBytes: file.size,
      inputShape: shapeToString(dims),
      outputShape: shapeToString(
        (outputs[0]?.shape ?? outputs[0]?.dimensions) as
          | (number | string)[]
          | undefined,
      ),
    },
  };
}

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export async function imageToTensor(file: File, config: ModelConfig) {
  const ort = await getOrt();
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, config.width, config.height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, config.width, config.height);
  const pixels = config.width * config.height;

  if (config.dataType === "uint8") {
    const out = new Uint8Array(pixels * 3);
    for (let i = 0; i < pixels; i++) {
      for (let c = 0; c < 3; c++) {
        const idx = config.layout === "nchw" ? c * pixels + i : i * 3 + c;
        out[idx] = data[i * 4 + c] ?? 0;
      }
    }
    return new ort.Tensor(
      "uint8",
      out,
      config.layout === "nchw"
        ? [1, 3, config.height, config.width]
        : [1, config.height, config.width, 3],
    );
  }

  const out = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      const raw = data[i * 4 + c] ?? 0;
      let value = raw / 255;
      if (config.normalization === "imagenet")
        value = (value - (MEAN[c] ?? 0)) / (STD[c] ?? 1);
      else if (config.normalization === "0-255") value = raw;
      const idx = config.layout === "nchw" ? c * pixels + i : i * 3 + c;
      out[idx] = value;
    }
  }


  return new ort.Tensor(
    "float32",
    out,
    config.layout === "nchw"
      ? [1, 3, config.height, config.width]
      : [1, config.height, config.width, 3],
  );
}

export function softmax(values: number[]) {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function looksLikeProbabilities(values: number[]) {
  const sum = values.reduce((a, b) => a + b, 0);
  const inRange = values.every((v) => v >= 0 && v <= 1);
  return inRange && Math.abs(sum - 1) < 0.05;
}

export function parseOutput(results: InferenceSession.OnnxValueMapType): Prediction {
  const entries = Object.values(results) as Tensor[];

  // String labels emitted directly by the model (e.g. sklearn/ONNX pipelines)
  const stringTensor = entries.find((t) => t?.type === "string");
  const numericTensor = entries.find(
    (t) => t?.data instanceof Float32Array || t?.data instanceof Float64Array,
  );

  if (!numericTensor && stringTensor) {
    const label = String((stringTensor.data as unknown as string[])[0]);
    const asNumber = Number(label);
    return {
      classIndex: label.trim() !== "" && Number.isFinite(asNumber) ? asNumber : null,
      originalClass: label,
      confidence: 1,
    };
  }

  if (!numericTensor) {
    throw new Error("Saída do modelo não reconhecida como classificação.");
  }

  const values = Array.from(numericTensor.data as Float32Array | Float64Array).map(
    Number,
  );
  if (values.length === 0) throw new Error("O modelo não retornou pontuações.");

  const probs =
    values.length === 1
      ? [Math.min(Math.max(values[0] ?? 0, 0), 1)]
      : looksLikeProbabilities(values)
        ? values
        : softmax(values);

  let bestIndex = 0;
  for (let i = 1; i < probs.length; i++)
    if ((probs[i] ?? 0) > (probs[bestIndex] ?? 0)) bestIndex = i;

  let label = String(bestIndex);
  if (stringTensor) {
    const labels = stringTensor.data as unknown as string[];
    if (labels[bestIndex] != null) label = String(labels[bestIndex]);
    else if (labels.length === 1) label = String(labels[0]);
  }

  return {
    classIndex: bestIndex,
    originalClass: label,
    confidence: probs[bestIndex] ?? 0,
  };
}

/** Chave normalizada: sem espaços nas pontas e sem diferenciar maiúsculas. */
export function normalizeKey(value: string | number) {
  return String(value).trim().toLowerCase();
}

/**
 * Resolve a tradução a partir do identificador da classe.
 * Ordem: índice retornado pelo modelo → nome original da classe.
 */
export function resolveTranslation(
  table: TranslationTable | null,
  classIndex: number | null,
  originalClass: string,
): string | undefined {
  if (!table) return undefined;
  if (classIndex != null) {
    const byIndex = table.map.get(normalizeKey(classIndex));
    if (byIndex) return byIndex;
  }
  return table.map.get(normalizeKey(originalClass));
}

export function parseTranslationsCsv(text: string): TranslationTable {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0];
  if (!firstLine) throw new Error("Arquivo CSV vazio.");

  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const map = new Map<string, string>();
  const entries: { original: string; translated: string }[] = [];
  const start = firstLine.toLowerCase().includes("original") ? 1 : 0;

  for (let i = start; i < lines.length; i++) {
    const parts = (lines[i] ?? "")
      .split(delimiter)
      .map((p) => p.trim().replace(/^"|"$/g, "").trim());
    const key = parts[0];
    const value = parts[1];
    if (!key || !value) continue;
    map.set(normalizeKey(key), value);
    entries.push({ original: key, translated: value });
  }


  if (map.size === 0)
    throw new Error("CSV inválido: use o formato original,traducao com uma linha por classe.");

  return { map, entries };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}
