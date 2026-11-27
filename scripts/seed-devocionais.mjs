// Devocionais de exemplo (últimos dias + hoje + amanhã agendado). Versículos da Bíblia Livre.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const SB_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };

const { id: cid } = ok(await admin.from("churches").select("id").eq("slug", "gileade").single());
if (ok(await admin.from("devotionals").select("id").eq("church_id", cid).limit(1)).length) {
  console.log("Devocionais já existem — nada a fazer.");
  process.exit(0);
}
const verse = (book, ch, v) =>
  JSON.parse(readFileSync(new URL(`../apps/web/public/biblia/blivre/${book}.json`, import.meta.url), "utf8"))[ch - 1][v - 1].replace(/[[\]]/g, "");
const day = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const author = "Pr. Marcos Sérgio";

const items = [
  [-5, "Ele cuida de cada detalhe", "Salmos 23:1", ["sl", 23, 1],
    "Davi conhecia bem o trabalho de um pastor: guiar, proteger, buscar a ovelha que se perde. Quando ele diz que o Senhor é o seu pastor, está dizendo que não caminha sozinho.\n\nTalvez hoje você esteja olhando para o que falta. A promessa não é que nunca haverá vale, mas que no vale haverá companhia. Quem é guiado pelo Bom Pastor descobre que o necessário não falta.",
    "Senhor, obrigado por cuidar de mim. Ensina-me a confiar quando eu não entendo o caminho. Amém."],
  [-4, "Amor que dá o melhor", "João 3:16", ["joa", 3, 16],
    "O versículo mais conhecido da Bíblia começa com uma palavra simples: \"Porque\". Tudo o que Deus fez tem um motivo — o amor.\n\nEsse amor não ficou só no sentimento: ele deu. E deu o que tinha de mais precioso. Hoje, pense em alguém que precisa ver esse amor em atitudes, não só em palavras.",
    "Pai, obrigado pelo teu Filho. Que o teu amor transborde em mim para as pessoas ao meu redor. Amém."],
  [-3, "Força para hoje", "Isaías 40:31", ["is", 40, 31],
    "O cansaço chega para todos — jovens e experientes. Isaías não promete uma vida sem cansaço, mas uma fonte de força renovada para quem espera no Senhor.\n\nEsperar não é ficar parado; é depender. Antes de correr para as tarefas de hoje, pare um minuto e entregue o seu dia a Deus.",
    "Senhor, renova as minhas forças. Eu espero em ti. Amém."],
  [-2, "Nada nos separa", "Romanos 8:38-39", ["rm", 8, 38],
    "Paulo faz uma lista de tudo o que poderia nos afastar de Deus: morte, vida, anjos, presente, futuro… e conclui que nada disso tem esse poder.\n\nSe você se sente distante, lembre: o amor de Deus em Cristo não depende do seu desempenho de hoje. Volte para casa — a porta está aberta.",
    "Obrigado, Deus, porque o teu amor me segura mesmo quando eu falho. Amém."],
  [-1, "Confiança de verdade", "Provérbios 3:5", ["pv", 3, 5],
    "Confiar \"de todo o coração\" é diferente de confiar só quando dá certo. Salomão nos convida a não nos apoiarmos apenas no nosso próprio entendimento.\n\nQual decisão você está tentando resolver sozinho? Apresente a Deus hoje, peça conselho a alguém maduro na fé e dê um passo de obediência.",
    "Senhor, eu quero confiar em ti de todo o coração. Endireita os meus caminhos. Amém."],
  [0, "Coragem que vem de Deus", "Josué 1:9", ["js", 1, 9],
    "Josué recebeu uma missão maior do que ele. Moisés tinha partido, o povo era numeroso e a terra, cheia de desafios. A ordem de Deus foi clara: seja forte e corajoso.\n\nA coragem de Josué não vinha da sua capacidade, mas da presença de Deus: \"o SENHOR teu Deus é contigo por onde quer que andares\". Qual é o seu desafio desta semana? Você não vai enfrentá-lo sozinho.",
    "Senhor, eu recebo a tua palavra de coragem. Vai comigo nesta semana. Amém."],
  [1, "Alegria que não depende das circunstâncias", "Filipenses 4:4", ["fp", 4, 4],
    "Paulo escreveu sobre alegria enquanto estava preso. A alegria cristã não nega a dor; ela encontra em Cristo um motivo maior.\n\nHoje, faça uma lista de três motivos para agradecer a Deus — e compartilhe um deles com alguém.",
    "Pai, enche o meu coração da tua alegria, mesmo nos dias difíceis. Amém."],
];

const rows = items.map(([d, title, ref, [b, c, v], body, prayer]) => ({
  church_id: cid, publish_on: day(d), title, verse_ref: ref, verse_text: verse(b, c, v), body, prayer, author, published: true,
}));
ok(await admin.from("devotionals").insert(rows));
console.log(`Devocionais de exemplo: ${rows.length} (o último agendado para amanhã).`);
