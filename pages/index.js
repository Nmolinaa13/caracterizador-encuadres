import { useState } from "react"
import { MEDIOS, TEMAS, CASOS, DATE_RANGES, VALORACIONES } from "../lib/constants"

function Badge({ tipo }) {
  const t = tipo === "Tradicional digital"
  return (
    <span style={{
      fontSize: "10px", padding: "2px 8px", borderRadius: "20px", fontWeight: 600,
      background: t ? "#1e3a5f" : "#3d1f00",
      color: t ? "#93c5fd" : "#fb923c",
      border: `1px solid ${t ? "#2563eb40" : "#ea580c40"}`,
    }}>{tipo}</span>
  )
}

function ValBadge({ val }) {
  const bg = ["", "#7f1d1d", "#92400e", "#78350f", "#1e293b", "#14532d", "#065f46", "#1e3a5f"]
  const fg = ["", "#fca5a5", "#fcd34d", "#fde68a", "#cbd5e1", "#86efac", "#34d399", "#93c5fd"]
  return (
    <div style={{
      minWidth: "38px", height: "38px", borderRadius: "8px", display: "flex",
      alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "17px",
      flexShrink: 0, background: bg[val] || "#1e293b", color: fg[val] || "#cbd5e1",
      border: `1px solid ${(fg[val] || "#cbd5e1")}30`,
    }}>{val}</div>
  )
}

export default function Home() {
  const [step, setStep] = useState("config")
  const [filters, setFilters] = useState({ medio: "", caso: "", fechaInicio: "", fechaFin: "", tema: "", maxResults: 10 })
  const [foundUrls, setFoundUrls] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [results, setResults] = useState([])
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ cur: 0, total: 0 })
  const [editingIdx, setEditingIdx] = useState(null)
  const [manualUrl, setManualUrl] = useState("")

  const medio = MEDIOS.find(m => m.id === filters.medio)
  const dr = DATE_RANGES[filters.caso]

  const lg = (msg, type = "info") => setLog(p => [...p, { msg, type }])

  // ── SEARCH ──
  const handleSearch = async () => {
    setLoading(true); setLog([]); setFoundUrls([])
    const start = filters.fechaInicio || dr?.start
    const end   = filters.fechaFin   || dr?.end
    lg(`🔍 Buscando en ${medio.nombre} sobre ${filters.caso} (${start} → ${end})…`)
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medio, caso: filters.caso, start, end, tema: filters.tema, maxResults: filters.maxResults }),
      })
      const data = await res.json()
      if (data.error) { lg(`✗ ${data.error}`, "error") }
      else if (!data.articulos?.length) { lg("⚠ Sin resultados. Prueba otros filtros.", "warn") }
      else {
        lg(`✓ ${data.articulos.length} artículos encontrados`, "ok")
        setFoundUrls(data.articulos)
        setSelected(new Set(data.articulos.map((_, i) => i)))
      }
    } catch (e) { lg(`✗ Error: ${e.message}`, "error") }
    setLoading(false); setStep("urls")
  }

  // ── CHARACTERIZE ──
  const handleCharacterize = async () => {
    const toProcess = foundUrls.filter((_, i) => selected.has(i))
    setLoading(true); setResults([]); setLog([])
    setProgress({ cur: 0, total: toProcess.length }); setStep("processing")
    const acc = []
    for (let i = 0; i < toProcess.length; i++) {
      const art = toProcess[i]
      setProgress({ cur: i + 1, total: toProcess.length })
      lg(`[${i + 1}/${toProcess.length}] ${art.titulo || art.url}`)
      try {
        const res = await fetch("/api/characterize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: art.url, titulo: art.titulo, caso: filters.caso }),
        })
        const a = await res.json()
        if (a.error) { lg(`  ✗ ${a.error}`, "error"); acc.push({ ...art, medio: medio.nombre, caso: filters.caso, estado: "error" }); continue }
        if (a.es_opinion) { lg("  ⚡ Excluido: opinión", "warn"); acc.push({ ...art, ...a, medio: medio.nombre, caso: filters.caso, estado: "excluido" }); continue }
        lg(`  ✓ Val:${a.valoracion} | ${a.tema}`, "ok")
        acc.push({ url: art.url, titulo: a.titulo || art.titulo || "", fecha: a.fecha || art.fecha || "", medio: medio.nombre, caso: filters.caso, ...a, estado: "ok" })
      } catch (e) { lg(`  ✗ ${e.message}`, "error") }
      setResults([...acc])
      await new Promise(r => setTimeout(r, 400))
    }
    setResults([...acc]); setLoading(false); setStep("results")
  }

  // ── EXPORT CSV ──
  const exportCSV = () => {
    const ok = results.filter(r => r.estado === "ok")
    const hdr = "URL,Título,Tema,Caso (Petro/Duque),Medio,Fecha D/M/AAAA,Valoración,Palabras clave\n"
    const rows = ok.map(r => {
      const fecha = r.fecha ? r.fecha.split("-").reverse().join("/") : ""
      return [`"${r.url}"`, `"${(r.titulo || "").replace(/"/g, "'")}"`, r.tema, r.caso, r.medio, fecha, r.valoracion, `"${r.palabras_clave || ""}"`].join(",")
    }).join("\n")
    const blob = new Blob(["\uFEFF" + hdr + rows], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `caracterizacion_${filters.medio}_${filters.caso?.replace(" ", "_")}.csv`; a.click()
  }

  const upd = (ri, field, val) => setResults(p => p.map((r, i) => i === ri ? { ...r, [field]: val } : r))
  const okResults = results.filter(r => r.estado === "ok")
  const avg = okResults.length ? (okResults.reduce((a, r) => a + (r.valoracion || 0), 0) / okResults.length).toFixed(2) : "–"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080b12; color: #c9d1d9; font-family: 'DM Mono', 'Fira Code', monospace; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: #0d1117; } ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
        .f { background: #0d1117; border: 1px solid #21262d; color: #c9d1d9; padding: 9px 13px; border-radius: 6px; width: 100%; font-family: 'DM Mono', monospace; font-size: 12px; outline: none; transition: border-color .2s; }
        .f:focus { border-color: #388bfd; }
        .f option { background: #161b22; }
        .bb { padding: 10px 22px; border-radius: 6px; font-family: 'DM Mono', monospace; font-weight: 500; font-size: 12px; cursor: pointer; border: none; transition: all .15s; letter-spacing: .04em; }
        .p { background: #1f6feb; color: #fff; } .p:hover { background: #388bfd; } .p:disabled { background: #21262d; color: #6e7681; cursor: not-allowed; }
        .o { background: transparent; border: 1px solid #30363d; color: #8b949e; } .o:hover { border-color: #8b949e; color: #c9d1d9; }
        .card { background: #0d1117; border: 1px solid #21262d; border-radius: 10px; padding: 20px; }
        .mb { background: #0d1117; border: 2px solid #21262d; border-radius: 8px; padding: 14px 16px; cursor: pointer; transition: all .15s; text-align: left; width: 100%; }
        .mb:hover { border-color: #388bfd; } .mb.s { border-color: #1f6feb; background: #0c1d3d; }
        .cb { background: #0d1117; border: 2px solid #21262d; border-radius: 8px; padding: 12px 24px; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 13px; color: #8b949e; transition: all .15s; }
        .cb:hover { border-color: #388bfd; color: #c9d1d9; } .cb.s { border-color: #1f6feb; background: #0c1d3d; color: #79c0ff; font-weight: 500; }
        .tg { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; border: 1px solid #21262d; color: #8b949e; transition: all .15s; }
        .tg:hover { border-color: #388bfd; color: #79c0ff; } .tg.on { background: #0c1d3d; border-color: #1f6feb; color: #79c0ff; }
        .ur { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #161b22; }
        .ur:last-child { border-bottom: none; }
        .le { font-size: 11px; line-height: 2; padding: 0 2px; }
        .rr { padding: 14px 0; border-bottom: 1px solid #161b22; } .rr:last-child { border-bottom: none; }
        .pt { height: 2px; background: #21262d; border-radius: 1px; overflow: hidden; margin-top: 8px; }
        .pf { height: 100%; background: linear-gradient(90deg, #1f6feb, #79c0ff); transition: width .3s; }
        label { font-size: 10px; font-weight: 500; color: #6e7681; letter-spacing: .1em; display: block; margin-bottom: 6px; }
        h1 { font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; color: #f0f6fc; margin-bottom: 4px; }
        a { color: #388bfd; text-decoration: none; } a:hover { text-decoration: underline; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #21262d", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080b12", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", background: "#1f6feb", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>📰</div>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "14px", color: "#f0f6fc" }}>Caracterizador de Encuadres Mediáticos</div>
            <div style={{ fontSize: "10px", color: "#6e7681", letterSpacing: ".08em" }}>SEMILLERO CP&OP · Universidad EAFIT</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {["config", "urls", "processing", "results"].map((s, i) => (
            <div key={s} style={{ width: "6px", height: "6px", borderRadius: "50%", background: ["config", "urls", "processing", "results"].indexOf(step) >= i ? "#1f6feb" : "#21262d" }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "32px 20px" }}>

        {/* ── CONFIG ── */}
        {step === "config" && (
          <div>
            <h1>Configurar búsqueda</h1>
            <p style={{ color: "#6e7681", fontSize: "12px", marginBottom: "28px" }}>
              Define los parámetros. La herramienta buscará y traerá las URLs directamente desde cada medio.
            </p>

            <div style={{ marginBottom: "24px" }}>
              <label>MEDIO DE COMUNICACIÓN</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
                {MEDIOS.map(m => (
                  <button key={m.id} className={`mb ${filters.medio === m.id ? "s" : ""}`} onClick={() => setFilters(f => ({ ...f, medio: m.id }))}>
                    <div style={{ fontWeight: 500, fontSize: "13px", color: "#c9d1d9", marginBottom: "4px" }}>{m.nombre}</div>
                    <Badge tipo={m.tipo} />
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label>CASO PRESIDENCIAL</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {CASOS.map(c => (
                  <button key={c} className={`cb ${filters.caso === c ? "s" : ""}`} onClick={() => setFilters(f => ({ ...f, caso: c }))}>
                    {c}
                    <div style={{ fontSize: "10px", color: "#6e7681", marginTop: "2px" }}>{DATE_RANGES[c]?.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label>FECHA INICIO {dr ? `(defecto: ${dr.start})` : ""}</label>
                <input type="date" className="f" value={filters.fechaInicio} min={dr?.start} max={dr?.end} onChange={e => setFilters(f => ({ ...f, fechaInicio: e.target.value }))} />
              </div>
              <div>
                <label>FECHA FIN {dr ? `(defecto: ${dr.end})` : ""}</label>
                <input type="date" className="f" value={filters.fechaFin} min={dr?.start} max={dr?.end} onChange={e => setFilters(f => ({ ...f, fechaFin: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: "28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label>FILTRAR POR TEMA (opcional)</label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <span className={`tg ${!filters.tema ? "on" : ""}`} onClick={() => setFilters(f => ({ ...f, tema: "" }))}>Todos</span>
                  {TEMAS.map(t => (
                    <span key={t} className={`tg ${filters.tema === t ? "on" : ""}`} onClick={() => setFilters(f => ({ ...f, tema: f.tema === t ? "" : t }))}>{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <label>CANTIDAD MÁXIMA DE ARTÍCULOS</label>
                <select className="f" value={filters.maxResults} onChange={e => setFilters(f => ({ ...f, maxResults: +e.target.value }))}>
                  {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} artículos</option>)}
                </select>
              </div>
            </div>

            <button className="bb p" disabled={!filters.medio || !filters.caso || loading} onClick={handleSearch}>
              {loading ? "⟳ Buscando…" : "🔍 Buscar artículos automáticamente"}
            </button>

            {log.length > 0 && (
              <div className="card" style={{ marginTop: "16px" }}>
                {log.map((l, i) => (
                  <div key={i} className="le" style={{ color: l.type === "ok" ? "#3fb950" : l.type === "error" ? "#f85149" : l.type === "warn" ? "#d29922" : "#6e7681" }}>{l.msg}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── URL REVIEW ── */}
        {step === "urls" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h1>Artículos encontrados</h1>
                <p style={{ color: "#6e7681", fontSize: "12px" }}>
                  <strong style={{ color: "#79c0ff" }}>{foundUrls.length}</strong> artículos en {medio?.nombre}. Revisa y selecciona los que quieres caracterizar.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="bb o" onClick={() => { setStep("config"); setFoundUrls([]) }}>← Volver</button>
                <button className="bb o" style={{ fontSize: "11px" }} onClick={() => setSelected(new Set(foundUrls.map((_, i) => i)))}>Todos</button>
                <button className="bb o" style={{ fontSize: "11px" }} onClick={() => setSelected(new Set())}>Ninguno</button>
              </div>
            </div>

            <div className="card" style={{ marginBottom: "16px" }}>
              {foundUrls.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px", color: "#6e7681", fontSize: "13px" }}>No se encontraron artículos. Prueba con otros filtros.</div>
              ) : foundUrls.map((art, i) => (
                <div key={i} className="ur">
                  <input type="checkbox" checked={selected.has(i)}
                    onChange={() => setSelected(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })}
                    style={{ accentColor: "#1f6feb", width: "15px", height: "15px", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", color: "#c9d1d9", marginBottom: "3px", fontWeight: 500 }}>{art.titulo || "(sin título)"}</div>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <a href={art.url} target="_blank" rel="noreferrer"
                        style={{ fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "500px" }}>
                        {art.url}
                      </a>
                      {art.fecha && <span style={{ fontSize: "11px", color: "#6e7681", flexShrink: 0 }}>{art.fecha}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginBottom: "16px" }}>
              <label>AGREGAR URL MANUALMENTE</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input className="f" placeholder="https://…" value={manualUrl} onChange={e => setManualUrl(e.target.value)} style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === "Enter" && manualUrl.startsWith("http")) { setFoundUrls(p => [...p, { url: manualUrl, titulo: "", fecha: "" }]); setSelected(p => new Set([...p, foundUrls.length])); setManualUrl("") } }} />
                <button className="bb o" onClick={() => { if (manualUrl.startsWith("http")) { setFoundUrls(p => [...p, { url: manualUrl, titulo: "", fecha: "" }]); setSelected(p => new Set([...p, foundUrls.length])); setManualUrl("") } }}>+ Agregar</button>
              </div>
            </div>

            <button className="bb p" disabled={selected.size === 0 || loading} onClick={handleCharacterize}>
              ▶ Caracterizar {selected.size} artículos seleccionados
            </button>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {step === "processing" && (
          <div>
            <h1 style={{ marginBottom: "20px" }}>Caracterizando contenidos</h1>
            <div className="card" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                <span style={{ color: "#6e7681" }}>Analizando artículos con IA…</span>
                <span style={{ color: "#79c0ff", fontWeight: 500 }}>{progress.cur} / {progress.total}</span>
              </div>
              <div className="pt"><div className="pf" style={{ width: `${progress.total ? (progress.cur / progress.total) * 100 : 0}%` }} /></div>
            </div>
            <div className="card" style={{ maxHeight: "400px", overflowY: "auto" }}>
              {log.map((l, i) => (
                <div key={i} className="le" style={{ color: l.type === "ok" ? "#3fb950" : l.type === "error" ? "#f85149" : l.type === "warn" ? "#d29922" : "#6e7681" }}>{l.msg}</div>
              ))}
              {loading && <div className="le" style={{ color: "#388bfd" }}>⟳ procesando…</div>}
            </div>
            {!loading && results.length > 0 && (
              <button className="bb p" style={{ marginTop: "16px" }} onClick={() => setStep("results")}>Ver resultados →</button>
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {step === "results" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h1>Resultados</h1>
                <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>
                  <span style={{ color: "#3fb950" }}>✓ {okResults.length} caracterizados</span>
                  <span style={{ color: "#d29922" }}>⚡ {results.filter(r => r.estado === "excluido").length} excluidos</span>
                  <span style={{ color: "#f85149" }}>✗ {results.filter(r => r.estado === "error").length} errores</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="bb o" onClick={() => { setStep("config"); setResults([]); setFoundUrls([]); setLog([]) }}>Nueva búsqueda</button>
                <button className="bb p" onClick={exportCSV}>⬇ Exportar CSV</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Promedio val.", val: avg },
                { label: "Medio", val: medio?.nombre },
                { label: "Caso", val: filters.caso?.split(" ").pop() },
                { label: "OK / Total", val: `${okResults.length} / ${results.length}` },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#79c0ff", marginBottom: "2px" }}>{s.val}</div>
                  <div style={{ fontSize: "10px", color: "#6e7681", letterSpacing: ".08em" }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <div className="card">
              {okResults.map((r, i) => (
                <div key={i} className="rr">
                  {editingIdx === i ? (
                    <div style={{ background: "#161b22", borderRadius: "8px", padding: "14px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                        <div><label>TÍTULO</label><input className="f" value={r.titulo} onChange={e => upd(results.indexOf(r), "titulo", e.target.value)} /></div>
                        <div><label>FECHA</label><input type="date" className="f" value={r.fecha} onChange={e => upd(results.indexOf(r), "fecha", e.target.value)} /></div>
                        <div>
                          <label>TEMA</label>
                          <select className="f" value={r.tema} onChange={e => upd(results.indexOf(r), "tema", e.target.value)}>
                            {TEMAS.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label>VALORACIÓN</label>
                          <select className="f" value={r.valoracion} onChange={e => upd(results.indexOf(r), "valoracion", +e.target.value)}>
                            {VALORACIONES.map(v => <option key={v.val} value={v.val}>{v.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: "10px" }}>
                        <label>PALABRAS CLAVE</label>
                        <input className="f" value={r.palabras_clave} onChange={e => upd(results.indexOf(r), "palabras_clave", e.target.value)} />
                      </div>
                      <button className="bb p" style={{ fontSize: "11px", padding: "7px 16px" }} onClick={() => setEditingIdx(null)}>✓ Guardar</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                      <ValBadge val={r.valoracion} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#c9d1d9", marginBottom: "4px" }}>{r.titulo || "(sin título)"}</div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                          <span style={{ fontSize: "11px", background: "#0c1d3d", color: "#79c0ff", padding: "2px 7px", borderRadius: "3px" }}>{r.tema}</span>
                          {r.fecha && <span style={{ fontSize: "11px", color: "#6e7681" }}>{r.fecha}</span>}
                          {r.palabras_clave && <span style={{ fontSize: "11px", color: "#6e7681" }}>{r.palabras_clave}</span>}
                        </div>
                        {r.justificacion && <div style={{ fontSize: "11px", color: "#6e7681", fontStyle: "italic", marginBottom: "4px" }}>{r.justificacion}</div>}
                        <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: "10px" }}>{r.url}</a>
                      </div>
                      <button onClick={() => setEditingIdx(i)} style={{ background: "transparent", border: "1px solid #30363d", color: "#6e7681", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>✏</button>
                    </div>
                  )}
                </div>
              ))}

              {results.filter(r => r.estado === "excluido").length > 0 && (
                <details style={{ marginTop: "16px" }}>
                  <summary style={{ fontSize: "11px", color: "#6e7681", cursor: "pointer", padding: "8px 0" }}>
                    ⚡ {results.filter(r => r.estado === "excluido").length} excluidos (columnas de opinión)
                  </summary>
                  {results.filter(r => r.estado === "excluido").map((r, i) => (
                    <div key={i} style={{ fontSize: "11px", color: "#6e7681", padding: "4px 0 4px 16px" }}>
                      <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "#6e7681" }}>{r.titulo || r.url}</a>
                    </div>
                  ))}
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
