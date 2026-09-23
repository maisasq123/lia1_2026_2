import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import type { InferenceSession } from "onnxruntime-web";
import {
  formatBytes,
  formatPercent,
  getOrt,
  imageToTensor,
  inspectModel,
  parseOutput,
  parseTranslationsCsv,
  resolveTranslation,
  type ModelConfig,
  type ModelInfo,
  type Normalization,
  type TranslationTable,
} from "@/lib/onnx-utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ONNX Image Classifier — classificação de imagens no navegador" },
      {
        name: "description",
        content:
          "Carregue um modelo ONNX, defina a confiança mínima e classifique várias imagens localmente, sem enviar nada para um servidor.",
      },
      {
        property: "og:title",
        content: "ONNX Image Classifier — classificação de imagens no navegador",
      },
      {
        property: "og:description",
        content:
          "Carregue um modelo ONNX, defina a confiança mínima e classifique várias imagens localmente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type ImageItem = { id: string; file: File; url: string };

type ResultItem = {
  id: string;
  fileName: string;
  url: string;
  classIndex?: number | null;
  originalClass?: string;
  translatedClass?: string | undefined;
  confidence?: number;
  passed?: boolean;
  error?: string;
};

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function StepBadge({ n }: { n: number }) {
  return (
    <span className="grid size-7 place-items-center rounded-lg bg-primary/10 font-display font-bold text-primary">
      {n}
    </span>
  );
}

function Index() {
  const [session, setSession] = useState<InferenceSession | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [description, setDescription] = useState("");

  const [threshold, setThreshold] = useState(80);

  const [translations, setTranslations] = useState<TranslationTable | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [results, setResults] = useState<ResultItem[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const modelInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleModelFile = async (file?: File | null) => {
    if (!file) return;
    setModelError(null);
    if (!file.name.toLowerCase().endsWith(".onnx")) {
      setModelError("Selecione um arquivo com extensão .onnx.");
      return;
    }
    setLoadingModel(true);
    try {
      const ort = await getOrt();
      const buffer = new Uint8Array(await file.arrayBuffer());
      const created = await ort.InferenceSession.create(buffer, {
        executionProviders: ["wasm"],
      });
      const { config: cfg, info } = inspectModel(created, file);
      setSession(created);
      setConfig(cfg);
      setModelInfo(info);
      setResults([]);
    } catch (err) {
      setSession(null);
      setConfig(null);
      setModelInfo(null);
      setModelError(
        "Não foi possível carregar este modelo. Verifique se o arquivo é um ONNX válido e compatível com o navegador." +
          (err instanceof Error ? ` (${err.message})` : ""),
      );
    } finally {
      setLoadingModel(false);
    }
  };

  const handleCsvFile = async (file?: File | null) => {
    if (!file) return;
    setCsvError(null);
    try {
      const map = parseTranslationsCsv(await file.text());
      // Teste automático: confirma que a busca por índice funciona.
      const sample = map.entries[0];
      if (sample) {
        console.info(
          `[traduções] ${map.map.size} classes · translationMap["${sample.original}"] === "${map.map.get(sample.original.trim().toLowerCase())}"`,
        );
      }
      setTranslations(map);
      setCsvName(file.name);

    } catch (err) {
      setTranslations(null);
      setCsvName(null);
      setCsvError(
        err instanceof Error ? err.message : "Não foi possível ler o arquivo CSV.",
      );
    }
  };

  const addImages = useCallback((files: FileList | File[]) => {
    const list = Array.from(files);
    const valid = list.filter((f) => ACCEPTED.includes(f.type));
    const rejected = list.length - valid.length;
    setImageError(
      rejected > 0
        ? `${rejected} arquivo(s) ignorado(s): apenas JPG, PNG e WEBP são aceitos.`
        : null,
    );
    if (valid.length === 0) return;
    setImages((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const classify = async () => {
    if (!session || !config || images.length === 0) return;
    setResults([]);
    setProgress({ done: 0, total: images.length });
    const collected: ResultItem[] = [];

    for (const item of images) {
      try {
        const tensor = await imageToTensor(item.file, config);
        const feeds: Record<string, unknown> = { [config.inputName]: tensor };
        const output = await session.run(
          feeds as InferenceSession.OnnxValueMapType,
        );
        const { classIndex, originalClass, confidence } = parseOutput(output);
        const translated = resolveTranslation(translations, classIndex, originalClass);
        collected.push({
          id: item.id,
          fileName: item.file.name,
          url: item.url,
          classIndex,
          originalClass,
          translatedClass: translated,
          confidence,
          passed: confidence * 100 >= threshold,
        });
      } catch (err) {
        collected.push({
          id: item.id,
          fileName: item.file.name,
          url: item.url,
          error:
            err instanceof Error
              ? `Erro na inferência: ${err.message}`
              : "Erro desconhecido na inferência.",
        });
      }
      setResults([...collected]);
      setProgress({ done: collected.length, total: images.length });
    }
    setProgress(null);
  };

  const reset = () => {
    images.forEach((i) => URL.revokeObjectURL(i.url));
    setSession(null);
    setConfig(null);
    setModelInfo(null);
    setModelError(null);
    setDescription("");
    setThreshold(80);
    setTranslations(null);
    setCsvName(null);
    setCsvError(null);
    setImages([]);
    setImageError(null);
    setResults([]);
    setProgress(null);
  };

  const scored = results.filter((r) => r.confidence != null);
  const above = scored.filter((r) => r.passed).length;
  const below = scored.length - above;
  const average =
    scored.length > 0
      ? scored.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / scored.length
      : 0;
  const failed = results.filter((r) => r.error).length;

  const updateConfig = (patch: Partial<ModelConfig>) =>
    setConfig((c) => (c ? { ...c, ...patch } : c));

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-foreground">
      <div className="pointer-events-none absolute -left-24 -top-24 size-[420px] rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-40 size-[460px] rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-[380px] rounded-full bg-primary/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <header className="glass flex flex-wrap items-center justify-between gap-6 rounded-3xl px-8 py-7">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-brand grid size-11 place-items-center rounded-2xl font-display text-lg font-bold text-primary-foreground shadow-[var(--shadow-brand)]">
              O
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                ONNX Image Classifier
              </h1>
              <p className="text-sm text-muted-foreground">
                Carregue um modelo ONNX e classifique imagens diretamente no navegador.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="glass-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
              <span
                className={`size-2 rounded-full ${
                  session ? "animate-pulse bg-success" : "bg-muted-foreground/40"
                }`}
              />
              {session ? "Modelo pronto" : "Nenhum modelo carregado"}
            </span>
            <button
              onClick={reset}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Limpar
            </button>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="space-y-6 lg:col-span-5">
            {/* 1. Modelo */}
            <section className="glass rounded-3xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <StepBadge n={1} />
                <h2 className="font-display font-semibold">Modelo ONNX</h2>
              </div>

              <input
                ref={modelInputRef}
                type="file"
                accept=".onnx"
                className="hidden"
                onChange={(e) => handleModelFile(e.target.files?.[0])}
              />
              <button
                onClick={() => modelInputRef.current?.click()}
                disabled={loadingModel}
                className="w-full rounded-2xl border-2 border-dashed border-primary/30 bg-card/40 p-5 text-center transition hover:border-primary/60 disabled:opacity-60"
              >
                {loadingModel ? (
                  <p className="text-sm font-medium text-muted-foreground">
                    Carregando modelo…
                  </p>
                ) : modelInfo ? (
                  <>
                    <p className="text-sm font-medium">{modelInfo.fileName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      validado · {formatBytes(modelInfo.sizeBytes)} · pronto para
                      inferência
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">
                      Selecione um arquivo .onnx
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      O modelo roda localmente, no seu navegador
                    </p>
                  </>
                )}
              </button>

              {modelError && (
                <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  {modelError}
                </p>
              )}

              {modelInfo && config && (
                <>
                  <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Descrição do modelo{" "}
                    <span className="font-normal normal-case">(opcional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex.: modelo para classificar imagens de animais em diferentes categorias."
                    className="mt-2 w-full resize-none rounded-xl border border-border bg-card/60 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="glass-soft rounded-xl p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Entrada
                      </p>
                      <p className="text-xs font-semibold">{modelInfo.inputShape}</p>
                    </div>
                    <div className="glass-soft rounded-xl p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Saída
                      </p>
                      <p className="text-xs font-semibold">{modelInfo.outputShape}</p>
                    </div>
                    <div className="glass-soft rounded-xl p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Detecção
                      </p>
                      <p className="text-xs font-semibold">
                        {config.autoDetected ? "automática" : "manual"}
                      </p>
                    </div>
                  </div>

                  <details className="mt-3 rounded-xl border border-border bg-card/40 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                      Configuração da entrada
                      {!config.autoDetected && " — confirme os valores"}
                    </summary>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <label className="space-y-1">
                        <span className="text-muted-foreground">Largura</span>
                        <input
                          type="number"
                          value={config.width}
                          onChange={(e) =>
                            updateConfig({ width: Number(e.target.value) || 1 })
                          }
                          className="w-full rounded-lg border border-border bg-card/70 px-2 py-1"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-muted-foreground">Altura</span>
                        <input
                          type="number"
                          value={config.height}
                          onChange={(e) =>
                            updateConfig({ height: Number(e.target.value) || 1 })
                          }
                          className="w-full rounded-lg border border-border bg-card/70 px-2 py-1"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-muted-foreground">Formato</span>
                        <select
                          value={config.layout}
                          onChange={(e) =>
                            updateConfig({
                              layout: e.target.value as ModelConfig["layout"],
                            })
                          }
                          className="w-full rounded-lg border border-border bg-card/70 px-2 py-1"
                        >
                          <option value="nchw">NCHW</option>
                          <option value="nhwc">NHWC</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-muted-foreground">Normalização</span>
                        <select
                          value={config.normalization}
                          onChange={(e) =>
                            updateConfig({
                              normalization: e.target.value as Normalization,
                            })
                          }
                          className="w-full rounded-lg border border-border bg-card/70 px-2 py-1"
                        >
                          <option value="0-1">0 a 1</option>
                          <option value="imagenet">ImageNet</option>
                          <option value="0-255">0 a 255</option>
                        </select>
                      </label>
                    </div>
                  </details>
                </>
              )}
            </section>

            {/* 2. Confiança */}
            <section className="glass rounded-3xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <StepBadge n={2} />
                <h2 className="font-display font-semibold">Confiança mínima</h2>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Mostrar classificações com confiança ≥
                </span>
                <span className="font-display text-lg font-bold text-primary">
                  {threshold}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </section>

            {/* 3. Traduções */}
            <section className="glass rounded-3xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <StepBadge n={3} />
                <h2 className="font-display font-semibold">
                  Traduções{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    opcional
                  </span>
                </h2>
              </div>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleCsvFile(e.target.files?.[0])}
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card/40 p-4 text-left transition hover:border-primary/40"
              >
                <div>
                  <p className="text-sm font-medium">
                    {csvName ?? "Carregar traducoes.csv"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {translations
                      ? `${translations.map.size} classes mapeadas`
                      : "formato: original,traducao"}
                  </p>
                </div>
                {translations && <span className="size-2 rounded-full bg-success" />}
              </button>
              {translations && (
                <div className="mt-3 rounded-xl bg-card/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Prévia do mapeamento
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {translations.entries.slice(0, 5).map((e) => (
                      <li key={e.original} className="truncate">
                        <span className="text-muted-foreground">{e.original}</span> →{" "}
                        <span className="font-medium">{e.translated}</span>
                      </li>
                    ))}
                  </ul>
                  {translations.entries.length > 5 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      +{translations.entries.length - 5} outras classes
                    </p>
                  )}
                </div>
              )}
              {csvError && (
                <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  {csvError}
                </p>
              )}
            </section>
          </aside>

          <main className="space-y-6 lg:col-span-7">
            {/* 4. Imagens */}
            <section className="glass rounded-3xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <StepBadge n={4} />
                <h2 className="font-display font-semibold">Imagens</h2>
              </div>
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files && addImages(e.target.files)}
              />
              <div
                onClick={() => imageInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addImages(e.dataTransfer.files);
                }}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
                  dragging
                    ? "border-primary bg-primary/10"
                    : "border-primary/30 bg-card/40 hover:border-primary/60"
                }`}
              >
                <p className="text-sm font-medium text-muted-foreground">
                  Arraste imagens ou clique para enviar
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  JPG · PNG · WEBP — múltiplos arquivos
                </p>
              </div>

              {imageError && (
                <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs text-warning">
                  {imageError}
                </p>
              )}

              {images.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {images.slice(0, 7).map((img) => (
                    <div
                      key={img.id}
                      className="glass-soft size-16 overflow-hidden rounded-xl"
                    >
                      <img
                        src={img.url}
                        alt={img.file.name}
                        className="size-full object-cover"
                      />
                    </div>
                  ))}
                  {images.length > 7 && (
                    <div className="glass-soft grid size-16 place-items-center rounded-xl text-xs font-semibold text-primary">
                      +{images.length - 7}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={classify}
                disabled={!session || images.length === 0 || progress !== null}
                className="bg-gradient-brand mt-5 w-full rounded-2xl py-3.5 font-display font-semibold text-primary-foreground shadow-[var(--shadow-brand)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {progress
                  ? `Classificando… ${progress.done}/${progress.total}`
                  : "Classificar imagens"}
              </button>
              {!session && images.length > 0 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Carregue um modelo ONNX para iniciar a classificação.
                </p>
              )}
            </section>

            {/* Resultados */}
            <section className="glass rounded-3xl p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display font-semibold">Resultados</h2>
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="text-muted-foreground">
                    Processadas: <b className="text-foreground">{results.length}</b>
                  </span>
                  <span className="text-muted-foreground">
                    Acima: <b className="text-success">{above}</b>
                  </span>
                  <span className="text-muted-foreground">
                    Abaixo: <b className="text-warning">{below}</b>
                  </span>
                  <span className="text-muted-foreground">
                    Média:{" "}
                    <b className="text-foreground">
                      {scored.length > 0 ? formatPercent(average) : "—"}
                    </b>
                  </span>
                  {failed > 0 && (
                    <span className="text-muted-foreground">
                      Com erro: <b className="text-destructive">{failed}</b>
                    </span>
                  )}
                </div>
              </div>

              {description && modelInfo && (
                <p className="mb-4 rounded-2xl bg-card/40 p-3 text-xs text-muted-foreground">
                  <b className="text-foreground">{modelInfo.fileName}</b> — {description}
                </p>
              )}

              {results.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Os resultados de cada imagem aparecem aqui após a classificação.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {results.map((r) => {
                    // Sempre resolve com o CSV atual: índice tem prioridade,
                    // depois o nome original da classe.
                    const translated = resolveTranslation(
                      translations,
                      r.classIndex ?? null,
                      r.originalClass ?? "",
                    );
                    const hasIndex = r.classIndex != null;
                    const showOriginal =
                      !!translated && r.originalClass !== String(r.classIndex);

                    return (
                    <div key={r.id} className="glass-soft rounded-2xl p-4">
                      <div className="flex gap-3">
                        <img
                          src={r.url}
                          alt={r.fileName}
                          className="size-16 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs text-muted-foreground">
                            {r.fileName}
                          </p>
                          {r.error ? (
                            <p className="mt-1 text-xs text-destructive">{r.error}</p>
                          ) : (
                            <>
                              <p className="font-display text-base font-semibold capitalize">
                                {translated ?? r.originalClass}
                              </p>
                              {showOriginal && (
                                <p className="text-xs text-muted-foreground">
                                  Original: {r.originalClass}
                                </p>
                              )}
                              {hasIndex && (
                                <p className="text-xs text-muted-foreground">
                                  Índice: {r.classIndex}
                                </p>
                              )}
                              <p className="mt-1 text-[10px] leading-tight text-muted-foreground/70">
                                debug · índice: {hasIndex ? r.classIndex : "—"} ·
                                classe original: {r.originalClass ?? "—"} ·
                                tradução: {translated ?? "sem tradução"}
                              </p>
                            </>
                          )}

                        </div>
                      </div>
                      {!r.error && (
                        <>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={
                                r.passed
                                  ? "bg-gradient-brand h-full"
                                  : "h-full bg-warning"
                              }
                              style={{ width: `${(r.confidence ?? 0) * 100}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs font-semibold">
                              {formatPercent(r.confidence ?? 0)}
                            </span>
                            <span
                              className={`text-xs font-medium ${
                                r.passed ? "text-success" : "text-warning"
                              }`}
                            >
                              {r.passed
                                ? "✓ Acima do threshold"
                                : `⚠ Abaixo de ${threshold}%`}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
