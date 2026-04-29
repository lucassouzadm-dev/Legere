// Proxy serverless para a API DJEN (Vercel)
// Usado como fallback quando a chamada direta do browser falhar.
export default async function handler(req, res) {
  const { oab, uf, inicio, fim } = req.query;
  if (!oab || !uf) return res.status(400).json({ error: 'Parâmetros obrigatórios: oab, uf' });

  const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroOab=${oab}&ufOab=${uf}&dataDisponibilizacaoInicio=${inicio}&dataDisponibilizacaoFim=${fim}&itensPorPagina=100&pagina=1`;

  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return res.status(r.status).json({ error: 'Erro na API DJEN' });
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
