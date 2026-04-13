# Caracterizador de Encuadres Mediáticos
**Semillero CP&OP – Universidad EAFIT**

Herramienta para búsqueda y caracterización automática de contenidos periodísticos usando IA.

---

## Estructura del proyecto

```
caracterizador/
├── lib/
│   └── constants.js          # Constantes compartidas (medios, prompts, escalas)
├── pages/
│   ├── api/
│   │   ├── search.js         # Endpoint: busca artículos con web_search
│   │   └── characterize.js   # Endpoint: caracteriza un artículo con IA
│   └── index.js              # Interfaz principal
├── .env.local.example        # Plantilla de variables de entorno
├── .gitignore
├── next.config.js
└── package.json
```

---

## Pasos para publicar en Vercel

### 1. Instalar dependencias localmente (opcional, para probar antes)
```bash
npm install
cp .env.local.example .env.local
# Edita .env.local y pega tu API key de Anthropic
npm run dev
# Abre http://localhost:3000
```

### 2. Subir a GitHub
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/caracterizador-encuadres.git
git push -u origin main
```

### 3. Desplegar en Vercel
1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub
2. Clic en **"Add New Project"**
3. Selecciona el repositorio `caracterizador-encuadres`
4. En **"Environment Variables"** agrega:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-api03-XXXXXXXXXX` (tu API key real)
5. Clic en **"Deploy"**

Vercel detecta automáticamente que es un proyecto Next.js.

### 4. Obtener tu API key de Anthropic
1. Ve a [console.anthropic.com](https://console.anthropic.com)
2. Menú lateral → **API Keys** → **Create Key**
3. Copia la key (formato `sk-ant-api03-...`)
4. Pégala en la variable de entorno de Vercel

---

## Cómo funciona

1. **Búsqueda automática:** Seleccionas medio, caso presidencial y fechas. La herramienta usa Claude con `web_search` para encontrar artículos directamente en el medio seleccionado.
2. **Revisión:** Ves los artículos encontrados, puedes deseleccionar los que no aplican o agregar URLs manualmente.
3. **Caracterización:** Claude lee cada artículo y asigna valoración (1-7), tema, palabras clave y justificación. Las columnas de opinión se excluyen automáticamente.
4. **Exportar:** Descarga un CSV en el formato exacto de la hoja de caracterización del proyecto.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key de Anthropic (obligatoria) |
