// Проверка ссылок на магазины в Системе (guide/gaidosen.html).
// node scripts/check-links.mjs [--json out.json] [--telegram]
// --telegram: отправить сводку в Telegram (env TG_TOKEN, TG_CHAT).
import fs from 'node:fs';
const file = new URL('../guide/gaidosen.html', import.meta.url);
const html = fs.readFileSync(file, 'utf8');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
// ссылка → какие образы её используют
const where = new Map();
const pgRe = /<div class="pg[^"]*"[^>]*id="([^"]+)"/g, linkRe = /<a class="(?:look-hotspot|look-link-chip)"[^>]*href="([^"]+)"[^>]*>([^<]*)/g;
let cur = '', last = 0;
const marks = [...html.matchAll(pgRe)].map(m => [m.index, m[1]]);
for (const m of html.matchAll(linkRe)) {
  while (last < marks.length && marks[last][0] < m.index) cur = marks[last++][1];
  const url = m[1].replace(/&amp;/g, '&');
  if (!/^https?:/.test(url)) continue;
  if (!where.has(url)) where.set(url, { pages: new Set(), label: '' });
  const w = where.get(url); w.pages.add(cur); if (m[2].trim()) w.label = m[2].trim();
}
const urls = [...where.keys()];
async function check(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*', 'accept-language': 'en-US,en;q=0.9,ru;q=0.8' } });
      clearTimeout(t);
      // «нет в наличии» по тексту страницы ненадёжно (бывает про один размер), поэтому не проверяем
      const soldOut = false; try { r.body && r.body.cancel(); } catch (e) {}
      const toHome = r.redirected && new URL(r.url).pathname.split('/').filter(Boolean).length <= 2 && new URL(url).pathname.split('/').filter(Boolean).length > 2;
      return { url, status: r.status, final: r.url, soldOut, toHome };
    } catch (e) { if (i) return { url, status: 0, error: String(e.name || e) }; }
  }
}
const out = []; let k = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (k < urls.length) { const u = urls[k++]; out.push(await check(u)); } }));
const kind = r => r.status === 404 || r.status === 410 ? 'dead' : r.toHome ? 'moved' : (r.status >= 200 && r.status < 400 ? (r.soldOut ? 'soldout' : 'ok') : 'blocked');
const groups = { dead: [], moved: [], soldout: [], blocked: [], ok: [] };
for (const r of out) groups[kind(r)].push({ ...r, ...where.get(r.url), pages: [...where.get(r.url).pages] });
const hosts = a => Object.entries(a.reduce((m, r) => (m[new URL(r.url).host] = (m[new URL(r.url).host] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
console.log(`Ссылок: ${urls.length} · работают ${groups.ok.length} · не найдены ${groups.dead.length} · увели в каталог ${groups.moved.length} · «нет в наличии» ${groups.soldout.length} · магазин не пустил робота ${groups.blocked.length}`);
console.log('не пустили (по сайтам):', hosts(groups.blocked).slice(0, 8).map(([h, n]) => `${h} ${n}`).join(', '));
for (const g of ['dead', 'moved', 'soldout']) for (const r of groups[g]) console.log(g.toUpperCase(), r.status, r.label, '|', r.pages.join(','), '|', r.url);
const ji = process.argv.indexOf('--json'); if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify(groups, null, 1));
if (process.argv.includes('--telegram') && process.env.TG_TOKEN) {
  const bad = [...groups.dead, ...groups.moved, ...groups.soldout];
  let text = `🔗 Проверка ссылок Системы: ${urls.length} ссылок.\nРаботают: ${groups.ok.length}. Проблемы: ${bad.length}.`;
  if (bad.length) text += '\n\n' + bad.slice(0, 30).map(r => `${r.status === 404 || r.status === 410 ? '❌' : r.toHome ? '↪️' : '🕳'} ${r.label || r.url} (${r.pages.join(', ')})`).join('\n');
  if (groups.blocked.length) text += `\n\nНе удалось проверить (магазин закрыт от роботов): ${groups.blocked.length}.`;
  await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TG_CHAT, text }) });
}
