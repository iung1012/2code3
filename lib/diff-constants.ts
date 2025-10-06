// Constantes para o sistema de diff/patch baseado no DeepSite
export const SEARCH_START = "<<<<<<< SEARCH";
export const DIVIDER = "=======";
export const REPLACE_END = ">>>>>>> REPLACE";

// HTML padrão para comparação (similar ao DeepSite)
export const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Website</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
</body>
</html>`;

// Função para normalizar HTML para comparação
export const normalizeHtml = (html: string): string => {
  return html
    .replace(/<!--[\s\S]*?-->/g, "") // Remove comentários
    .replace(/\s+/g, " ") // Normaliza espaços
    .trim();
};

// Função para detectar se é HTML padrão
export const isDefaultHtml = (html: string): boolean => {
  return normalizeHtml(DEFAULT_HTML) === normalizeHtml(html);
};
