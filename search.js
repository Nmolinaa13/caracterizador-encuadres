import { SEARCH_SYSTEM } from "../../lib/constants"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const { medio, caso, start, end, tema, maxResults } = req.body

  const temaQ = tema ? ` ${tema}` : " gestión gobierno decreto política"
  const msg = `Busca artículos periodísticos informativos sobre la gestión presidencial de ${caso} en ${medio.nombre} (site:${medio.domain}).

Período: ${start} al ${end}.${tema ? `\nTema preferido: ${tema}.` : ""}

Realiza al menos 3 búsquedas distintas con variaciones:
- "${caso}" site:${medio.domain}${temaQ}
- "${caso}" gobierno site:${medio.domain} decreto
- "${caso}" site:${medio.domain} política Colombia

Necesito ${maxResults} artículos informativos (noticias, reportajes). Excluye columnas de opinión.
Devuelve el JSON con los artículos. Si hay más de ${maxResults}, incluye solo los más relevantes.`

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
        max_tokens: 2000,
        system: SEARCH_SYSTEM,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: msg }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || "Error en API" })
    }

    const textBlock = data.content?.find(b => b.type === "text")
    if (!textBlock?.text) return res.json({ articulos: [] })

    try {
      const clean = textBlock.text.replace(/```json\n?|```\n?/g, "").trim()
      const parsed = JSON.parse(clean)
      return res.json({ articulos: (parsed.articulos || []).slice(0, maxResults) })
    } catch {
      const match = textBlock.text.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          return res.json({ articulos: (parsed.articulos || []).slice(0, maxResults) })
        } catch { /* fall through */ }
      }
      return res.json({ articulos: [] })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
