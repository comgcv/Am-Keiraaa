 "use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Asset = {
  id: string;
  name: string;
  kind: "image" | "video" | "audio" | "text";
  source?: string;
  file?: File;
  enabled: boolean;
};

type Project = {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  assets: Asset[];
};

const demoAssets: Asset[] = [
  { id: "image-1", name: "Image 01", kind: "image", enabled: true },
  { id: "image-2", name: "Image 02", kind: "image", enabled: true },
  { id: "video-1", name: "Video Overlay", kind: "video", enabled: true },
  { id: "text-1", name: "Title", kind: "text", enabled: true },
  { id: "audio-1", name: "Music", kind: "audio", enabled: true },
];

function makeProject(url: string): Project {
  const tail = url.split("/").filter(Boolean).pop() || "preset";
  return {
    name: `Preset ${tail.slice(0, 12)}`,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 12,
    assets: demoAssets.map(x => ({ ...x }))
  };
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string>("image-1");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectedAsset = useMemo(
    () => project?.assets.find(a => a.id === selected) ?? null,
    [project, selected]
  );

  function validAlightUrl(value: string) {
    try {
      const u = new URL(value);
      return /(^|\\.)alightcreative\\.com$/i.test(u.hostname);
    } catch {
      return false;
    }
  }

  async function processPreset() {
    setMessage("");
    if (!validAlightUrl(url.trim())) {
      setMessage("Masukkan link Alight Creative/Alight Motion yang valid.");
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/inspect-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses link.");

      setProject(makeProject(url.trim()));
      setMessage(
        "Link terdeteksi. Editor siap. Data timeline internal hanya dapat dimuat jika format project yang dapat diakses diberikan."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan.");
    } finally {
      setProcessing(false);
    }
  }

  function replaceAsset(id: string, file: File | undefined) {
    if (!file || !project) return;

    const asset = project.assets.find(a => a.id === id);
    if (!asset) return;

    if (asset.kind === "image" && !file.type.startsWith("image/")) {
      setMessage("Asset image harus berupa file gambar.");
      return;
    }
    if (asset.kind === "video" && !file.type.startsWith("video/")) {
      setMessage("Asset video harus berupa file video.");
      return;
    }
    if (asset.kind === "audio" && !file.type.startsWith("audio/")) {
      setMessage("Asset audio harus berupa file audio.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setProject({
      ...project,
      assets: project.assets.map(a =>
        a.id === id ? { ...a, file, source: objectUrl, name: file.name } : a
      )
    });

    if (asset.kind === "image" || asset.kind === "video") {
      setPreviewUrl(objectUrl);
    }

    setMessage(`${asset.name} berhasil diganti dengan ${file.name}.`);
  }

  function removeReplacement(id: string) {
    if (!project) return;
    const asset = project.assets.find(a => a.id === id);
    if (!asset) return;
    if (asset.source?.startsWith("blob:")) URL.revokeObjectURL(asset.source);

    setProject({
      ...project,
      assets: project.assets.map(a =>
        a.id === id ? { ...a, file: undefined, source: undefined, name: `${a.kind === "image" ? "Image" : a.kind === "video" ? "Video" : a.kind === "audio" ? "Audio" : "Title"} ${id.split("-")[1] || ""}`.trim() } : a
      )
    });
    setPreviewUrl(null);
    setMessage("Penggantian asset dibatalkan.");
  }

  async function renderPreview() {
    if (!project) return;
    setRendering(true);
    setMessage("");
    try {
      const selectedMedia = project.assets.find(a =>
        (a.kind === "image" || a.kind === "video") && a.source
      );

      if (selectedMedia?.source) {
        setPreviewUrl(selectedMedia.source);
        setMessage("Preview menggunakan asset pengganti yang dipilih.");
      } else {
        setMessage("Belum ada image/video pengganti untuk dijadikan preview.");
      }
    } finally {
      setRendering(false);
    }
  }

  return (
    <main>
      <div className="topbar">
        <div className="brand">
          <div className="brandMark">P</div>
          <div>
            <strong>PRESET WEB EDITOR</strong>
            <span>Browser-based project workspace</span>
          </div>
        </div>
        <div className="status"><i /> Vercel Ready</div>
      </div>

      <section className="hero">
        <div className="eyebrow">ALIGHT PROJECT WORKSPACE</div>
        <h1>Edit preset <span>langsung di browser.</span></h1>
        <p>
          Masukkan share link, buka workspace, ganti asset dari HP, lalu siapkan preview.
          Tidak perlu memasang editor desktop.
        </p>

        <div className="urlBox">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://alightcreative.com/am/share/..."
            onKeyDown={e => e.key === "Enter" && processPreset()}
          />
          <button onClick={processPreset} disabled={processing}>
            {processing ? "PROCESSING..." : "PROCESS PRESET"}
          </button>
        </div>

        {message && <div className="notice">{message}</div>}
      </section>

      {project ? (
        <section className="workspace">
          <div className="projectHead">
            <div>
              <div className="eyebrow">PROJECT</div>
              <h2>{project.name}</h2>
            </div>
            <div className="specs">
              <span>{project.width} × {project.height}</span>
              <span>{project.fps} FPS</span>
              <span>{project.duration}s</span>
            </div>
          </div>

          <div className="editorGrid">
            <div className="previewCard">
              <div className="cardTitle">
                <span>LIVE PREVIEW</span>
                <span className="live"><i /> LIVE</span>
              </div>

              <div className="phoneFrame">
                {previewUrl ? (
                  selectedAsset?.kind === "video" ? (
                    <video src={previewUrl} controls autoPlay muted loop playsInline />
                  ) : (
                    <img src={previewUrl} alt="Preview asset" />
                  )
                ) : (
                  <div className="emptyPreview">
                    <div className="play">▶</div>
                    <strong>Preset Preview</strong>
                    <small>Replace an image or video to see it here.</small>
                  </div>
                )}
              </div>

              <button className="renderBtn" onClick={renderPreview} disabled={rendering}>
                {rendering ? "PREPARING..." : "REFRESH PREVIEW"}
              </button>
            </div>

            <div className="panel">
              <div className="cardTitle">
                <span>ASSETS & LAYERS</span>
                <span>{project.assets.length} items</span>
              </div>

              <div className="assetList">
                {project.assets.map(asset => (
                  <div
                    className={`asset ${selected === asset.id ? "selected" : ""}`}
                    key={asset.id}
                    onClick={() => setSelected(asset.id)}
                  >
                    <div className={`assetIcon ${asset.kind}`}>{asset.kind[0].toUpperCase()}</div>
                    <div className="assetInfo">
                      <strong>{asset.name}</strong>
                      <span>{asset.kind.toUpperCase()}</span>
                    </div>
                    <div className="assetActions">
                      {(asset.kind === "image" || asset.kind === "video" || asset.kind === "audio") && (
                        <>
                          <input
                            hidden
                            type="file"
                            accept={
                              asset.kind === "image" ? "image/*" :
                              asset.kind === "video" ? "video/*" : "audio/*"
                            }
                            ref={el => { fileRefs.current[asset.id] = el; }}
                            onChange={e => replaceAsset(asset.id, e.target.files?.[0])}
                          />
                          <button
                            className="miniBtn"
                            onClick={e => {
                              e.stopPropagation();
                              fileRefs.current[asset.id]?.click();
                            }}
                          >
                            REPLACE
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedAsset && (
                <div className="inspector">
                  <div className="eyebrow">SELECTED ASSET</div>
                  <h3>{selectedAsset.name}</h3>
                  <p>Type: {selectedAsset.kind}</p>
                  {selectedAsset.source && (
                    <button className="removeBtn" onClick={() => removeReplacement(selectedAsset.id)}>
                      REMOVE REPLACEMENT
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="exportCard">
            <div>
              <div className="eyebrow">EXPORT</div>
              <h3>Prepare your final video</h3>
              <p>Pengaturan tersimpan untuk pipeline render berikutnya.</p>
            </div>
            <div className="exportControls">
              <label>Resolution
                <select defaultValue="1080p">
                  <option>360p</option>
                  <option>480p</option>
                  <option>720p</option>
                  <option>1080p</option>
                  <option>1440p</option>
                  <option>2160p</option>
                </select>
              </label>
              <label>FPS
                <select defaultValue="30">
                  <option>24</option>
                  <option>30</option>
                  <option>60</option>
                  <option>120</option>
                </select>
              </label>
              <button className="exportBtn" onClick={() => setMessage("Export render membutuhkan project data/timeline yang benar-benar tersedia. UI dan asset replacement sudah siap.")}>
                EXPORT VIDEO
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="steps">
          <div><b>01</b><strong>Paste preset link</strong><span>Masukkan link project yang kamu punya.</span></div>
          <div><b>02</b><strong>Replace assets</strong><span>Ganti image, video, atau audio dari HP.</span></div>
          <div><b>03</b><strong>Preview & export</strong><span>Preview hasil dan siapkan proses render.</span></div>
        </section>
      )}

      <footer>
        Preset Web Editor · GitHub + Vercel architecture
      </footer>
    </main>
  );
}