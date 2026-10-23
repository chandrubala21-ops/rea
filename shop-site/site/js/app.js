// Shop front end: menu, listings with filters, search, product page, quick order, basket.
// Plain JavaScript, no build step. Pages are addressed by the part of the URL after '#'.
(function () {
  const CFG = window.SHOP_CONFIG;
  const GST_RATE = CFG.gstRate || 18;
  const $ = (s, el = document) => el.querySelector(s);
  const main = $("#main");

  // ---------- small helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sa_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sa_" + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const inr = n => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const state = { lang: store.get("lang", "en"), exGst: store.get("exgst", false), basket: store.get("basket", []), open: {}, more: {} };
  const showPrice = p => state.exGst ? Math.round(p / (1 + GST_RATE / 100) * 100) / 100 : p;

  // ---------- words (English / Tamil) ----------
  const T = {
    en: {
      help: "Help & contact", incGst: "inc GST", exGst: "ex GST", quickOrder: "Quick order", account: "Account", store: "Our shop",
      basket: "Basket", search: "Search 8,000+ items, e.g. 3x4 UPVC elbow", home: "Home", filters: "Filters", applied: "applied",
      clearAll: "Clear all", viewAll: "View all", showLess: "Show less", sortBy: "Sort by", perPage: "Results per page:", all: "All",
      rec: "Recommended", priceHi: "Price high - low", priceLo: "Price low - high", brandAz: "Brand A - Z", brandZa: "Brand Z - A",
      products: "products", addBasket: "Add to basket", whatsapp: "Ask on WhatsApp", collect: "Collect", deliver: "Deliver",
      checkStock: "Check stock at our shop", askPrice: "Ask for price", readMore: "Read more", readLess: "Read less",
      filter: "Filter", apply: "Show results", price: "Price", go: "Go", added: "Added to basket", viewBasket: "View basket",
      noResults: "No items match. Try fewer filters or another spelling.", categories: "Categories", per: "per",
      shopDepts: "Shop by department", topBrands: "Top brands", code: "Item code",
    },
    ta: {
      help: "உதவி & தொடர்பு", incGst: "GST உட்பட", exGst: "GST இல்லாமல்", quickOrder: "விரைவு ஆர்டர்", account: "கணக்கு", store: "எங்கள் கடை",
      basket: "கூடை", search: "8,000+ பொருட்களைத் தேடுங்கள், உ.தா. 3x4 UPVC elbow", home: "முகப்பு", filters: "வடிகட்டிகள்", applied: "தேர்வு",
      clearAll: "அனைத்தையும் நீக்கு", viewAll: "அனைத்தும் காண்க", showLess: "குறைவாக", sortBy: "வரிசைப்படுத்து", perPage: "ஒரு பக்கத்தில்:", all: "அனைத்தும்",
      rec: "பரிந்துரை", priceHi: "விலை அதிகம் - குறைவு", priceLo: "விலை குறைவு - அதிகம்", brandAz: "பிராண்ட் A - Z", brandZa: "பிராண்ட் Z - A",
      products: "பொருட்கள்", addBasket: "கூடையில் சேர்", whatsapp: "WhatsApp-ல் கேளுங்கள்", collect: "கடையில் பெறுக", deliver: "டெலிவரி",
      checkStock: "கடையில் இருப்பு உள்ளதா?", askPrice: "விலைக்கு கேளுங்கள்", readMore: "மேலும் படிக்க", readLess: "குறைவாக",
      filter: "வடிகட்டு", apply: "முடிவுகளைக் காண்க", price: "விலை", go: "செல்", added: "கூடையில் சேர்க்கப்பட்டது", viewBasket: "கூடையைப் பார்",
      noResults: "பொருட்கள் இல்லை. குறைவான வடிகட்டிகளை முயற்சிக்கவும்.", categories: "வகைகள்", per: "ஒரு",
      shopDepts: "துறை வாரியாக வாங்குங்கள்", topBrands: "முன்னணி பிராண்டுகள்", code: "பொருள் குறியீடு",
    },
  };
  const t = k => (T[state.lang] && T[state.lang][k]) || T.en[k] || k;

  // ---------- department pictures (used until real photos exist) ----------
  const ICON = {
    "Electrical": ["#fff4d6", '<path d="M13 2L4 14h7l-2 8 9-12h-7z" fill="#e0a100"/>'],
    "Appliances": ["#e6f2ff", '<circle cx="12" cy="12" r="2" fill="#0e4c88"/><path d="M12 10c0-5 4-7 6-5s-2 5-6 5zm0 4c0 5-4 7-6 5s2-5 6-5zm-2-2c-5 0-7-4-5-6s5 2 5 6zm4 0c5 0 7 4 5 6s-5-2-5-6z" fill="#0e4c88"/>'],
    "Plumbing": ["#e3f4fb", '<path d="M3 9h7V6h4v3h1a4 4 0 0 1 4 4v2h-4v-2h-1v3h-4v-3H3z" fill="#1479b8"/><path d="M17 18c0 1.5 1 2.5 1 3a1 1 0 0 1-2 0c0-.5 1-1.5 1-3z" fill="#1479b8"/>'],
    "Paint": ["#fde8ec", '<rect x="4" y="3" width="13" height="6" rx="1.5" fill="#d0344d"/><path d="M17 6h2v5h-7v3" fill="none" stroke="#7a2232" stroke-width="2"/><rect x="10.5" y="14" width="3" height="7" rx="1" fill="#7a2232"/>'],
    "Tools": ["#ececf3", '<path d="M14.7 6.3a4 4 0 0 0-5.4 5l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5-5.4l-2.5 2.5-2.1-.6-.6-2.1z" fill="#4b5563"/>'],
    "Hardware & Fixings": ["#eef0e6", '<path d="M8 3h8l4 7-4 7H8L4 10z" fill="none" stroke="#5b6236" stroke-width="2"/><circle cx="12" cy="10" r="2.6" fill="#5b6236"/><path d="M11 17h2v5h-2z" fill="#5b6236"/>'],
    "Motors & Pumps": ["#e8f5ee", '<circle cx="12" cy="12" r="7" fill="none" stroke="#1d7a4a" stroke-width="2.4"/><path d="M12 5v14M5 12h14" stroke="#1d7a4a" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="#1d7a4a"/>'],
    "Agri & Borewell": ["#eef7e3", '<path d="M12 21V11M12 11c0-4 3-7 8-7 0 5-3 8-8 7zm0 3c0-3-2-6-7-6 0 4 3 6 7 6z" fill="#4c8a1f" stroke="#4c8a1f" stroke-width="1.5"/>'],
    "Safety": ["#fff1e0", '<path d="M4 16a8 8 0 0 1 16 0z" fill="#e57c00"/><rect x="2" y="16" width="20" height="3" rx="1.5" fill="#b35f00"/><path d="M12 8v4" stroke="#fff" stroke-width="2"/>'],
  };
  const pic = (dept, cls = "img") => {
    const [bg, path] = ICON[dept] || ["#eee", ""];
    return `<div class="${cls}" style="background:${bg}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg></div>`;
  };

  // ---------- catalogue ----------
  let CAT, ITEMS, BY_SKU, TYPES, DEPTS;
  const MATERIAL_WORDS = new Set(["pvc", "upvc", "cpvc", "gi", "ss", "ms", "ci", "cp", "swr", "hdpe"]);
  const SYN = { coupling: ["coupler"], coupler: ["coupling"], tap: ["cock"], cock: ["tap"], bulb: ["lamp"], lamp: ["bulb"],
                ballvalve: ["ball valve"], reducer: [" r ", "reducing"], reducing: ["reducer", " r "], wire: ["cable"], cable: ["wire"], geyser: ["water heater"], heater: ["geyser"] };

  function prepare(cat) {
    CAT = cat; TYPES = cat.types; DEPTS = cat.depts; ITEMS = cat.items; BY_SKU = new Map();
    const groupSlug = {};
    for (const d of DEPTS) for (const g of d.groups) for (const tid of g.types) groupSlug[tid] = g.slug;
    for (const it of ITEMS) {
      const ty = TYPES[it.t];
      it.type = ty; it.dept = ty.dept; it.group = ty.group; it.gslug = groupSlug[it.t];
      it.title = it.b !== "Unbranded" && !it.n.toLowerCase().includes(it.b.toLowerCase().split("/")[0]) ? `${it.b} ${it.n}` : it.n;
      it.hay = " " + [it.n, it.raw, it.b, ty.name, ty.group, ty.dept, it.m || "", ...Object.values(it.a)].join(" ").toLowerCase().replace(/[^a-z0-9.஀-௿]+/g, " ") + " ";
      it.hayc = it.hay.replace(/ /g, "");
      it.sv = Sizes.value(it.a["Size (inch)"] || it.a["Size (mm)"] || "");
      BY_SKU.set(it.sku, it);
    }
  }

  function matchWord(it, w) {
    if (MATERIAL_WORDS.has(w)) return it.hay.includes(" " + w + " ") || (it.m || "").toLowerCase() === w;
    if (/^\d+$/.test(w)) return new RegExp(`(^|[^\\d.])${w}(?![\\d])`).test(it.hay);
    if (it.hay.includes(w) || it.hayc.includes(w)) return true;
    if (w.length > 3 && w.endsWith("s") && it.hay.includes(w.slice(0, -1))) return true;
    return (SYN[w] || []).some(s => it.hay.includes(s));
  }

  function search(q) {
    const { sizes, words } = Sizes.parse(q);
    if (!sizes.length && !words.length) return { items: [], sizes };
    const out = [];
    for (const it of ITEMS) {
      if (sizes.length && !sizes.every(s => it.sz.includes(s))) continue;
      if (!words.every(w => matchWord(it, w))) continue;
      let score = 0;
      const title = " " + it.n.toLowerCase() + " ";
      for (const w of words) {
        if (title.includes(" " + w)) score += 3;
        if (it.type.name.toLowerCase().includes(w)) score += 2;
      }
      if (sizes.length && it.sz[0] === sizes[0]) score += 4;
      if (it.p > 0) score += 1;
      out.push([score, it]);
    }
    out.sort((a, b) => b[0] - a[0] || a[1].sv - b[1].sv || a[1].n.localeCompare(b[1].n));
    return { items: out.map(x => x[1]), sizes };
  }

  // ---------- basket ----------
  function saveBasket() {
    store.set("basket", state.basket);
    const n = state.basket.reduce((s, l) => s + 1, 0);
    $("#basket-count").textContent = n;
  }
  function addToBasket(sku, qty, f = "collect", quiet = false) {
    const l = state.basket.find(x => x.sku === sku);
    if (l) { l.qty += qty; l.f = f; } else state.basket.push({ sku, qty, f });
    saveBasket();
    if (!quiet) toast(`${t("added")} (${qty}) <a href="#/basket">${t("viewBasket")}</a>`);
  }
  let toastTimer;
  function toast(html) {
    const el = $("#toast"); el.innerHTML = html; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  const waLink = text => CFG.whatsapp ? `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(text)}` : `#/store`;

  // ---------- shell: header, menu, promise strip, footer ----------
  function renderShell() {
    document.documentElement.lang = state.lang;
    $("#logo-name").textContent = state.lang === "ta" && CFG.nameTa ? CFG.nameTa : CFG.name;
    $("#logo-tag").textContent = CFG.tagline;
    $("#hours").textContent = CFG.hours ? "· " + CFG.hours : "";
    $("#lang-btn").textContent = state.lang === "en" ? "தமிழ்" : "English";
    $("#search-input").placeholder = t("search");
    $("#gst-toggle").checked = state.exGst;
    document.querySelectorAll("[data-t]").forEach(el => { el.textContent = t(el.dataset.t); });
    $("#nav-list").innerHTML = DEPTS.map(d =>
      `<li><a href="#/d/${d.slug}" data-dept="${d.slug}" aria-haspopup="true">${esc(state.lang === "ta" ? d.ta : d.name)}</a></li>`).join("");
    $("#promise").innerHTML = CFG.promises.map((p, i) =>
      `<a href="${i === 2 ? "#/quick-order" : "#/help"}"><b>${esc(p.strong)}</b>${esc(p.text)}</a>`).join("") +
      `<a href="${waLink("Hello, I have a question")}"><b>WHATSAPP US</b>for prices &amp; stock</a>`;
    $("#promo").innerHTML = `Building or repairing? Order all your pipe fittings in one go by size <span class="cta">${t("quickOrder")} →</span>`;
    $("#footer").innerHTML = `
      <div><h4>${esc(CFG.name)}</h4><p>${esc(CFG.tagline)}</p>${CFG.address ? `<p>${esc(CFG.address)}</p>` : ""}${CFG.phone ? `<p>${esc(CFG.phone)}</p>` : ""}</div>
      <div><h4>${t("shopDepts")}</h4>${DEPTS.map(d => `<a href="#/d/${d.slug}">${esc(d.name)}</a>`).join("")}</div>
      <div><h4>${t("help")}</h4><a href="#/quick-order">${t("quickOrder")}</a><a href="#/help">How to search by size</a><a href="#/store">${t("store")}</a><a href="#/basket">${t("basket")}</a></div>`;
    saveBasket();
  }

  function megaHtml(d) {
    const groups = [...d.groups].sort((a, b) => (a.name === "Other") - (b.name === "Other"));
    return `<button class="mega-close" type="button">‹ ${esc(d.name)}</button><div class="wrap mega-in" style="--cols:${Math.min(groups.length, 7)}">` + groups.map(g => `
      <div><h3><a href="#/g/${g.slug}">${esc(g.name)}</a></h3><ul>
        ${g.types.map(id => TYPES[id]).filter(ty => ty.count).map(ty => `<li><a href="#/c/${ty.slug}">${esc(ty.name)}</a></li>`).join("")}
      </ul><a class="viewall" href="#/g/${g.slug}">${t("viewAll")}</a></div>`).join("") + `</div>`;
  }

  function wireMenu() {
    const nav = $("#nav"), mega = $("#mega"), list = $("#nav-list");
    let timer, current = null;
    const open = slug => {
      const d = DEPTS.find(x => x.slug === slug); if (!d) return;
      current = slug; mega.innerHTML = megaHtml(d); mega.hidden = false;
      list.querySelectorAll("a").forEach(a => a.classList.toggle("open", a.dataset.dept === slug));
    };
    const close = () => { current = null; mega.hidden = true; list.querySelectorAll("a.open").forEach(a => a.classList.remove("open")); };
    const isPhone = () => matchMedia("(max-width: 860px)").matches;
    list.addEventListener("mouseover", e => {
      const a = e.target.closest("a[data-dept]"); if (!a || isPhone()) return;
      clearTimeout(timer); timer = setTimeout(() => open(a.dataset.dept), current ? 0 : 120);
    });
    nav.addEventListener("mouseleave", () => { clearTimeout(timer); if (!isPhone()) timer = setTimeout(close, 150); });
    mega.addEventListener("mouseenter", () => clearTimeout(timer));
    list.addEventListener("click", e => {
      const a = e.target.closest("a[data-dept]"); if (!a) return;
      // touch screens and phones: first tap opens the menu, the "View all" links go to the pages
      if (isPhone() || current !== a.dataset.dept && matchMedia("(hover: none)").matches) { e.preventDefault(); open(a.dataset.dept); }
    });
    list.addEventListener("keydown", e => {
      const a = e.target.closest("a[data-dept]");
      if (a && e.key === "ArrowDown") { e.preventDefault(); open(a.dataset.dept); mega.querySelector("a")?.focus(); }
    });
    mega.addEventListener("click", e => {
      if (e.target.closest(".mega-close")) { close(); return; }
      if (e.target.closest("a")) { close(); nav.classList.remove("open"); }
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") { close(); nav.classList.remove("open"); } });
    $("#menu-btn").addEventListener("click", () => {
      const o = nav.classList.toggle("open"); $("#menu-btn").setAttribute("aria-expanded", o); if (!o) close();
    });
    window.addEventListener("hashchange", () => { close(); nav.classList.remove("open"); });
  }

  // ---------- search box with suggestions ----------
  function wireSearch() {
    const form = $("#search-form"), input = $("#search-input"), box = $("#suggest");
    form.addEventListener("submit", e => {
      e.preventDefault(); const q = input.value.trim(); if (!q) return;
      box.hidden = true; location.hash = "#/search?q=" + encodeURIComponent(q);
    });
    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q.length < 2) { box.hidden = true; return; }
      const { items, sizes } = search(q);
      const types = new Map();
      for (const it of items) types.set(it.t, (types.get(it.t) || 0) + 1);
      const hint = sizes.length ? `<div class="hint">Size: ${sizes.map(Sizes.label).join(" × ")}</div>` : "";
      const tl = [...types].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) =>
        `<a href="#/search?q=${encodeURIComponent(q)}&f=${encodeURIComponent("Product Type~" + TYPES[id].name)}"><span>${esc(q)} in <b>${esc(TYPES[id].name)}</b></span><small>${n}</small></a>`).join("");
      const il = items.slice(0, 5).map(it => `<a href="#/p/${it.sku}"><span>${esc(it.title)}</span><small>${it.p ? inr(showPrice(it.p)) : ""}</small></a>`).join("");
      box.innerHTML = hint + (tl + il || `<div class="hint">No matches yet</div>`);
      box.hidden = false;
    });
    input.addEventListener("blur", () => setTimeout(() => { box.hidden = true; }, 200));
    box.addEventListener("click", () => { box.hidden = true; });
  }

  // ---------- routing ----------
  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = h.split("?");
    const params = new URLSearchParams(qs || "");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const [view, key] = parts;
    const keepScroll = sessionStorage.getItem("keepScroll") === "1";
    sessionStorage.removeItem("keepScroll");
    const y = scrollY;
    try {
      if (!view) home();
      else if (view === "d") deptPage(key);
      else if (view === "g") groupPage(key, params);
      else if (view === "c") typePage(key, params);
      else if (view === "search") searchPage(params);
      else if (view === "p") productPage(key);
      else if (view === "quick-order") quickOrder(params);
      else if (view === "basket") basketPage();
      else if (view === "store" || view === "help" || view === "account") infoPage(view);
      else notFound();
    } catch (err) { console.error(err); main.innerHTML = `<div class="empty">Something went wrong: ${esc(err.message)}</div>`; }
    if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
    $("#search-input").value = view === "search" ? params.get("q") || "" : "";
  }
  const go = (hash, keep) => { if (keep) sessionStorage.setItem("keepScroll", "1"); location.hash = hash; };
  const setTitle = s => { document.title = s ? `${s} | ${CFG.name}` : CFG.name; };
  const notFound = () => { main.innerHTML = `<div class="empty"><h1>Page not found</h1><p><a href="#/">${t("home")}</a></p></div>`; };

  const HOME_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z" fill="currentColor"/></svg>';
  const crumbs = list => `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/" aria-label="${t("home")}">${HOME_ICON}</a>` +
    list.map(([label, href]) => `<span class="sep">›</span>` + (href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)).join("") + `</nav>`;

  // ---------- home ----------
  function home() {
    setTitle("");
    const brands = {};
    for (const it of ITEMS) if (it.b !== "Unbranded") brands[it.b] = (brands[it.b] || 0) + 1;
    const top = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 18);
    main.innerHTML = `
      <section class="hero">
        <div class="hero-main">
          <h2>Everything for the job,<br>ready at the counter</h2>
          <p>${ITEMS.length.toLocaleString("en-IN")} items in electrical, plumbing, paint, tools, motors and pumps. Reserve online, collect in the shop or get it delivered.</p>
          <a class="btn btn-amber" href="#/d/plumbing">Shop plumbing</a> <a class="btn btn-amber" href="#/d/electrical">Shop electrical</a>
        </div>
        <div class="hero-side">
          <h2>${t("quickOrder")}</h2>
          <p>Pick a material and a size, see every fitting, pipe and valve in that size, and type the quantities.</p>
          <form id="hero-qo"><input name="q" placeholder="e.g. UPVC 3x4 or PVC 11/2" aria-label="Material and size"><button class="btn btn-primary">Go</button></form>
        </div>
      </section>
      <h2 class="sec-title">${t("shopDepts")}</h2>
      <div class="tiles">${DEPTS.map(d => {
        const n = d.groups.reduce((s, g) => s + g.types.reduce((a, id) => a + TYPES[id].count, 0), 0);
        return `<a class="tile" href="#/d/${d.slug}">${pic(d.name, "ic")}<b>${esc(state.lang === "ta" ? d.ta : d.name)}</b><small>${n.toLocaleString("en-IN")} ${t("products")}</small></a>`;
      }).join("")}</div>
      <h2 class="sec-title">${t("topBrands")}</h2>
      <div class="brands">${top.map(([b]) => `<a href="#/search?q=${encodeURIComponent(b)}">${esc(b)}</a>`).join("")}</div>`;
    $("#hero-qo").addEventListener("submit", e => {
      e.preventDefault();
      const q = e.target.q.value, { sizes, words } = Sizes.parse(q);
      const mat = MATS().find(m => words.some(w => m.toLowerCase().startsWith(w)));
      const p = new URLSearchParams(); if (mat) p.set("mat", mat); if (sizes[0]) p.set("size", sizes[0]);
      go("#/quick-order?" + p);
    });
  }

  // ---------- department page ----------
  function deptPage(slug) {
    const d = DEPTS.find(x => x.slug === slug); if (!d) return notFound();
    setTitle(d.name);
    main.innerHTML = crumbs([[d.name]]) + `<h1>${esc(state.lang === "ta" ? d.ta : d.name)}</h1>
      <div class="dept-groups">${d.groups.map(g => {
        const n = g.types.reduce((a, id) => a + TYPES[id].count, 0);
        return `<div class="dept-group"><h2><a href="#/g/${g.slug}">${esc(g.name)}</a></h2><ul>${g.types.map(id => TYPES[id]).filter(x => x.count)
          .map(x => `<li><a href="#/c/${x.slug}"><span>${esc(x.name)}</span><small>${x.count}</small></a></li>`).join("")}</ul>
          <a class="viewall" href="#/g/${g.slug}">${t("viewAll")} (${n})</a></div>`;
      }).join("")}</div>`;
  }

  // ---------- listings: type page, group page, search ----------
  const PRICE_BANDS = [["Under ₹100", 0, 100], ["₹100 - ₹500", 100, 500], ["₹500 - ₹2,000", 500, 2000], ["₹2,000 - ₹10,000", 2000, 10000], ["Over ₹10,000", 10000, Infinity]];
  function facetValue(it, key) {
    switch (key) {
      case "Brand": return it.b;
      case "Product Type": return it.type.name;
      case "Department": return it.dept;
      case "Material": return it.m || it.a.Material;
      case "Size": return it.a["Size (inch)"] || it.a["Size (mm)"];
      case "Colour": return it.c;
      case "Price": {
        if (!it.p) return t("askPrice");
        const p = showPrice(it.p); return (PRICE_BANDS.find(b => p >= b[1] && p < b[2]) || [])[0];
      }
      default: return it.a[key];
    }
  }
  const isSizeKey = k => /size|sweep|length|capacity|power|wattage|current|disc|bore|width/i.test(k) && k !== "Pack size" || k === "Size";

  function listing(o) {
    const { params, base } = o;
    const sel = {};
    for (const f of params.getAll("f")) { const i = f.indexOf("~"); (sel[f.slice(0, i)] ||= new Set()).add(f.slice(i + 1)); }
    const pmin = params.get("pmin") ? +params.get("pmin") : null, pmax = params.get("pmax") ? +params.get("pmax") : null;
    const keys = [...o.keys.filter(k => o.items.some(it => facetValue(it, k))), "Price"];
    const passes = (it, skip) => {
      for (const k in sel) if (k !== skip && !sel[k].has(facetValue(it, k))) return false;
      if (skip !== "Price" && (pmin != null || pmax != null)) {
        if (!it.p) return false;
        const p = showPrice(it.p); if (pmin != null && p < pmin || pmax != null && p > pmax) return false;
      }
      return true;
    };
    let items = o.items.filter(it => passes(it));
    const sort = params.get("sort") || "rec";
    const byPrice = dir => (a, b) => (!a.p) - (!b.p) || dir * (a.p - b.p);
    const sorters = { "price-desc": byPrice(-1), "price-asc": byPrice(1), "brand-az": (a, b) => a.b.localeCompare(b.b) || a.sv - b.sv,
                      "brand-za": (a, b) => b.b.localeCompare(a.b) || a.sv - b.sv };
    if (sorters[sort]) items = [...items].sort(sorters[sort]);
    const pp = params.get("pp") === "all" ? Infinity : 20;
    const pages = Math.max(1, Math.ceil(items.length / pp));
    const page = Math.min(pages, Math.max(1, +params.get("page") || 1));
    const shown = pp === Infinity ? items : items.slice((page - 1) * pp, page * pp);
    const nSel = Object.values(sel).reduce((s, v) => s + v.size, 0) + (pmin != null || pmax != null ? 1 : 0);

    const link = mod => {
      const p = new URLSearchParams(params); mod(p);
      const s = p.toString(); return base + (s ? "?" + s : "");
    };
    const facets = keys.map((k, i) => {
      const counts = new Map();
      for (const it of o.items) if (passes(it, k)) { const v = facetValue(it, k); if (v) counts.set(v, (counts.get(v) || 0) + 1); }
      for (const v of sel[k] || []) if (!counts.has(v)) counts.set(v, 0);
      let vals = [...counts];
      if (k === "Price") vals.sort((a, b) => { const ia = PRICE_BANDS.findIndex(x => x[0] === a[0]), ib = PRICE_BANDS.findIndex(x => x[0] === b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      else if (isSizeKey(k)) vals.sort((a, b) => Sizes.value(a[0]) - Sizes.value(b[0]) || String(a[0]).localeCompare(b[0]));
      else if (k === "Brand") vals.sort((a, b) => (a[0] === "Unbranded") - (b[0] === "Unbranded") || a[0].localeCompare(b[0]));
      else vals.sort((a, b) => b[1] - a[1]);
      if (!vals.length && k !== "Price") return "";
      const id = base + "|" + k;
      const open = state.open[id] ?? (i < 3 || k === "Brand" || !!sel[k] || k === "Price" && nSel > 0);
      const limit = k === "Brand" && !state.more[id] ? 6 : 40;
      const showAll = state.more[id] || vals.length <= limit;
      const list = showAll ? vals : vals.slice(0, limit);
      const opts = list.map(([v, n]) => {
        const sw = k === "Colour" || /colour/i.test(k) ? `<span class="swatch" style="background:${CAT.colours[v] || "#ddd"}"></span>` : "";
        return `<li><label><input type="checkbox" data-f="${esc(k)}~${esc(v)}" ${sel[k]?.has(v) ? "checked" : ""}>${sw}<span>${esc(v)} <span class="c">(${n})</span></span></label></li>`;
      }).join("");
      const more = vals.length > limit || state.more[id] ? `<li class="more"><button type="button" class="linkbtn" data-more="${esc(id)}">${state.more[id] ? t("showLess") : `${t("viewAll")} (${vals.length})`}</button></li>` : "";
      const range = k === "Price" ? `<form class="price-range" data-range><label>₹<input name="pmin" inputmode="numeric" placeholder="Min" value="${pmin ?? ""}" aria-label="Minimum price"></label>–<label>₹<input name="pmax" inputmode="numeric" placeholder="Max" value="${pmax ?? ""}" aria-label="Maximum price"></label><button class="btn-go">${t("go")}</button></form>` : "";
      return `<div class="facet${open ? "" : " closed"}" data-facet="${esc(id)}"><button type="button" aria-expanded="${open}">${esc(k === "Price" ? `${t("price")} (${state.exGst ? t("exGst") : t("incGst")})` : k)}</button><ul class="opts">${opts}${more}</ul>${range}</div>`;
    }).join("");

    const chips = Object.entries(sel).flatMap(([k, vs]) => [...vs].map(v => `<button class="chip" type="button" data-f="${esc(k)}~${esc(v)}">${esc(v)}</button>`)).join("") +
      (pmin != null || pmax != null ? `<button class="chip" type="button" data-clear-range>${pmin != null ? inr(pmin) : "₹0"} – ${pmax != null ? inr(pmax) : "any"}</button>` : "");
    const sortSel = (id) => `<label class="sort" for="${id}">${t("sortBy")} <select id="${id}" data-sort>${[["rec", t("rec")], ["price-desc", t("priceHi")], ["price-asc", t("priceLo")], ["brand-az", t("brandAz")], ["brand-za", t("brandZa")]]
      .map(([v, l]) => `<option value="${v}" ${v === sort ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    const perPage = `<div class="perpage">${t("perPage")} <a href="${link(p => { p.delete("pp"); p.delete("page"); })}" class="${pp === 20 ? "on" : ""}" data-keep>20</a><span class="bar"></span><a href="${link(p => { p.set("pp", "all"); p.delete("page"); })}" class="${pp === Infinity ? "on" : ""}" data-keep>${t("all")}</a></div>`;
    const pager = pages > 1 ? `<nav class="pager" aria-label="Pages">${Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - page) <= 2)
      .map((n, i, a) => (i && n - a[i - 1] > 1 ? "<span>…</span>" : "") + (n === page ? `<span class="on">${n}</span>` : `<a href="${link(p => p.set("page", n))}">${n}</a>`)).join("")}</nav>` : "";

    main.innerHTML = crumbs(o.crumbs) + `
      <div class="listing">
        <aside class="side" id="side">
          <div class="drawer-close"><b>${t("filters")}</b><button class="linkbtn" type="button" data-drawer>✕</button></div>
          <div class="intro"><h1>${esc(o.title)} <small>(${o.items.length})</small></h1>
            <p class="more-text">${esc(o.intro)}</p><button class="linkbtn" type="button" data-readmore>${t("readMore")}</button></div>
          ${o.subcats && o.subcats.length ? `<ul class="subcats">${o.subcats.map(([l, h, n, on]) => `<li><a href="${h}"${on ? ' aria-current="page" style="font-weight:700"' : ""}>${esc(l)} <small>(${n})</small></a></li>`).join("")}</ul>` : ""}
          <div class="filters-head"><h2>${t("filters")} <small>(${nSel} ${t("applied")})</small></h2>${nSel ? `<a href="${link(p => { p.delete("f"); p.delete("pmin"); p.delete("pmax"); p.delete("page"); })}" data-keep>${t("clearAll")}</a>` : ""}</div>
          ${facets}
          <div class="drawer-apply"><button class="btn btn-primary" style="width:100%" type="button" data-drawer>${t("apply")} (${items.length})</button></div>
        </aside>
        <section>
          ${o.banner || ""}
          <div class="mob-filter"><button class="btn btn-primary" type="button" data-drawer>${t("filter")} (${nSel})</button></div>
          ${chips ? `<div class="chips">${chips}</div>` : ""}
          <div class="results-bar"><span class="count"><b>${items.length}</b> ${t("products")}</span>${sortSel("sort-top")}${perPage}</div>
          ${shown.length ? `<div class="grid">${shown.map(card).join("")}</div>` : `<div class="empty">${t("noResults")}</div>`}
          ${pager}
          <div class="results-bar">${sortSel("sort-bottom")}${perPage}</div>
          <div class="seo"><h2>${esc(o.title)}</h2><p>${esc(o.seo || o.intro)}</p></div>
        </section>
      </div>`;

    const side = $("#side");
    side.addEventListener("change", e => {
      const f = e.target.dataset.f; if (!f) return;
      go(link(p => {
        const all = p.getAll("f").filter(x => x !== f); p.delete("f"); all.forEach(x => p.append("f", x));
        if (e.target.checked) p.append("f", f); p.delete("page");
      }), true);
    });
    side.addEventListener("click", e => {
      const b = e.target.closest(".facet > button");
      if (b) { const fc = b.parentElement; const open = fc.classList.toggle("closed") === false; state.open[fc.dataset.facet] = open; b.setAttribute("aria-expanded", open); }
      const m = e.target.closest("[data-more]");
      if (m) { state.more[m.dataset.more] = !state.more[m.dataset.more]; go(location.hash, true); route(); }
      if (e.target.closest("[data-readmore]")) { const intro = $(".intro", side); const x = intro.classList.toggle("expanded"); e.target.textContent = x ? t("readLess") : t("readMore"); }
    });
    side.addEventListener("submit", e => {
      if (!e.target.matches("[data-range]")) return; e.preventDefault();
      const mn = e.target.pmin.value.replace(/[^\d.]/g, ""), mx = e.target.pmax.value.replace(/[^\d.]/g, "");
      go(link(p => { mn ? p.set("pmin", mn) : p.delete("pmin"); mx ? p.set("pmax", mx) : p.delete("pmax"); p.delete("page"); }), true);
    });
    main.querySelectorAll("[data-sort]").forEach(s => s.addEventListener("change", () => go(link(p => { s.value === "rec" ? p.delete("sort") : p.set("sort", s.value); p.delete("page"); }), true)));
    main.querySelectorAll("[data-drawer]").forEach(b => b.addEventListener("click", () => side.classList.toggle("drawer")));
    main.querySelectorAll(".chip[data-f]").forEach(c => c.addEventListener("click", () => go(link(p => {
      const all = p.getAll("f").filter(x => x !== c.dataset.f); p.delete("f"); all.forEach(x => p.append("f", x)); p.delete("page");
    }), true)));
    main.querySelector("[data-clear-range]")?.addEventListener("click", () => go(link(p => { p.delete("pmin"); p.delete("pmax"); }), true));
    main.querySelectorAll("a[data-keep]").forEach(a => a.addEventListener("click", () => sessionStorage.setItem("keepScroll", "1")));
    if (sessionStorage.getItem("drawer") === "1") { side.classList.add("drawer"); sessionStorage.removeItem("drawer"); }
    side.addEventListener("change", () => { if (side.classList.contains("drawer")) sessionStorage.setItem("drawer", "1"); });
  }

  function features(it) {
    const f = [];
    for (const [k, v] of Object.entries(it.a)) {
      if (k === "Brand" || /colour/i.test(k)) continue;
      f.push(`${k.replace(/ \(.*\)$/, "")}: ${v}`);
      if (f.length === 3) break;
    }
    if (f.length < 3 && it.m && !it.a.Material) f.push(`Material: ${it.m}`);
    if (f.length < 3) f.push(`${it.type.name}`);
    if (f.length < 3) f.push(`Sold per ${it.u}`);
    return f.slice(0, 3);
  }

  function priceHtml(it) {
    if (!it.p) return `<div class="price-row"><span class="ask">${t("askPrice")}</span></div>`;
    const save = it.mrp ? Math.round((1 - it.p / it.mrp) * 100) : 0;
    return `<div class="price-row"><span class="price" data-price="${it.p}">${inr(showPrice(it.p))}</span><span class="tax">${state.exGst ? t("exGst") : t("incGst")} · ${t("per")} ${esc(it.u)}</span>` +
      (it.mrp ? `<s>MRP ${inr(showPrice(it.mrp))}</s><span class="save">Save ${save}%</span>` : "") + `</div>`;
  }

  function card(it) {
    const save = it.mrp ? Math.round((1 - it.p / it.mrp) * 100) : 0;
    const badge = save >= 10 ? `<span class="badge mrp">${save}% off MRP</span>` : "";
    const name = `f_${it.sku}`;
    return `<article class="card" data-sku="${it.sku}">
      ${pic(it.dept)}
      <h3><a href="#/p/${it.sku}">${esc(it.title)}</a> <span class="code">(${it.sku})</span></h3>
      ${badge}
      <ul class="feats">${features(it).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
      ${it.c ? `<span class="colour"><i style="background:${CAT.colours[it.c]}"></i>${esc(it.c)}</span>` : "<span></span>"}
      <div class="buy">
        ${priceHtml(it)}
        <div class="buy-row">
          <div class="qty"><button type="button" data-step="-1" aria-label="Less">−</button><input type="number" min="1" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-step="1" aria-label="More">+</button></div>
          <a class="stock" href="${waLink(`Is this in stock? ${it.title} (${it.sku})`)}" target="_blank" rel="noopener">${t("checkStock")}</a>
        </div>
        <div class="fulfil" role="radiogroup" aria-label="Collect or deliver">
          <label><input type="radio" name="${name}" value="collect" checked>${t("collect")}</label>
          <label><input type="radio" name="${name}" value="deliver">${t("deliver")}</label>
        </div>
        <button class="btn btn-add" type="button" data-add>${t("addBasket")}</button>
        <a class="btn btn-wa" href="${waLink(`Hello, I want: ${it.title} (${it.sku})`)}" target="_blank" rel="noopener">${t("whatsapp")}</a>
      </div>
    </article>`;
  }

  function typePage(slug, params) {
    const ty = TYPES.find(x => x.slug === slug); if (!ty) return notFound();
    const d = DEPTS.find(x => x.name === ty.dept), g = d.groups.find(x => x.types.includes(ty.id));
    const items = ITEMS.filter(it => it.t === ty.id).sort((a, b) => a.sv - b.sv || a.n.localeCompare(b.n));
    setTitle(ty.name);
    listing({
      params, base: `#/c/${slug}`, title: ty.name, items, keys: ty.filters,
      crumbs: [[d.name, `#/d/${d.slug}`], [g.name, `#/g/${g.slug}`], [ty.name]],
      intro: blurb(ty.name, items), seo: seoText(ty.name, items),
      subcats: g.types.map(id => TYPES[id]).filter(x => x.count).map(x => [x.name, `#/c/${x.slug}`, x.count, x.id === ty.id]),
    });
  }

  function groupPage(slug, params) {
    let d, g; for (const dd of DEPTS) { const gg = dd.groups.find(x => x.slug === slug); if (gg) { d = dd; g = gg; } }
    if (!g) return notFound();
    const items = ITEMS.filter(it => it.gslug === slug).sort((a, b) => a.t - b.t || a.sv - b.sv || a.n.localeCompare(b.n));
    const keys = ["Product Type"];
    for (const id of g.types) for (const k of TYPES[id].filters) if (!keys.includes(k)) keys.push(k);
    keys.sort((a, b) => (a === "Product Type" ? -2 : isSizeKey(a) ? -1 : 0) - (b === "Product Type" ? -2 : isSizeKey(b) ? -1 : 0));
    setTitle(g.name);
    listing({
      params, base: `#/g/${slug}`, title: g.name, items, keys,
      crumbs: [[d.name, `#/d/${d.slug}`], [g.name]], intro: blurb(g.name, items), seo: seoText(g.name, items),
      subcats: g.types.map(id => TYPES[id]).filter(x => x.count).map(x => [x.name, `#/c/${x.slug}`, x.count]),
    });
  }

  function searchPage(params) {
    const q = params.get("q") || "";
    const { items, sizes } = search(q);
    setTitle(`Search: ${q}`);
    const types = new Map(); for (const it of items) types.set(it.t, (types.get(it.t) || 0) + 1);
    const banner = sizes.length ? `<div class="sizebanner">Showing size <b>${sizes.map(Sizes.label).join(" × ")}</b>. We read <i>${esc(q)}</i> the shop way: 3x4 = 3/4", 11/2 = 1 1/2", and match the mm size for each pipe type (UPVC 3/4" = 20 mm, PVC 3/4" = 25 mm).</div>` : "";
    listing({
      params, base: `#/search`, title: `“${q}”`, items, keys: ["Product Type", "Size", "Material", "Brand", "Department", "Colour"],
      crumbs: [[`Search: ${q}`]], intro: `${items.length} items match “${q}”.`, banner,
      subcats: [...types].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => [TYPES[id].name, `#/c/${TYPES[id].slug}`, n]),
    });
  }

  function blurb(name, items) {
    const brands = [...new Set(items.map(i => i.b).filter(b => b !== "Unbranded"))].slice(0, 4);
    return `${items.length} ${name.toLowerCase()} in stock at ${CFG.name}${brands.length ? `, from ${brands.join(", ")} and more` : ""}. Use the filters to narrow by size, brand and price. Reserve online and collect at the counter, or ask for local delivery.`;
  }
  function seoText(name, items) {
    const sizes = [...new Set(items.map(i => i.a["Size (inch)"]).filter(Boolean))].sort((a, b) => Sizes.value(a) - Sizes.value(b));
    const priced = items.filter(i => i.p).map(i => i.p);
    return `Buy ${name.toLowerCase()} at ${CFG.name}. ` + (sizes.length > 1 ? `Sizes from ${sizes[0]} to ${sizes[sizes.length - 1]}. ` : "") +
      (priced.length ? `Prices from ${inr(Math.min(...priced))} including GST, with a GST bill on every order. ` : "") +
      `Trade and bulk buyers can use Quick order to pick a material and size and order everything in one list.`;
  }

  // ---------- product page ----------
  function productPage(sku) {
    const it = BY_SKU.get(sku); if (!it) return notFound();
    const d = DEPTS.find(x => x.name === it.dept);
    setTitle(it.title);
    const rows = [[t("code"), it.sku], ["Brand", it.b], ["Category", `${it.group} › ${it.type.name}`], ...Object.entries(it.a).filter(([k]) => k !== "Brand"),
      ...(it.m && !it.a.Material ? [["Material", it.m]] : []), ...(it.c ? [["Colour", it.c]] : []), ["Sold per", it.u], ["Shop name", it.raw]];
    const related = ITEMS.filter(x => x !== it && x.t === it.t && it.sz.length && x.sz[0] === it.sz[0]).slice(0, 6);
    const same = related.length ? related : ITEMS.filter(x => x !== it && x.t === it.t).slice(0, 6);
    main.innerHTML = crumbs([[it.dept, `#/d/${d.slug}`], [it.group, `#/g/${it.gslug}`], [it.type.name, `#/c/${it.type.slug}`], [it.title]]) + `
      <div class="pdp">
        <div>
          <div class="pdp-img">${pic(it.dept)}</div>
          <h2 class="sec-title">Specifications</h2>
          <table class="specs">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
        </div>
        <div class="pdp-buy card" data-sku="${it.sku}" style="display:grid;grid-template-columns:1fr">
          <h1>${esc(it.title)}</h1>
          <span class="note">${t("code")}: ${it.sku}${it.rv ? " · category being checked" : ""}</span>
          <ul class="feats">${features(it).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
          <div class="buy" style="border:0;padding:0">
            ${priceHtml(it)}
            <div class="buy-row"><div class="qty"><button type="button" data-step="-1" aria-label="Less">−</button><input type="number" min="1" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-step="1" aria-label="More">+</button></div>
              <a class="stock" href="${waLink(`Is this in stock? ${it.title} (${it.sku})`)}" target="_blank" rel="noopener">${t("checkStock")}</a></div>
            <div class="fulfil"><label><input type="radio" name="f_pdp" value="collect" checked>${t("collect")}</label><label><input type="radio" name="f_pdp" value="deliver">${t("deliver")}</label></div>
            <button class="btn btn-add" type="button" data-add>${t("addBasket")}</button>
            <a class="btn btn-wa" href="${waLink(`Hello, I want: ${it.title} (${it.sku})`)}" target="_blank" rel="noopener">${t("whatsapp")}</a>
          </div>
        </div>
      </div>
      ${same.length ? `<h2 class="sec-title">${related.length ? "Same size, same type" : "More like this"}</h2><div class="grid">${same.map(card).join("")}</div>` : ""}`;
  }

  // ---------- quick order ----------
  let _mats;
  function MATS() {
    if (_mats) return _mats;
    const c = {};
    for (const it of ITEMS) if ((it.dept === "Plumbing" || it.dept === "Agri & Borewell") && it.m && it.sz.length) c[it.m] = (c[it.m] || 0) + 1;
    return (_mats = Object.entries(c).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).map(([m]) => m));
  }
  function quickOrder(params) {
    setTitle(t("quickOrder"));
    const mat = params.get("mat") || "", size = params.get("size") || "";
    const pool = ITEMS.filter(it => (it.dept === "Plumbing" || it.dept === "Agri & Borewell") && it.sz.length && (!mat || it.m === mat));
    const sizeCount = {};
    for (const it of pool) for (const s of it.sz) if (s.endsWith("in")) sizeCount[s] = (sizeCount[s] || 0) + 1;
    const sizes = Object.keys(sizeCount).filter(s => sizeCount[s] >= 2).sort((a, b) => Sizes.value(Sizes.label(a)) - Sizes.value(Sizes.label(b)));
    const items = size ? pool.filter(it => it.sz.includes(size)).sort((a, b) => a.group.localeCompare(b.group) || a.type.name.localeCompare(b.type.name) || (a.sz[0] !== size) - (b.sz[0] !== size) || a.n.localeCompare(b.n)) : [];
    const qp = (m, s) => { const p = new URLSearchParams(); if (m) p.set("mat", m); if (s) p.set("size", s); return "#/quick-order?" + p; };
    const byType = new Map(); for (const it of items) { const k = `${it.group} › ${it.type.name}`; (byType.get(k) || byType.set(k, []).get(k)).push(it); }
    const mmNote = size && mat ? (() => { const mm = items.find(i => i.sz[0] === size)?.sz.find(s => s.endsWith("mm")); return mm ? ` = ${Sizes.label(mm)}` : ""; })() : "";
    main.innerHTML = crumbs([[t("quickOrder")]]) + `<h1>${t("quickOrder")} <small>pick material, then size, then type quantities</small></h1>
      <div class="qo-steps">
        <div class="qo-step"><h2><i>1</i>Material</h2><div class="pick">
          <a href="${qp("", size)}" class="${!mat ? "on" : ""}">Any</a>
          ${MATS().map(m => `<a href="${qp(m, size)}" class="${m === mat ? "on" : ""}">${esc(m)}</a>`).join("")}</div></div>
        <div class="qo-step"><h2><i>2</i>Size</h2><div class="pick">
          ${sizes.map(s => `<a href="${qp(mat, s)}" class="${s === size ? "on" : ""}">${esc(Sizes.label(s))}<small>${sizeCount[s]}</small></a>`).join("") || "<span class='note'>No sizes for this material.</span>"}</div>
          <form class="qo-type" id="qo-type"><input name="s" placeholder="or type a size: 3x4, 11/2, 25mm" aria-label="Type a size"><button class="btn btn-primary">${t("go")}</button></form></div>
        <div class="qo-step"><h2><i>3</i>Quantities ${size ? `<small style="text-transform:none;font-weight:400;color:var(--muted)">${esc(mat || "All materials")} · ${esc(Sizes.label(size))}${esc(mmNote)} · ${items.length} items</small>` : ""}</h2>
          ${!size ? `<p class="note">Choose a size to see every fitting, pipe, valve and tank connector in that size.</p>` : items.length ? [...byType].map(([k, list]) => `
            <table class="qo-table"><caption>${esc(k)} (${list.length})</caption>
              <thead><tr><th>Item</th><th class="hide-sm">Brand</th><th class="num">${t("price")}</th><th class="num">Qty</th></tr></thead>
              <tbody>${list.map(it => `<tr data-sku="${it.sku}"><td><a href="#/p/${it.sku}">${esc(it.n)}</a> <span class="note">${it.sku}</span></td><td class="hide-sm">${esc(it.b)}</td>
                <td class="num">${it.p ? inr(showPrice(it.p)) + ` <span class="note">/${esc(it.u)}</span>` : `<span class="note">${t("askPrice")}</span>`}</td>
                <td class="num"><input type="number" min="0" step="1" inputmode="numeric" aria-label="Quantity for ${esc(it.n)}" data-qo></td></tr>`).join("")}</tbody></table>`).join("")
            : `<p class="note">${t("noResults")}</p>`}
        </div>
      </div>
      ${items.length ? `<div class="qo-bar"><span><b id="qo-lines">0</b> lines · <b id="qo-total">₹0</b> <small>${state.exGst ? t("exGst") : t("incGst")}</small></span><button class="btn btn-amber" type="button" id="qo-add" disabled>Add all to basket</button></div>` : ""}`;
    $("#qo-type").addEventListener("submit", e => {
      e.preventDefault(); const { sizes: s } = Sizes.parse(e.target.s.value);
      if (!s.length) { toast("Could not read that size. Try 3x4, 1 1/2 or 25mm."); return; }
      let tok = s[0];
      if (tok.endsWith("mm")) { const hit = pool.find(it => it.sz.includes(tok)); tok = hit?.sz.find(x => x.endsWith("in") && hit.sz.indexOf(x) <= 1) || tok; }
      go(qp(mat, tok));
    });
    const recalc = () => {
      let lines = 0, total = 0;
      main.querySelectorAll("[data-qo]").forEach(inp => {
        const q = Math.max(0, Math.floor(+inp.value || 0)); const tr = inp.closest("tr"); tr.classList.toggle("has", q > 0);
        if (q > 0) { lines++; total += showPrice(BY_SKU.get(tr.dataset.sku).p) * q; }
      });
      if ($("#qo-lines")) { $("#qo-lines").textContent = lines; $("#qo-total").textContent = inr(Math.round(total * 100) / 100); $("#qo-add").disabled = !lines; }
    };
    main.oninput = e => { if (e.target.matches("[data-qo]")) recalc(); };
    $("#qo-add")?.addEventListener("click", () => {
      let n = 0;
      main.querySelectorAll("[data-qo]").forEach(inp => { const q = Math.floor(+inp.value || 0); if (q > 0) { addToBasket(inp.closest("tr").dataset.sku, q, "collect", true); n++; inp.value = ""; } });
      recalc(); toast(`${n} lines ${t("added").toLowerCase()} <a href="#/basket">${t("viewBasket")}</a>`);
    });
  }

  // ---------- basket + checkout ----------
  function basketPage() {
    setTitle(t("basket"));
    const lines = state.basket.map(l => ({ ...l, it: BY_SKU.get(l.sku) })).filter(l => l.it);
    const total = lines.reduce((s, l) => s + showPrice(l.it.p) * l.qty, 0);
    const ask = lines.filter(l => !l.it.p).length;
    const wantsDelivery = lines.some(l => l.f === "deliver");
    main.innerHTML = crumbs([[t("basket")]]) + `<h1>${t("basket")} <small>(${lines.length})</small></h1>` + (!lines.length ? `<div class="empty"><p>Your basket is empty.</p><a class="btn btn-primary" href="#/">${t("home")}</a> <a class="btn btn-amber" href="#/quick-order">${t("quickOrder")}</a></div>` : `
      <div class="basket">
        <div class="bl">${lines.map(l => `<div class="bl-row" data-sku="${l.sku}">${pic(l.it.dept)}
          <div><a href="#/p/${l.sku}">${esc(l.it.title)}</a><div class="note">${l.sku} · ${l.f === "deliver" ? t("deliver") : t("collect")} · ${l.it.p ? inr(showPrice(l.it.p)) + " / " + esc(l.it.u) : t("askPrice")}</div></div>
          <div class="qty"><button type="button" data-bstep="-1" aria-label="Less">−</button><input type="number" min="1" value="${l.qty}" data-bqty aria-label="Quantity"><button type="button" data-bstep="1" aria-label="More">+</button></div>
          <b>${l.it.p ? inr(Math.round(showPrice(l.it.p) * l.qty * 100) / 100) : "—"}</b>
          <button class="rm" type="button" data-rm>Remove</button></div>`).join("")}</div>
        <form class="co" id="checkout">
          <div class="total"><span>Total</span><span>${inr(Math.round(total * 100) / 100)}</span></div>
          <span class="note">${state.exGst ? t("exGst") : t("incGst")}${ask ? ` · ${ask} item(s) priced by the shop` : ""}</span>
          <label>Your name<input name="name" required autocomplete="name"></label>
          <label>Mobile number<input name="phone" required inputmode="tel" autocomplete="tel" pattern="[0-9+ ]{10,15}"></label>
          <label>How do you want it?<select name="fulfilment"><option value="collect">Reserve and collect at the shop</option><option value="delivery" ${wantsDelivery ? "selected" : ""}>Local delivery</option><option value="quote">Send me a bulk price quote</option></select></label>
          <label>Delivery address (for delivery)<textarea name="address" rows="2"></textarea></label>
          <label>Note<textarea name="note" rows="2" placeholder="Brand preference, timing..."></textarea></label>
          ${!CFG.whatsapp && !CFG.supabaseUrl ? `<div class="warn">Shop setup: add the WhatsApp number in js/config.js so orders reach the shop.</div>` : ""}
          <button class="btn btn-add">${CFG.supabaseUrl ? "Place order" : "Send order on WhatsApp"}</button>
          <span class="note">No payment now. The shop confirms stock and price, then you pay at the counter or on delivery.</span>
        </form>
      </div>`);
    const setQty = (sku, q) => { const l = state.basket.find(x => x.sku === sku); if (l) { l.qty = Math.max(1, q); saveBasket(); basketPage(); } };
    main.querySelectorAll(".bl-row").forEach(row => {
      const sku = row.dataset.sku;
      row.querySelectorAll("[data-bstep]").forEach(b => b.addEventListener("click", () => setQty(sku, (+row.querySelector("[data-bqty]").value || 1) + +b.dataset.bstep)));
      row.querySelector("[data-bqty]").addEventListener("change", e => setQty(sku, Math.floor(+e.target.value || 1)));
      row.querySelector("[data-rm]").addEventListener("click", () => { state.basket = state.basket.filter(x => x.sku !== sku); saveBasket(); basketPage(); });
    });
    $("#checkout")?.addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, data = { customer_name: f.name.value.trim(), phone: f.phone.value.trim(), fulfilment: f.fulfilment.value, address: f.address.value.trim() || null, note: f.note.value.trim() || null, items: lines.map(l => ({ sku: l.sku, qty: l.qty })) };
      const text = `Order from website\nName: ${data.customer_name}\nPhone: ${data.phone}\n${f.fulfilment.selectedOptions[0].text}${data.address ? "\nAddress: " + data.address : ""}\n\n` +
        lines.map(l => `${l.qty} x ${l.it.title} (${l.sku})${l.it.p ? " @ " + inr(l.it.p) : ""}`).join("\n") + `\n\nTotal ${inr(Math.round(lines.reduce((s, l) => s + l.it.p * l.qty, 0)))} inc GST${data.note ? "\nNote: " + data.note : ""}`;
      let orderNo = null;
      try { orderNo = await ShopData.placeOrder(data); } catch (err) { toast("Could not reach the shop system, sending on WhatsApp instead."); }
      main.innerHTML = `<div class="ok-box"><h1>${orderNo ? `Order ${esc(orderNo)} received` : "Almost done"}</h1>
        <p>${orderNo ? "The shop will call you to confirm stock and price." : "Send this order to the shop on WhatsApp. The shop will confirm stock and price."}</p>
        ${CFG.whatsapp ? `<a class="btn btn-add" style="max-width:320px" target="_blank" rel="noopener" href="${waLink((orderNo ? `Order ${orderNo}\n` : "") + text)}">Open WhatsApp</a>` : `<pre style="white-space:pre-wrap;background:#fff;padding:12px;border-radius:6px">${esc(text)}</pre>`}
        <p><button class="linkbtn" type="button" id="clear-basket">Empty my basket</button></p></div>`;
      if (orderNo) { state.basket = []; saveBasket(); }
      $("#clear-basket").addEventListener("click", () => { state.basket = []; saveBasket(); go("#/"); });
    });
  }

  // ---------- info pages ----------
  function infoPage(v) {
    const contact = `${CFG.address ? `<p><b>Address:</b> ${esc(CFG.address)}</p>` : `<p class="warn">Shop address not set yet (js/config.js).</p>`}
      <p><b>Opening hours:</b> ${esc(CFG.hours)}</p>${CFG.phone ? `<p><b>Phone:</b> <a href="tel:${esc(CFG.phone)}">${esc(CFG.phone)}</a></p>` : ""}
      ${CFG.whatsapp ? `<p><a class="btn btn-wa" style="max-width:260px" href="${waLink("Hello")}">WhatsApp us</a></p>` : ""}`;
    const pages = {
      store: [t("store"), contact],
      account: [t("account"), `<p>Customer accounts (saved addresses, past orders, trade prices) will come when the shop switches on online sign-in.</p><p>For now, order with the basket or Quick order and the shop confirms on WhatsApp or phone.</p>`],
      help: [t("help"), `<h2 class="sec-title">Searching by size</h2>
        <p>Type sizes the way you say them at the counter. <b>3x4</b> or <b>3/4</b> means 3/4 inch. <b>11/2</b> means 1 1/2 inch, <b>21/2</b> means 2 1/2 inch. <b>4x2</b> means a 4 inch to 2 inch reducer. You can also type millimetres, like <b>20mm</b>: we match the right inch size for each pipe type (UPVC/CPVC 3/4" = 20 mm, PVC 3/4" = 25 mm, GI 3/4" = 20 mm NB).</p>
        <h2 class="sec-title">Prices and GST</h2><p>Prices include GST. Trade buyers can switch to "ex GST" at the top of the page. Every order gets a GST bill.</p>
        <h2 class="sec-title">Collect or delivery</h2><p>Add items to the basket and send the order. The shop confirms stock and price, then you collect at the counter or we deliver locally.</p>` + contact],
    };
    const [title, body] = pages[v];
    setTitle(title);
    main.innerHTML = crumbs([[title]]) + `<h1>${esc(title)}</h1><div class="seo">${body}</div>`;
  }

  // ---------- global events: qty steppers, add to basket, toggles ----------
  main.addEventListener("click", e => {
    const step = e.target.closest("[data-step]");
    if (step) {
      const inp = step.parentElement.querySelector("input");
      inp.value = Math.max(1, (Math.floor(+inp.value) || 1) + +step.dataset.step);
    }
    const add = e.target.closest("[data-add]");
    if (add) {
      const c = add.closest("[data-sku]");
      const q = Math.max(1, Math.floor(+c.querySelector(".qty input").value) || 1);
      const f = c.querySelector(".fulfil input:checked")?.value || "collect";
      addToBasket(c.dataset.sku, q, f);
    }
  });
  main.addEventListener("change", e => {
    if (e.target.matches(".qty input:not([data-bqty])")) e.target.value = Math.max(1, Math.floor(+e.target.value) || 1);
  });
  $("#gst-toggle").addEventListener("change", e => { state.exGst = e.target.checked; store.set("exgst", state.exGst); sessionStorage.setItem("keepScroll", "1"); renderShell(); route(); });
  $("#lang-btn").addEventListener("click", () => { state.lang = state.lang === "en" ? "ta" : "en"; store.set("lang", state.lang); renderShell(); route(); });

  // ---------- start ----------
  ShopData.load().then(cat => {
    prepare(cat);
    renderShell(); wireMenu(); wireSearch();
    window.addEventListener("hashchange", route);
    route();
    window.SHOP = { ITEMS, TYPES, DEPTS, search, state };   // used by the browser tests
  }).catch(err => {
    main.innerHTML = `<div class="empty"><h1>Could not load the item list</h1><p>${esc(err.message)}</p><p class="note">If you opened index.html straight from a folder, run the small web server instead (see README).</p></div>`;
  });
})();
