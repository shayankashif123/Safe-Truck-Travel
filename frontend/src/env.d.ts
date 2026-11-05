interface ImportMetaEnv {
  /** Backend origin in production, e.g. https://api.example.com. Empty in dev (Vite proxy). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
