// Loads the catalogue: from data/catalog.json, or from Supabase when config.js has its URL and key.
(function () {
  const cfg = window.SHOP_CONFIG;

  async function fromSupabase() {
    const h = { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` };
    const get = async (path) => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { headers: { ...h, Range: `${from}-${from + 999}` } });
        if (!r.ok) throw new Error(`Supabase ${path}: ${r.status}`);
        const page = await r.json();
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    };
    const [deps, groups, types, prods] = await Promise.all([
      get("departments?select=*&order=sort"), get("product_groups?select=*&order=sort"),
      get("product_types?select=*&order=sort"),
      get("products?select=sku,item_name,title,type_id,brand,material,colour,sizes,attrs,price_inr,mrp_inr,unit,needs_review&order=id"),
    ]);
    const tIndex = new Map();
    const outTypes = types.map((t, i) => {
      tIndex.set(t.id, i);
      const g = groups.find(x => x.id === t.group_id), d = deps.find(x => x.id === g.department_id);
      return { id: i, slug: t.slug, name: t.name, group: g.name, dept: d.name, filters: t.filters, count: 0 };
    });
    const items = prods.map(p => {
      const it = { sku: p.sku, n: p.title, raw: p.item_name, t: tIndex.get(p.type_id), b: p.brand, p: +p.price_inr || 0,
                   u: p.unit, a: p.attrs || {}, sz: p.sizes || [] };
      if (p.mrp_inr > p.price_inr) it.mrp = +p.mrp_inr;
      if (p.material) it.m = p.material;
      if (p.colour) it.c = p.colour;
      if (p.needs_review) it.rv = 1;
      outTypes[it.t].count++;
      return it;
    });
    const depts = deps.map(d => ({
      name: d.name, ta: d.name_ta, slug: d.slug,
      groups: groups.filter(g => g.department_id === d.id).map(g => ({
        name: g.name, slug: g.slug, types: types.filter(t => t.group_id === g.id).map(t => tIndex.get(t.id)),
      })),
    }));
    const local = await fetch("data/catalog.json").then(r => r.json()).catch(() => ({}));
    return { depts, types: outTypes, items, colours: local.colours || {} };
  }

  async function placeOrder(order) {
    if (!cfg.supabaseUrl) return null;
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/place_order`, {
      method: "POST",
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  window.ShopData = {
    load: () => (cfg.supabaseUrl ? fromSupabase() : fetch("data/catalog.json").then(r => r.json())),
    placeOrder,
  };
})();
