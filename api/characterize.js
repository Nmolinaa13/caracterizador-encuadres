import { CHAR_SYSTEM } from "../../lib/constants"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const { url, titulo, caso } = req.body

  const msg = `Analiza este artículo periodístico y caracteriza su encuadre editorial sobre la gestión de ${caso}.

URL: ${url}
Título conocido: ${titulo || "(desconocido)"}

1. Usa web_search para buscar y leer el contenido completo de este artículo.
2. Analiza el tono, enfoque y postura editorial del medio.
3. Devuelve el JSON de caracterización.`

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: CHAR_SYSTEM,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: msg }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "Error en API" })
    }

    const textBlock = data.content?.find(b => b.type === "text")
    if (!textBlock?.text) return res.status(500).json({ error: "Sin respuesta" })

    try {
      const clean = textBlock.text.replace(/```json\n?|```\n?/g, "").trim()
      return res.json(JSON.parse(clean))
    } catch {
      const match = textBlock.text.match(/\{[\s\S]*\}/)
      if (match) {
        try { return res.json(JSON.parse(match[0])) } catch { /* fall through */ }
      }
      return res.status(500).json({ error: "No se pudo parsear respuesta" })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
