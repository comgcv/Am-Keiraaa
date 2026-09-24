"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type LayerKind = "image" | "video" | "audio" | "text" | "shape" | "scene" | "unknown";
type Layer = {
  id: string; label: string; kind: LayerKind; start: number; end: number;
  x: number; y: number; scaleX: number; scaleY: number; rotation: number; opacity: number;
  fill?: string; text?: string; media?: string; source?: string; file?: File; muted?: boolean;
};
type Project = { name: string; width: number; height: number; fps: number; duration: number; background: string; layers: Layer[]; xml: string };

type MediaFile = { id: string; name: string; type: string; url: string; file: File };

function attr(el: Element, name: string, fallback = "") { return el.getAttribute(name) ?? fallback; }
function num(value: string | null | undefined, fallback = 0) { const n = Number.parseFloat(value || ""); return Number.isFinite(n) ? n : fallback; }
function findNumber(root: Element, names: string[], fallback: number) {
  for (const name of names) { const v = root.getAttribute(name); if (v != null && Number.isFinite(Number(v))) return Number(v); }
  return fallback;
}
function classify(el: Element): LayerKind {
  const tag = el.tagName.toLowerCase();
  if (tag === "image" || tag === "media" && /image|photo/i.test(attr(el,"type"))) return "image";
  if (tag === "video" || /video/i.test(attr(el,"type"))) return "video";
  if (tag === "audio" || /audio/i.test(attr(el,"type"))) return "audio";
  if (tag === "text") return "text";
  if (tag === "shape") return "shape";
  if (tag === "scene" || tag === "group") return "scene";
  return "unknown";
}
function parseTransform(el: Element) {
  const t = el.querySelector(":scope > transform") || el.querySelector("transform");
  const loc = t?.querySelector("location");
  const scale = t?.querySelector("scale");
  return {
    x: num(loc?.getAttribute("value")?.split(",")[0], 0), y: num(loc?.getAttribute("value")?.split(",")[1], 0),
    scaleX: num(scale?.getAttribute("value")?.split(",")[0], 1), scaleY: num(scale?.getAttribute("value")?.split(",")[1], 1),
    rotation: num(t?.querySelector("rotation")?.getAttribute("value"), 0)
  };
}
function parseXml(xml: string, fallbackName = "Alight Motion Project"): Project {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML preset tidak valid atau rusak.");
  const root = doc.documentElement;
  const width = findNumber(root, ["width","w"], findNumber(doc.querySelector("scene") || root,["width","w"],1080));
  const height = findNumber(root, ["height","h"], findNumber(doc.querySelector("scene") || root,["height","h"],1920));
  const fps = findNumber(root, ["fps","frameRate"], findNumber(doc.querySelector("scene") || root,["fps","frameRate"],30));
  const duration = findNumber(root, ["duration","durationMs","endTime"], findNumber(doc.querySelector("scene") || root,["duration","durationMs","endTime"],5000));
  const background = attr(root,"background", attr(doc.querySelector("scene") || root,"background","#000000"));
  const layerEls = Array.from(doc.querySelectorAll("scene > *, scene layer, layer, image, video, audio, text, shape, group"));
  const unique = Array.from(new Set(layerEls));
  const layers: Layer[] = unique.map((el, i) => {
    const kind = classify(el); const tr = parseTransform(el);
    const media = attr(el,"media", attr(el,"src", attr(el,"uri", "")));
    const text = (el.textContent || "").trim();
    return {
      id: attr(el,"id",String(i+1)), label: attr(el,"label",attr(el,"name",`${kind.toUpperCase()} ${i+1}`)), kind,
      start: num(attr(el,"startTime","0"),0), end: num(attr(el,"endTime",String(duration)),duration), ...tr,
      opacity: num(attr(el,"opacity","1"),1), fill: attr(el,"fillColor",attr(el,"color","#ffffff")), text, media
    };
  }).filter(x => x.kind !== "unknown");
  const name = attr(root,"name", attr(doc.querySelector("scene") || root,"name",fallbackName));
  return { name, width, height, fps, duration, background, layers, xml };
}

function escapeXml(s: string) { return s.replace(/[<>&'\"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;","\"":"&quot;"}[c] || c)); }
function projectToXml(project: Project) {
  let xml = project.xml;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  root.setAttribute("name", project.name);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}\n<!-- Browser editor replacement map -->\n<!-- ${project.layers.filter(l=>l.source).map(l=>`${escapeXml(l.id)}=${escapeXml(l.source || "")}`).join(" | ")} -->`;
}

export default function Home() {
  const [url,setUrl]=useState(""); const [project,setProject]=useState<Project|null>(null); const [selected,setSelected]=useState<string|null>(null);
  const [time,setTime]=useState(0); const [playing,setPlaying]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  const [media,setMedia]=useState<MediaFile[]>([]); const [quality,setQuality]=useState(1); const [zoom,setZoom]=useState(1);
  const [exporting,setExporting]=useState(false); const fileInput=useRef<HTMLInputElement>(null); const audioRefs=useRef<Record<string,HTMLAudioElement|null>>({});
  const raf=useRef<number|null>(null); const last=useRef<number|null>(null);

  const selectedLayer=useMemo(()=>project?.layers.find(l=>l.id===selected)||null,[project,selected]);
  useEffect(()=>()=>{media.forEach(m=>URL.revokeObjectURL(m.url)); if(raf.current) cancelAnimationFrame(raf.current)},[media]);
  useEffect(()=>{
    if(!playing){last.current=null; if(raf.current) cancelAnimationFrame(raf.current); return;}
    const tick=(now:number)=>{ if(last.current==null) last.current=now; const dt=(now-last.current); last.current=now; setTime(v=>{const next=v+dt; return project ? (next>project.duration?0:next):next}); raf.current=requestAnimationFrame(tick); };
    raf.current=requestAnimationFrame(tick); return ()=>{if(raf.current) cancelAnimationFrame(raf.current)};
  },[playing,project]);

  function importXml(xml:string,name="Imported preset") { const p=parseXml(xml,name); setProject(p); setSelected(p.layers[0]?.id||null); setTime(0); setPlaying(false); setMessage(`Preset asli berhasil dimuat: ${p.layers.length} layer, ${p.width}×${p.height}, ${p.fps} FPS.`); }
  async function processLink(){
    setMessage(""); const v=url.trim();
    try { const u=new URL(v); if(u.protocol!=="https:" || !/(^|\.)alightcreative\.com$/i.test(u.hostname)) throw new Error("Masukkan share link Alight Motion dari alightcreative.com."); } catch(e){setMessage(e instanceof Error?e.message:"Link tidak valid.");return}
    setBusy(true); try { const r=await fetch("/api/inspect-link",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:v})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Preset tidak dapat diambil."); importXml(d.xml,"Alight Motion Share"); } catch(e){setMessage(e instanceof Error?e.message:"Gagal mengambil preset.")} finally{setBusy(false)}
  }
  function handleXmlFile(file?:File){if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{importXml(String(reader.result),file.name.replace(/\.xml$/i,"")||"Imported XML")}catch(e){setMessage(e instanceof Error?e.message:"XML tidak valid.")}}; reader.readAsText(file)}
  function addMedia(files:FileList|null){if(!files)return; const arr=Array.from(files).map(f=>({id:crypto.randomUUID(),name:f.name,type:f.type,url:URL.createObjectURL(f),file:f})); setMedia(v=>[...v,...arr]);}
  function replaceSelected(file?:File){ if(!file||!project||!selectedLayer)return; const url=URL.createObjectURL(file); const m:MediaFile={id:crypto.randomUUID(),name:file.name,type:file.type,url,file}; setMedia(v=>[...v,m]); setProject({...project,layers:project.layers.map(l=>l.id===selectedLayer.id?{...l,source:url,file,media:file.name}:l)}); setMessage(`${selectedLayer.label} diganti dengan ${file.name}.`); }
  function updateSelected(patch:Partial<Layer>){if(!project||!selectedLayer)return; setProject({...project,layers:project.layers.map(l=>l.id===selectedLayer.id?{...l,...patch}:l)})}
  function visibleLayers(){return (project?.layers||[]).filter(l=>time>=l.start&&time<=l.end);}
  function exportVideo(){
    if(!project)return; setExporting(true); setPlaying(false);
    try {
      const canvas=document.createElement("canvas"); const scale=Math.min(1,1080/project.width); canvas.width=Math.max(1,Math.round(project.width*scale)); canvas.height=Math.max(1,Math.round(project.height*scale)); const ctx=canvas.getContext("2d")!;
      const stream=canvas.captureStream(Math.min(60,Math.max(1,project.fps))); const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm"; const rec=new MediaRecorder(stream,{mimeType:mime}); const chunks:BlobPart[]=[]; rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}; rec.onstop=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(chunks,{type:mime}));a.download=`${project.name.replace(/[^a-z0-9_-]+/gi,"_")}.webm`;a.click();setExporting(false);setMessage("Export selesai. Browser menggunakan WebM karena MediaRecorder tidak menyediakan MP4 secara universal.")};
      let t=0; const step=1000/project.fps; const start=performance.now(); rec.start(); const draw=()=>{if(t>project.duration){rec.stop();return} ctx.fillStyle=project.background||"#000";ctx.fillRect(0,0,canvas.width,canvas.height); const layers=project.layers.filter(l=>t>=l.start&&t<=l.end); for(const l of layers){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,l.opacity));ctx.translate(l.x*scale,l.y*scale);ctx.rotate(l.rotation*Math.PI/180);ctx.scale(l.scaleX*scale,l.scaleY*scale); if((l.kind==="image"||l.kind==="video")&&l.source){const el=document.querySelector(`[data-layer-media="${CSS.escape(l.id)}"]`) as HTMLImageElement|HTMLVideoElement|null;if(el)ctx.drawImage(el,-el.clientWidth/2,-el.clientHeight/2,el.clientWidth,el.clientHeight)}else if(l.kind==="text"){ctx.fillStyle=l.fill||"#fff";ctx.font="48px sans-serif";ctx.textAlign="center";ctx.fillText(l.text||l.label,0,0)}else if(l.kind==="shape"){ctx.fillStyle=l.fill||"#fff";ctx.fillRect(-150,-150,300,300)}ctx.restore()} t+=step; const elapsed=performance.now()-start; const wait=Math.max(0,step-elapsed); setTimeout(draw,wait)}; draw();
    } catch {setExporting(false);setMessage("Browser tidak mendukung export video pada perangkat ini.")}
  }

  return <main>
    <div className="topbar"><div className="brand"><div className="brandMark">P</div><div><strong>PRESET WEB EDITOR</strong><span>Real XML workspace · browser runtime</span></div></div><div className="status"><i/> REAL PRESET</div></div>
    <section className="hero"><div className="eyebrow">ALIGHT PROJECT WORKSPACE</div><h1>Load preset <span>asli, bukan simulasi.</span></h1><p>Masukkan share link Alight Motion atau buka XML langsung. Timeline, layer, durasi, FPS, canvas, dan asset dibaca dari project yang tersedia.</p>
      <div className="urlBox"><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&processLink()} placeholder="https://alightcreative.com/am/share/..."/><button onClick={processLink} disabled={busy}>{busy?"LOADING...":"LOAD PRESET"}</button></div>
      <div className="quick"><label className="fileBtn">OPEN XML<input ref={fileInput} hidden type="file" accept=".xml,text/xml,application/xml" onChange={e=>handleXmlFile(e.target.files?.[0])}/></label><label className="fileBtn">ADD MEDIA<input hidden type="file" multiple accept="image/*,video/*,audio/*" onChange={e=>addMedia(e.target.files)}/></label></div>
      {message&&<div className="notice">{message}</div>}
    </section>
    {!project?<section className="steps"><div><b>01</b><strong>Share link / XML</strong><span>Ambil project yang benar-benar tersedia, bukan data dummy.</span></div><div><b>02</b><strong>Live timeline</strong><span>Layer dan waktu mengikuti XML yang dibaca browser.</span></div><div><b>03</b><strong>Replace & export</strong><span>Ganti media lalu preview dan rekam hasilnya.</span></div></section>:<section className="workspace">
      <div className="projectHead"><div><div className="eyebrow">PROJECT</div><h2>{project.name}</h2></div><div className="specs"><span>{project.width} × {project.height}</span><span>{project.fps} FPS</span><span>{(project.duration/1000).toFixed(2)}s</span><span>{project.layers.length} layers</span></div></div>
      <div className="editorGrid">
        <div className="previewCard"><div className="cardTitle"><span>LIVE PREVIEW</span><span className="live"><i/> {playing?"PLAYING":"READY"}</span></div>
          <div className="phoneFrame" style={{aspectRatio:`${project.width}/${project.height}`,background:project.background||"#000"}}>{visibleLayers().length===0?<div className="emptyPreview"><div className="play">▶</div><strong>No active layer</strong><small>Geser timeline untuk melihat frame.</small></div>:visibleLayers().map(l=>{
            const style:CSSProperties={position:"absolute",left:`${l.x/project.width*100}%`,top:`${l.y/project.height*100}%`,transform:`translate(-50%,-50%) rotate(${l.rotation}deg) scale(${l.scaleX},${l.scaleY})`,opacity:l.opacity,maxWidth:"90%",maxHeight:"90%"};
            if((l.kind==="image"||l.kind==="video")&&l.source)return l.kind==="video"?<video key={l.id} data-layer-media={l.id} src={l.source} autoPlay muted loop playsInline style={style}/>:<img key={l.id} data-layer-media={l.id} src={l.source} alt="" style={style}/>;
            if(l.kind==="text")return <div key={l.id} style={{...style,color:l.fill||"#fff",fontSize:`${Math.max(12,48*zoom)}px`,fontWeight:700,whiteSpace:"nowrap"}}>{l.text||l.label}</div>;
            if(l.kind==="shape")return <div key={l.id} style={{...style,width:120,height:120,background:l.fill||"#fff",borderRadius:l.label.toLowerCase().includes("circle")?"50%":"12px"}}/>;
            return null;
          })}</div>
          <div className="transport"><button onClick={()=>setTime(0)}>⏮</button><button className="playBtn" onClick={()=>setPlaying(v=>!v)}>{playing?"Ⅱ":"▶"}</button><button onClick={()=>setTime(project.duration)}>⏭</button><span>{(time/1000).toFixed(2)} / {(project.duration/1000).toFixed(2)}s</span></div>
          <input className="timeline" type="range" min="0" max={project.duration} step={1} value={time} onChange={e=>setTime(Number(e.target.value))}/>
          <div className="zoomRow"><span>Preview scale</span><input type="range" min="0.5" max="2" step="0.05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><span>{zoom.toFixed(2)}x</span></div>
        </div>
        <div className="panel"><div className="cardTitle"><span>LAYERS & ASSETS</span><span>{project.layers.length} items</span></div><div className="assetList">{project.layers.map(l=><div key={l.id} className={`asset ${selected===l.id?"selected":""}`} onClick={()=>setSelected(l.id)}><div className={`assetIcon ${l.kind}`}>{l.kind[0].toUpperCase()}</div><div className="assetInfo"><strong>{l.label}</strong><span>{l.kind.toUpperCase()} · {(l.start/1000).toFixed(2)}–{(l.end/1000).toFixed(2)}s</span></div><div className="assetActions">{(l.kind==="image"||l.kind==="video"||l.kind==="audio")&&<button className="miniBtn" onClick={e=>{e.stopPropagation();const i=document.createElement("input");i.type="file";i.accept=l.kind+"/*";i.onchange=()=>replaceSelected(i.files?.[0]);i.click()}}>REPLACE</button>}</div></div>)}</div>
          {selectedLayer&&<div className="inspector"><div className="eyebrow">SELECTED LAYER</div><h3>{selectedLayer.label}</h3><p>{selectedLayer.kind.toUpperCase()} · {selectedLayer.id}</p><div className="fieldGrid"><label>Opacity<input type="range" min="0" max="1" step="0.01" value={selectedLayer.opacity} onChange={e=>updateSelected({opacity:Number(e.target.value)})}/></label><label>Rotation<input type="number" value={selectedLayer.rotation} onChange={e=>updateSelected({rotation:Number(e.target.value)})}/></label><label>X<input type="number" value={selectedLayer.x} onChange={e=>updateSelected({x:Number(e.target.value)})}/></label><label>Y<input type="number" value={selectedLayer.y} onChange={e=>updateSelected({y:Number(e.target.value)})}/></label></div>{selectedLayer.source&&<div className="replacement">Replacement: {selectedLayer.media}</div>}</div>}
          <div className="gallery"><div className="cardTitle"><span>MEDIA GALLERY</span><span>{media.length}</span></div>{media.length===0?<small>Tambahkan foto, video, atau audio untuk mengganti asset.</small>:<div className="mediaGrid">{media.map(m=><button key={m.id} title={m.name} onClick={()=>selectedLayer&&setProject({...project,layers:project.layers.map(l=>l.id===selectedLayer.id?{...l,source:m.url,file:m.file,media:m.name}:l)})}>{m.type.startsWith("image/")?<img src={m.url} alt=""/>:<span>{m.type.split("/")[0].toUpperCase()}</span>}</button>)}</div>}</div>
        </div>
      </div>
      <div className="exportCard"><div><div className="eyebrow">EXPORT</div><h3>Export project</h3><p>Browser-native recorder. MP4 tidak tersedia secara universal di MediaRecorder, jadi fallback aman adalah WebM.</p></div><div className="exportControls"><button className="miniBtn" onClick={()=>{const blob=new Blob([projectToXml(project)],{type:"application/xml"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${project.name}.xml`;a.click()}}>DOWNLOAD XML</button><button className="exportBtn" disabled={exporting} onClick={exportVideo}>{exporting?"EXPORTING...":"EXPORT VIDEO"}</button></div></div>
    </section>}
    <footer>Independent browser editor · XML interoperability workspace</footer>
  </main>;
}
