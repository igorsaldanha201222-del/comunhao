// Gera o app dos membros para o navegador e coloca em apps/web/public/app (servido em /app).
// Uso: node scripts/build-app-web.mjs   (lê .env.supabase.local e apps/web/.env.local)
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = (file) => existsSync(join(root, file))
  ? Object.fromEntries(readFileSync(join(root, file), "utf8").split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]))
  : {};
const sb = env(".env.supabase.local");
const web = env("apps/web/.env.local");
const vars = {
  EXPO_PUBLIC_SUPABASE_URL: sb.SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb.SUPABASE_ANON_KEY,
  EXPO_PUBLIC_VAPID_PUBLIC_KEY: web.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
};
for (const [k, v] of Object.entries(vars)) if (!v) throw new Error(`Falta ${k}`);

const out = join(root, "apps/mobile/dist-web");
rmSync(out, { recursive: true, force: true });
execSync(`npx expo export -p web --output-dir "${out}" --clear`, { cwd: join(root, "apps/mobile"), stdio: "inherit", env: { ...process.env, ...vars } });

// Cabeçalho do app instalável (Android e iPhone)
const index = join(out, "index.html");
let html = readFileSync(index, "utf8")
  .replace('<html lang="en">', '<html lang="pt-BR">')
  .replace("</head>", [
    '<link rel="manifest" href="/app/manifest.webmanifest">',
    '<meta name="theme-color" content="#4f46e5">',
    '<link rel="apple-touch-icon" href="/app/apple-touch-icon.png">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Comunhão">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    "</head>",
  ].join("\n"))
  .replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"', 'content="width=device-width, initial-scale=1, viewport-fit=cover"');
writeFileSync(index, html);

const dest = join(root, "apps/web/public/app");
rmSync(dest, { recursive: true, force: true });
cpSync(out, dest, { recursive: true });
rmSync(out, { recursive: true, force: true });
console.log("App web pronto em apps/web/public/app");
