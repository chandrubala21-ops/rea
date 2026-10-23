// Shop front end: menu, listings with filters, search, product page, compare, quick order, basket.
// Plain JavaScript, no build step. Pages are addressed by the part of the URL after '#', so every
// filter, sort and page choice can be reloaded, shared on WhatsApp, and stepped through with Back.
(function () {
  const CFG = window.SHOP_CONFIG;
  const GST_RATE = CFG.gstRate || 18;
  const PER_PAGE = 24, ALL_PAGE = 100, CMP_MAX = 4;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const main = $("#main");

  // ---------- small helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sa_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sa_" + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const inr = n => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const state = {
    lang: store.get("lang", "en"), exGst: store.get("exgst", false), basket: store.get("basket", []),
    compare: store.get("compare", []), pin: store.get("pin", ""), open: {}, drawer: false, solo: null, base: null,
    pb: null, lastListing: "#/",
  };
  const showPrice = p => state.exGst ? Math.round(p / (1 + GST_RATE / 100) * 100) / 100 : p;
  const isPhone = () => matchMedia("(max-width: 860px)").matches;

  // ---------- words (English / Tamil) ----------
  const T = {
    en: {
      help: "Help & contact", incGst: "inc GST", exGst: "ex GST", quickOrder: "Quick order", account: "Account", store: "Our shop",
      basket: "Basket", search: "Search 8,000+ items, e.g. 3x4 UPVC elbow", home: "Home", filters: "Filters", applied: "applied",
      clearAll: "Clear all", viewAll: "View all", sortBy: "Sort by", perPage: "Results per page:", all: "All",
      rec: "Recommended", priceHi: "Price: high to low", priceLo: "Price: low to high", brandAz: "Brand: A to Z", brandZa: "Brand: Z to A",
      products: "products", addBasket: "Add to basket", whatsapp: "Ask on WhatsApp", collect: "Collect", deliver: "Deliver",
      checkStock: "Check stock at our shop", askPrice: "Ask for price", readMore: "Read more", readLess: "Read less",
      filter: "Filter", apply: "Apply", close: "Close", done: "Done", back: "Back", price: "Price", go: "Go", added: "Added to basket", viewBasket: "View basket",
      noResults: "No items match. Try fewer filters or another spelling.", categories: "Categories", per: "per",
      shopDepts: "Shop by department", topBrands: "Top brands", code: "Item code", compare: "Compare", compareNow: "Compare now",
      shopBy: "Shop by", prev: "Previous", next: "Next", page: "Page", of: "of", noReviews: "No reviews yet",
    },
    ta: {
      help: "உதவி & தொடர்பு", incGst: "GST உட்பட", exGst: "GST இல்லாமல்", quickOrder: "விரைவு ஆர்டர்", account: "கணக்கு", store: "எங்கள் கடை",
      basket: "கூடை", search: "8,000+ பொருட்களைத் தேடுங்கள், உ.தா. 3x4 UPVC elbow", home: "முகப்பு", filters: "வடிகட்டிகள்", applied: "தேர்வு",
      clearAll: "அனைத்தையும் நீக்கு", viewAll: "அனைத்தும் காண்க", sortBy: "வரிசைப்படுத்து", perPage: "ஒரு பக்கத்தில்:", all: "அனைத்தும்",
      rec: "பரிந்துரை", priceHi: "விலை: அதிகம் முதல்", priceLo: "விலை: குறைவு முதல்", brandAz: "பிராண்ட்: A - Z", brandZa: "பிராண்ட்: Z - A",
      products: "பொருட்கள்", addBasket: "கூடையில் சேர்", whatsapp: "WhatsApp-ல் கேளுங்கள்", collect: "கடையில் பெறுக", deliver: "டெலிவரி",
      checkStock: "கடையில் இருப்பு உள்ளதா?", askPrice: "விலைக்கு கேளுங்கள்", readMore: "மேலும் படிக்க", readLess: "குறைவாக",
      filter: "வடிகட்டு", apply: "பயன்படுத்து", close: "மூடு", done: "முடிந்தது", back: "பின்", price: "விலை", go: "செல்", added: "கூடையில் சேர்க்கப்பட்டது", viewBasket: "கூடையைப் பார்",
      noResults: "பொருட்கள் இல்லை. குறைவான வடிகட்டிகளை முயற்சிக்கவும்.", categories: "வகைகள்", per: "ஒரு",
      shopDepts: "துறை வாரியாக வாங்குங்கள்", topBrands: "முன்னணி பிராண்டுகள்", code: "பொருள் குறியீடு", compare: "ஒப்பிடு", compareNow: "இப்போது ஒப்பிடு",
      shopBy: "வாங்க", prev: "முந்தைய", next: "அடுத்த", page: "பக்கம்", of: "/", noReviews: "இன்னும் மதிப்புரைகள் இல்லை",
    },
  };
  const t = k => (T[state.lang] && T[state.lang][k]) || T.en[k] || k;
  const deptName = d => state.lang === "ta" && d.ta ? d.ta : d.name;

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
  let CAT, ITEMS, BY_SKU, TYPES, DEPTS, VOCAB, PHRASES;
  const MATERIAL_WORDS = new Set(["pvc", "upvc", "cpvc", "gi", "ss", "ms", "ci", "cp", "swr", "hdpe"]);
  const SYN = { coupling: ["coupler"], coupler: ["coupling"], tap: ["cock"], cock: ["tap"], bulb: ["lamp"], lamp: ["bulb"],
                ballvalve: ["ball valve"], reducer: [" r ", "reducing"], reducing: ["reducer", " r "], wire: ["cable"], cable: ["wire"],
                geyser: ["water heater"], heater: ["geyser"] };

  function prepare(cat) {
    CAT = cat; TYPES = cat.types; DEPTS = cat.depts; ITEMS = cat.items; BY_SKU = new Map();
    const groupSlug = {}, vocab = new Map(), phrases = new Map();
    const addPhrase = (p, n = 1) => { if (p) phrases.set(p, (phrases.get(p) || 0) + n); };
    for (const d of DEPTS) for (const g of d.groups) { for (const tid of g.types) groupSlug[tid] = g.slug; }
    for (const it of ITEMS) {
      const ty = TYPES[it.t];
      it.type = ty; it.dept = ty.dept; it.group = ty.group; it.gslug = groupSlug[it.t];
      it.title = it.b !== "Unbranded" && !it.n.toLowerCase().includes(it.b.toLowerCase().split("/")[0]) ? `${it.b} ${it.n}` : it.n;
      it.hay = " " + [it.sku, it.n, it.raw, it.b, ty.name, ty.group, ty.dept, it.m || "", ...Object.values(it.a)].join(" ").toLowerCase().replace(/[^a-z0-9.஀-௿]+/g, " ") + " ";
      it.hayc = it.hay.replace(/ /g, "");
      it.sv = Sizes.value(it.a["Size (inch)"] || it.a["Size (mm)"] || "");
      for (const w of it.hay.split(" ")) if (/^[a-z]{3,}$/.test(w)) vocab.set(w, (vocab.get(w) || 0) + 1);
      addPhrase(ty.name); addPhrase(ty.group);
      if (it.b !== "Unbranded") addPhrase(it.b);
      if (it.m && it.a["Fitting Shape"]) addPhrase(`${it.m} ${it.a["Fitting Shape"]}`, 2);
      if (it.m && /Fittings|Pipes|Valves/.test(ty.group)) addPhrase(`${it.m} ${ty.group}`);
      BY_SKU.set(it.sku, it);
    }
    VOCAB = vocab;
    PHRASES = [...phrases].map(([p, n]) => ({ p, l: p.toLowerCase(), n })).sort((a, b) => b.n - a.n);
  }

  function matchWord(it, w) {
    if (MATERIAL_WORDS.has(w)) return it.hay.includes(" " + w + " ") || (it.m || "").toLowerCase() === w;
    if (/^\d+$/.test(w)) return new RegExp(`(^|[^\\d.])${w}(?![\\d])`).test(it.hay);
    if (it.hay.includes(w) || it.hayc.includes(w)) return true;
    if (w.length > 3 && w.endsWith("s") && it.hay.includes(w.slice(0, -1))) return true;
    return (SYN[w] || []).some(s => it.hay.includes(s));
  }

  // edit distance with adjacent swaps (Damerau), stopping early past `max`
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let best = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        best = Math.min(best, d[i][j]);
      }
      if (best > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  function correct(w) {
    if (w.length < 4 || /\d/.test(w)) return w;
    const max = w.length >= 6 ? 2 : 1;
    let bestW = w, bestD = max + 1, bestN = 0;
    for (const [v, n] of VOCAB) {
      const dd = distance(w, v, max);
      if (dd < bestD || dd === bestD && n > bestN) { bestW = v; bestD = dd; bestN = n; }
    }
    return bestD <= max ? bestW : w;
  }

  function runSearch(sizes, words) {
    const out = [];
    for (const it of ITEMS) {
      if (sizes.length && !sizes.every(s => it.sz.includes(s))) continue;
      if (!words.every(w => matchWord(it, w))) continue;
      let score = 0;
      const title = " " + it.n.toLowerCase() + " ";
      for (const w of words) {
        if (title.includes(" " + w)) score += 3;
        if (it.type.name.toLowerCase().includes(w)) score += 2;
        if (it.sku.toLowerCase() === w) score += 50;
      }
      if (sizes.length && it.sz[0] === sizes[0]) score += 4;
      if (it.p > 0) score += 1;
      out.push([score, it]);
    }
    out.sort((a, b) => b[0] - a[0] || a[1].sv - b[1].sv || a[1].n.localeCompare(b[1].n));
    return out.map(x => x[1]);
  }

  // Typos: a word with no match is corrected; so is one that only turns up inside longer words
  // ("hamer" in "Hamertone") when the corrected word finds far more.
  function search(q, exact) {
    const { sizes, words } = Sizes.parse(q);
    if (!sizes.length && !words.length) return { items: [], sizes, words };
    let items = runSearch(sizes, words), corrected = null, original = items.length;
    if (!exact && words.length) {
      const fixed = words.map(w => VOCAB.has(w) || SYN[w] || MATERIAL_WORDS.has(w) || /\d/.test(w) ? w : correct(w));
      if (fixed.some((w, i) => w !== words[i])) {
        const alt = runSearch(sizes, fixed);
        if (alt.length && alt.length >= 3 * items.length + 1) {
          items = alt;
          corrected = [...sizes.map(Sizes.label), ...fixed].join(" ");
        }
      }
    }
    return { items, sizes, words, corrected, original };
  }

  // ---------- basket, compare, PIN code ----------
  function saveBasket() {
    store.set("basket", state.basket);
    $$(".basket-count").forEach(el => { el.textContent = state.basket.length; });
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

  function toggleCompare(sku, on) {
    const has = state.compare.includes(sku);
    if (on && !has) {
      if (state.compare.length >= CMP_MAX) { toast(`You can compare up to ${CMP_MAX} products. Remove one first.`); return false; }
      state.compare.push(sku);
    } else if (!on && has) state.compare = state.compare.filter(s => s !== sku);
    store.set("compare", state.compare);
    renderCompareBits();
    return true;
  }
  function renderCompareBits() {
    const n = state.compare.length;
    $$(".card[data-sku]").forEach(c => {
      const on = state.compare.includes(c.dataset.sku), box = c.querySelector("[data-compare]");
      if (box) box.checked = on;
      const lab = c.querySelector(".cmp-n"); if (lab) lab.textContent = `(${n}/${CMP_MAX})`;
      const btn = c.querySelector(".cmp-go"); if (btn) btn.hidden = !(on && n >= 2);
    });
    const tray = $("#compare-tray");
    tray.hidden = !n || location.hash.startsWith("#/compare");
    tray.innerHTML = `<div class="wrap tray-in"><span><b>${t("compare")} (${n}/${CMP_MAX})</b> ${state.compare.map(s => esc(BY_SKU.get(s)?.n || s)).join(" · ")}</span>
      <span><a class="btn btn-amber" href="#/compare"${n < 2 ? ' aria-disabled="true"' : ""}>${t("compareNow")}</a> <button class="linkbtn" type="button" data-cmp-clear>${t("clearAll")}</button></span></div>`;
  }

  function deliveryInfo() {
    const d = CFG.delivery || {};
    if (!state.pin) return `<button type="button" class="linkbtn" data-pin>Enter PIN code for delivery</button>`;
    const change = ` <button type="button" class="linkbtn" data-pin>change</button>`;
    if (!d.pins || !d.pins.length) return `Delivery to <b>${esc(state.pin)}</b>: the shop confirms the charge and day.${change}`;
    if (!d.pins.includes(state.pin)) return `We don't deliver to <b>${esc(state.pin)}</b> yet. Collect from the shop.${change}`;
    const day = new Date().getHours() < (d.cutoffHour ?? 14) ? `Today if ordered by ${d.cutoffHour > 12 ? d.cutoffHour - 12 + " pm" : d.cutoffHour + " am"}` : "Tomorrow";
    return `Delivery to <b>${esc(state.pin)}</b>: ${inr(d.charge)}${d.freeOver ? ` (free over ${inr(d.freeOver)})` : ""}, ${day}.${change}`;
  }
  function stockLine(it) {
    if (typeof it.st === "number") {
      if (it.st <= 0) return `<span class="stk out">Out of stock</span>`;
      if (it.st <= 5) return `<span class="stk low">Only ${it.st} left</span>`;
      return `<span class="stk in">In stock</span>`;
    }
    return `<a class="stock" href="${waLink(`Is this in stock? ${it.title} (${it.sku})`)}" target="_blank" rel="noopener">${t("checkStock")}</a>`;
  }

  function modal(html, onOpen) {
    const ov = $("#overlay");
    ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    ov.hidden = false; document.body.classList.add("noscroll");
    const close = () => { ov.hidden = true; ov.innerHTML = ""; document.body.classList.remove("noscroll"); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    ov.onclick = e => { if (e.target === ov || e.target.closest("[data-close]")) close(); };
    onOpen?.(ov.firstElementChild, close);
    ov.querySelector("input, textarea, button")?.focus();
  }
  function askPin() {
    modal(`<h2>Delivery PIN code</h2><p class="note">We remember it on this phone or computer.</p>
      <form id="pin-form"><label class="field">PIN code<input name="pin" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required value="${esc(state.pin)}"></label>
      <div class="modal-actions"><button class="btn btn-primary">Save</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div></form>`, (m, close) => {
      m.querySelector("input").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
      m.querySelector("form").addEventListener("submit", e => {
        e.preventDefault(); state.pin = e.target.pin.value; store.set("pin", state.pin); close(); renderShell(); route("keep");
      });
    });
  }

  // ---------- shell: header, menu, promise strip, footer ----------
  function renderShell() {
    document.documentElement.lang = state.lang;
    $("#logo-name").textContent = state.lang === "ta" && CFG.nameTa ? CFG.nameTa : CFG.name;
    $("#logo-tag").textContent = CFG.tagline;
    $("#hours").textContent = CFG.hours ? "· " + CFG.hours : "";
    $("#lang-btn").textContent = state.lang === "en" ? "தமிழ்" : "English";
    // the item count follows the list ("8,000+"), so hiding items keeps the wording true
    const approx = (ITEMS.length >= 1000 ? Math.floor(ITEMS.length / 1000) * 1000 : ITEMS.length).toLocaleString("en-IN");
    $("#search-input").placeholder = t("search").replace("8,000", approx);
    $("#gst-toggle").checked = state.exGst;
    $$("[data-t]").forEach(el => { el.textContent = t(el.dataset.t); });
    $$(".pin-label").forEach(el => { el.textContent = state.pin ? `PIN ${state.pin}` : t("store"); });
    $("#nav-list").innerHTML = DEPTS.map(d =>
      `<li><a href="#/d/${d.slug}" data-dept="${d.slug}" aria-haspopup="true" aria-expanded="false">${esc(deptName(d))}</a></li>`).join("");
    $("#promise").innerHTML = CFG.promises.map((p, i) =>
      `<a href="${i === 2 ? "#/quick-order" : "#/help"}"><b>${esc(p.strong)}</b>${esc(p.text)}</a>`).join("") +
      `<a href="${waLink("Hello, I have a question")}"><b>WHATSAPP US</b>for prices &amp; stock</a>`;
    $("#promo").innerHTML = `Building or repairing? Order all your pipe fittings in one go by size <span class="cta">${t("quickOrder")} →</span>`;
    $("#footer").innerHTML = `
      <div><h4>${esc(CFG.name)}</h4><p>${esc(CFG.tagline)}</p>${CFG.address ? `<p>${esc(CFG.address)}</p>` : ""}${CFG.phone ? `<p>${esc(CFG.phone)}</p>` : ""}</div>
      <div><h4>${t("shopDepts")}</h4>${DEPTS.map(d => `<a href="#/d/${d.slug}">${esc(d.name)}</a>`).join("")}</div>
      <div><h4>${t("help")}</h4><a href="#/quick-order">${t("quickOrder")}</a><a href="#/help">How to search by size</a><a href="#/store">${t("store")}</a><a href="#/compare">${t("compare")}</a><a href="#/basket">${t("basket")}</a></div>`;
    saveBasket();
    renderCompareBits();
  }

  const MEGA_CAP = 12;
  function megaHtml(d) {
    const groups = [...d.groups].sort((a, b) => (a.name === "Other") - (b.name === "Other"));
    return `<div class="wrap mega-in" style="--cols:${Math.min(groups.length, 6)}">` + groups.map(g => {
      const types = g.types.map(id => TYPES[id]).filter(ty => ty.count);
      return `<div><h3><a href="#/g/${g.slug}">${esc(g.name)}</a></h3><ul>
        ${types.slice(0, MEGA_CAP).map(ty => `<li><a href="#/c/${ty.slug}">${esc(ty.name)}</a></li>`).join("")}
      </ul><a class="viewall" href="#/g/${g.slug}">${t("viewAll")}</a></div>`;
    }).join("") + `</div>`;
  }

  function wireMenu() {
    const nav = $("#nav"), mega = $("#mega"), list = $("#nav-list");
    let current = null;
    const open = slug => {
      const d = DEPTS.find(x => x.slug === slug); if (!d) return;
      current = slug; mega.innerHTML = megaHtml(d); mega.hidden = false;
      $$("a", list).forEach(a => { const on = a.dataset.dept === slug; a.classList.toggle("open", on); a.setAttribute("aria-expanded", on); });
    };
    const close = () => { current = null; mega.hidden = true; $$("a", list).forEach(a => { a.classList.remove("open"); a.setAttribute("aria-expanded", "false"); }); };
    list.addEventListener("mouseover", e => { const a = e.target.closest("a[data-dept]"); if (a && a.dataset.dept !== current) open(a.dataset.dept); });
    nav.addEventListener("mouseleave", close);
    list.addEventListener("click", e => {
      const a = e.target.closest("a[data-dept]"); if (!a) return;
      if (current !== a.dataset.dept && matchMedia("(hover: none)").matches) { e.preventDefault(); open(a.dataset.dept); }
    });
    list.addEventListener("keydown", e => {
      const a = e.target.closest("a[data-dept]");
      if (a && e.key === "ArrowDown") { e.preventDefault(); open(a.dataset.dept); mega.querySelector("a")?.focus(); }
    });
    mega.addEventListener("click", e => { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    window.addEventListener("hashchange", close);
  }

  // ---------- phone: pinned icon bar, drill-down menu, search panel ----------
  function wirePhone() {
    const panel = $("#phone-panel"), bar = $("#phonebar");
    const setOpen = which => {
      state.pb = which;
      $$("[data-pb]", bar).forEach(b => b.setAttribute("aria-expanded", b.dataset.pb === which));
      document.body.classList.toggle("search-open", which === "search");
      if (which === "search") { panel.hidden = true; $("#search-input").focus(); return; }
      if (!which) { panel.hidden = true; return; }
      panel.hidden = false; drawBrowse("depts");
    };
    const drawBrowse = (level, slug) => {
      let rows;
      if (level === "depts") {
        rows = `<h2 class="pp-title">Departments</h2>` + DEPTS.map(d => `<button type="button" class="pp-row" data-lv="dept" data-slug="${d.slug}">${esc(deptName(d))}<span>›</span></button>`).join("");
      } else if (level === "dept") {
        const d = DEPTS.find(x => x.slug === slug);
        rows = `<button type="button" class="pp-back" data-lv="depts">◂ ${t("back")} to Departments</button><a class="pp-row pp-all" href="#/d/${d.slug}">ALL ${esc(d.name)}</a>` +
          d.groups.map(g => `<button type="button" class="pp-row" data-lv="group" data-slug="${g.slug}" data-parent="${d.slug}">${esc(g.name)}<span>›</span></button>`).join("");
      } else {
        const d = DEPTS.find(x => x.groups.some(g => g.slug === slug)), g = d.groups.find(x => x.slug === slug);
        rows = `<button type="button" class="pp-back" data-lv="dept" data-slug="${d.slug}">◂ ${t("back")} to ${esc(d.name)}</button><a class="pp-row pp-all" href="#/g/${g.slug}">ALL ${esc(g.name)}</a>` +
          g.types.map(id => TYPES[id]).filter(x => x.count).map(x => `<a class="pp-row" href="#/c/${x.slug}">${esc(x.name)}<small>${x.count}</small></a>`).join("");
      }
      panel.innerHTML = rows; panel.scrollTop = 0;
    };
    bar.addEventListener("click", e => {
      const b = e.target.closest("[data-pb]"); if (!b) return;
      setOpen(state.pb === b.dataset.pb ? null : b.dataset.pb);
    });
    panel.addEventListener("click", e => {
      const b = e.target.closest("[data-lv]"); if (b) { drawBrowse(b.dataset.lv, b.dataset.slug); return; }
      if (e.target.closest("a")) setOpen(null);
    });
    window.addEventListener("hashchange", () => setOpen(null));
  }

  // ---------- search box with suggestions ----------
  function suggestions(q) {
    const { items, sizes, words, corrected } = search(q);
    const ws = corrected ? Sizes.parse(corrected).words : words;
    const sizeLabel = sizes.map(Sizes.label).join(" x ");
    const phrases = [];
    for (const ph of PHRASES) {
      if (ws.length && ws.every(w => ph.l.split(/[\s/&(),-]+/).some(x => x.startsWith(w)) || ph.l.includes(w))) {
        const text = sizeLabel ? `${sizeLabel} ${ph.p}` : ph.p;
        if (!sizes.length || items.some(it => it.type.name === ph.p || it.type.group === ph.p || it.b === ph.p || `${it.m} ${it.a["Fitting Shape"]}` === ph.p || `${it.m} ${it.group}` === ph.p)) phrases.push(text);
      }
      if (phrases.length === 5) break;
    }
    if (!phrases.length && items.length) phrases.push(corrected || q.trim());
    return { phrases, products: items.slice(0, 3), sizes, typed: [...ws, ...q.toLowerCase().split(/\s+/)].filter(Boolean), corrected };
  }
  function boldTyped(text, typed) {
    let out = esc(text);
    for (const w of [...new Set(typed)].sort((a, b) => b.length - a.length)) {
      if (w.length < 1) continue;
      out = out.replace(new RegExp(`(^|[\\s"(/-])(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "$1\u0001$2\u0002");
    }
    return out.replace(/\u0001/g, "<b>").replace(/\u0002/g, "</b>");
  }
  function wireSearch() {
    const form = $("#search-form"), input = $("#search-input"), box = $("#suggest"), clear = $("#search-clear");
    let hi = -1, typed = "";
    const rows = () => $$("[data-sg]", box);
    const close = () => { box.hidden = true; input.setAttribute("aria-expanded", "false"); hi = -1; };
    const submit = q => { close(); document.body.classList.remove("search-open"); input.blur(); go("#/search?q=" + encodeURIComponent(q)); };
    form.addEventListener("submit", e => {
      e.preventDefault();
      const r = rows()[hi];
      if (r && r.dataset.sg === "product") { close(); go(r.getAttribute("href")); return; }
      const q = input.value.trim(); if (q) submit(q);
    });
    const draw = () => {
      const q = input.value; typed = q;
      clear.hidden = !q;
      if (q.trim().length < 3) { close(); return; }
      const s = suggestions(q);
      if (input.value !== q) return;   // never show results for older text
      const fix = s.corrected ? `<div class="hint">Showing matches for <b>${esc(s.corrected)}</b></div>` : s.sizes.length ? `<div class="hint">Size: ${s.sizes.map(Sizes.label).join(" × ")}</div>` : "";
      const ph = s.phrases.map(p => `<a href="#/search?q=${encodeURIComponent(p)}" data-sg="phrase" data-text="${esc(p)}" role="option">${boldTyped(p, s.typed)}</a>`).join("");
      const pr = s.products.map(it => `<a href="#/p/${it.sku}" data-sg="product" role="option" class="sg-prod">${pic(it.dept, "sg-img")}<span><span class="sg-name">${esc(it.title)}</span><small>${it.sku}</small></span>
        <span class="sg-price">${it.p ? inr(showPrice(it.p)) : t("askPrice")}<small>${it.p ? (state.exGst ? t("exGst") : t("incGst")) : ""}</small>${it.mrp ? `<s>${inr(showPrice(it.mrp))}</s>` : ""}</span></a>`).join("");
      box.innerHTML = fix + (ph ? `<div class="sg-block">${ph}</div>` : "") + (pr ? `<div class="sg-block sg-products">${pr}</div>` : "") || `<div class="hint">No matches yet</div>`;
      box.hidden = false; input.setAttribute("aria-expanded", "true"); hi = -1;
    };
    input.addEventListener("input", draw);
    input.addEventListener("focus", () => { if (input.value.trim().length >= 3) draw(); });
    input.addEventListener("keydown", e => {
      const r = rows();
      if (e.key === "Escape") { if (!box.hidden) { e.preventDefault(); close(); } return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" || box.hidden || !r.length) return;
      e.preventDefault();
      hi = e.key === "ArrowDown" ? (hi + 1) % (r.length + 1) : (hi <= 0 ? r.length : hi - 1);
      if (hi === r.length) hi = -1;
      r.forEach((x, i) => { x.classList.toggle("on", i === hi); x.setAttribute("aria-selected", i === hi); });
      input.value = hi >= 0 && r[hi].dataset.sg === "phrase" ? r[hi].dataset.text : typed;
    });
    clear.addEventListener("click", () => { input.value = ""; clear.hidden = true; close(); input.focus(); });
    document.addEventListener("click", e => { if (!form.contains(e.target)) close(); });
    box.addEventListener("click", e => { if (e.target.closest("a")) { close(); document.body.classList.remove("search-open"); } });
  }

  // ---------- routing with scroll memory ----------
  const nav = { mode: null };          // how the next render should scroll: top | results | keep | null (Back/Forward: restore)
  let SCROLL = {}; try { SCROLL = JSON.parse(sessionStorage.getItem("sa_scroll") || "{}"); } catch { /* none */ }
  let lastY = 0;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  addEventListener("scroll", () => { lastY = scrollY; }, { passive: true });
  addEventListener("hashchange", e => {
    SCROLL[new URL(e.oldURL).hash || "#/"] = lastY;
    try { sessionStorage.setItem("sa_scroll", JSON.stringify(SCROLL)); } catch { /* none */ }
  });
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    nav.mode = a.dataset.nav || "top";
    if (a.getAttribute("href") === location.hash) { e.preventDefault(); route(); }
  }, true);
  function go(hash, mode = "top") { nav.mode = mode; if (location.hash === hash) route(); else location.hash = hash; }

  function route(force) {
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = h.split("?");
    const params = new URLSearchParams(qs || "");
    const [view, key] = path.split("/").filter(Boolean).map(decodeURIComponent);
    const mode = force || nav.mode; nav.mode = null;
    const y = scrollY;
    const base = "#" + path;
    if (base !== state.base) { state.drawer = false; state.solo = null; state.base = base; }
    document.body.classList.remove("noscroll");
    try {
      if (!view) home();
      else if (view === "d") deptPage(key);
      else if (view === "g") groupPage(key, params);
      else if (view === "c") typePage(key, params);
      else if (view === "search") searchPage(params);
      else if (view === "p") productPage(key, params);
      else if (view === "compare") comparePage();
      else if (view === "quick-order") quickOrder(params);
      else if (view === "basket") basketPage();
      else if (view === "store" || view === "help" || view === "account") infoPage(view);
      else notFound();
    } catch (err) { console.error(err); main.innerHTML = `<div class="empty">Something went wrong: ${esc(err.message)}</div>`; }
    renderCompareBits();
    if (mode === "keep") scrollTo(0, y);
    else if (mode === "results") {
      const r = $("#results");
      const top = r ? r.getBoundingClientRect().top + scrollY - (isPhone() ? 70 : 10) : 0;
      scrollTo(0, Math.min(y, Math.max(0, top)));
    } else if (mode === "top") scrollTo(0, 0);
    else requestAnimationFrame(() => scrollTo(0, SCROLL[location.hash || "#/"] || 0));
    if (view !== "search") $("#search-input").value = "";
    else $("#search-input").value = params.get("q") || "";
    $("#search-clear").hidden = !$("#search-input").value;
  }
  const setTitle = s => { document.title = s ? `${s} | ${CFG.name}` : CFG.name; };
  const notFound = () => { setTitle("Not found"); main.innerHTML = `<div class="empty"><h1>Page not found</h1><p><a href="#/">${t("home")}</a></p></div>`; };

  const HOME_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z" fill="currentColor"/></svg>';
  // desktop: Home › every parent as a link; phone: one "‹ Back to parent" link
  const crumbs = list => {
    const parent = [...list].reverse().find(([, href]) => href);
    return `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/" aria-label="${t("home")}">${HOME_ICON}</a>` +
      list.map(([label, href]) => `<span class="sep">›</span>` + (href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`)).join("") + `</nav>` +
      `<nav class="crumbs-back" aria-label="Back"><a href="${parent ? parent[1] : "#/"}">‹ ${t("back")} to ${esc(parent ? parent[0] : t("home"))}</a></nav>`;
  };

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
          <p>${ITEMS.length.toLocaleString("en-IN")} items in ${esc(DEPTS.map(d => d.name.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1"))}. Reserve online, collect in the shop or get it delivered.</p>
          <a class="btn btn-amber" href="#/d/plumbing">Shop plumbing</a> <a class="btn btn-amber" href="#/d/electrical">Shop electrical</a>
        </div>
        <div class="hero-side">
          <h2>${t("quickOrder")}</h2>
          <p>Pick a material and a size, see every fitting, pipe and valve in that size, and type the quantities.</p>
          <form id="hero-qo"><input name="q" placeholder="e.g. UPVC 3x4 or PVC 11/2" aria-label="Material and size"><button class="btn btn-primary">${t("go")}</button></form>
        </div>
      </section>
      <h2 class="sec-title">${t("shopDepts")}</h2>
      <div class="tiles">${DEPTS.map(d => {
        const n = d.groups.reduce((s, g) => s + g.types.reduce((a, id) => a + TYPES[id].count, 0), 0);
        return `<a class="tile" href="#/d/${d.slug}">${pic(d.name, "ic")}<b>${esc(deptName(d))}</b><small>${n.toLocaleString("en-IN")} ${t("products")}</small></a>`;
      }).join("")}</div>
      <h2 class="sec-title">${t("topBrands")}</h2>
      <div class="brands">${top.map(([b]) => `<a href="#/search?q=${encodeURIComponent(b)}">${esc(b)}</a>`).join("")}</div>`;
    $("#hero-qo").addEventListener("submit", e => {
      e.preventDefault();
      const { sizes, words } = Sizes.parse(e.target.q.value);
      const mat = MATS().find(m => words.some(w => m.toLowerCase().startsWith(w)));
      const p = new URLSearchParams(); if (mat) p.set("mat", mat); if (sizes[0]) p.set("size", sizes[0]);
      go("#/quick-order?" + p);
    });
  }

  // ---------- carousel (best value, you may also like) ----------
  function carousel(title, items) {
    if (!items.length) return "";
    return `<section class="carousel"><div class="car-head"><h2 class="sec-title">${esc(title)}</h2>
      <span><button type="button" class="car-arrow" data-car="-1" aria-label="Previous">‹</button><button type="button" class="car-arrow" data-car="1" aria-label="Next">›</button></span></div>
      <div class="car-track">${items.map(it => `<article class="mini card" data-sku="${it.sku}">
        <a href="#/p/${it.sku}">${pic(it.dept)}</a>${badge(it)}
        <h3><a href="#/p/${it.sku}">${esc(it.title)}</a> <span class="code">(${it.sku})</span></h3>
        ${priceHtml(it)}
        <input type="hidden" class="qty-in" value="1"><button class="btn btn-add" type="button" data-add>${t("addBasket")}</button></article>`).join("")}</div></section>`;
  }

  // ---------- department page ----------
  function deptPage(slug) {
    const d = DEPTS.find(x => x.slug === slug); if (!d) return notFound();
    setTitle(d.name);
    const items = ITEMS.filter(it => it.dept === d.name);
    const groups = d.groups.map(g => ({ g, n: g.types.reduce((a, id) => a + TYPES[id].count, 0) })).filter(x => x.n);
    const best = items.filter(it => it.mrp && it.p).sort((a, b) => (b.mrp - b.p) / b.mrp - (a.mrp - a.p) / a.mrp).slice(0, 12);
    const [bg] = ICON[d.name] || ["#eee"];
    main.innerHTML = crumbs([[d.name]]) + `
      <div class="dept-hero" style="background:${bg}">${pic(d.name, "dh-ic")}<div><b>${esc(deptName(d))}</b><span>${items.length.toLocaleString("en-IN")} ${t("products")} · ${esc(CFG.collectReady)} · GST bill on every order</span></div></div>
      <div class="listing">
        <aside class="side">
          <div class="intro"><h1>${esc(deptName(d))}</h1><p class="more-text">${esc(blurb(d.name, items))}</p><button class="linkbtn" type="button" data-readmore aria-expanded="false">${t("readMore")}</button></div>
          <ul class="subcats">${groups.map(({ g, n }) => `<li><a href="#/g/${g.slug}">${esc(g.name)} <small>(${n})</small></a></li>`).join("")}</ul>
        </aside>
        <section>
          <div class="gtiles">${groups.map(({ g, n }) => `<div class="gtile"><a class="gt-head" href="#/g/${g.slug}">${pic(d.name, "gt-img")}<b>${esc(g.name)}</b><small>${n} ${t("products")}</small></a>
            <ul>${g.types.map(id => TYPES[id]).filter(x => x.count).slice(0, 4).map(x => `<li><a href="#/c/${x.slug}">${esc(x.name)}</a></li>`).join("")}</ul></div>`).join("")}</div>
          ${carousel("Best value in " + d.name, best)}
        </section>
      </div>`;
    wireCommon();
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
  const sortVals = (k, vals) => {
    if (k === "Price") return vals.sort((a, b) => { const ia = PRICE_BANDS.findIndex(x => x[0] === a[0]), ib = PRICE_BANDS.findIndex(x => x[0] === b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    if (isSizeKey(k)) return vals.sort((a, b) => Sizes.value(a[0]) - Sizes.value(b[0]) || String(a[0]).localeCompare(b[0]));
    if (k === "Brand") return vals.sort((a, b) => (a[0] === "Unbranded") - (b[0] === "Unbranded") || a[0].localeCompare(b[0]));
    return vals.sort((a, b) => b[1] - a[1]);
  };

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
    const all = params.get("pp") === "all", per = all ? ALL_PAGE : PER_PAGE;
    const pages = Math.max(1, Math.ceil(items.length / per));
    const page = Math.min(pages, Math.max(1, +params.get("page") || 1));
    const shown = items.slice((page - 1) * per, page * per);
    const nSel = Object.values(sel).reduce((s, v) => s + v.size, 0) + (pmin != null || pmax != null ? 1 : 0);
    const link = mod => { const p = new URLSearchParams(params); mod(p); const s = p.toString(); return base + (s ? "?" + s : ""); };
    const toggle = f => link(p => { const allF = p.getAll("f"); p.delete("f"); (allF.includes(f) ? allF.filter(x => x !== f) : [...allF, f]).forEach(x => p.append("f", x)); p.delete("page"); });

    // live heading: one value ticked -> "3/4" UPVC Fittings" / "Ashirvad UPVC Fittings"
    const single = nSel === 1 && Object.keys(sel).length === 1 ? [...Object.values(sel)[0]][0] : null;
    const heading = single ? (o.title.toLowerCase().includes(single.toLowerCase()) ? o.title : `${single} ${o.title}`) : o.title;
    setTitle(heading);

    const counts = {};
    const facets = keys.map((k, i) => {
      const c = new Map();
      for (const it of o.items) if (passes(it, k)) { const v = facetValue(it, k); if (v) c.set(v, (c.get(v) || 0) + 1); }
      for (const v of sel[k] || []) if (!c.has(v)) c.set(v, 0);
      const vals = sortVals(k, [...c]);
      counts[k] = vals;
      // a group that can no longer narrow the list disappears
      if (k !== "Price" && !sel[k] && (vals.length === 0 || vals.length === 1 && vals[0][1] === items.length)) return "";
      const id = base + "|" + k;
      const open = state.open[id] ?? (i < 4 || !!sel[k] || k === "Price" && (pmin != null || pmax != null));
      const chosen = [...(sel[k] || [])].join(", ");
      const opts = vals.map(([v, n], j) => {
        const on = sel[k]?.has(v);
        const sw = /colour/i.test(k) ? `<span class="swatch" style="background:${CAT.colours[v] || "#ddd"}"></span>` : "";
        return `<li${j >= 6 ? ' class="extra"' : ""}><a class="opt" role="checkbox" aria-checked="${!!on}" href="${toggle(`${k}~${v}`)}" data-nav="results" data-f="${esc(k)}~${esc(v)}"><span class="box" aria-hidden="true"></span>${sw}<span>${esc(v)} <span class="c">(${n})</span></span></a></li>`;
      }).join("");
      const more = vals.length > 6 ? `<li class="more"><button type="button" class="linkbtn" data-more>${t("viewAll")} (${vals.length})</button></li>` : "";
      const range = k === "Price" ? `<form class="price-range" data-range><label>₹<input name="pmin" id="pmin" inputmode="numeric" placeholder="Min" value="${pmin ?? ""}" aria-label="Minimum price"></label>–<label>₹<input name="pmax" id="pmax" inputmode="numeric" placeholder="Max" value="${pmax ?? ""}" aria-label="Maximum price"></label><button class="btn-go">${t("go")}</button></form>` : "";
      const label = k === "Price" ? `${t("price")} (${state.exGst ? t("exGst") : t("incGst")})` : k;
      return `<div class="facet${open ? "" : " closed"}${state.solo === id ? " solo" : ""}" data-facet="${esc(id)}">
        <button type="button" class="fh" aria-expanded="${open}"><span>${esc(label)}${chosen ? `<small class="chosen">${esc(chosen)}</small>` : ""}</span></button>
        <div class="solo-bar"><button type="button" class="linkbtn" data-solo-back>← ${t("back")}</button><b>${esc(label)}</b><button type="button" class="btn btn-primary btn-sm" data-solo-back>${t("done")}</button></div>
        <ul class="opts">${opts}${more}</ul>${range}</div>`;
    }).join("");

    // Shop by tiles: the first (size-first) group, most common values, one tap away
    const sbKey = keys.find(k => k !== "Price" && counts[k]?.length >= 3);
    const sbVals = sbKey ? [...counts[sbKey]].sort((a, b) => b[1] - a[1]).slice(0, 8).sort((a, b) => isSizeKey(sbKey) ? Sizes.value(a[0]) - Sizes.value(b[0]) : 0) : [];
    const shopBy = !nSel && sbVals.length >= 3 ? `<div class="shopby"><h2>${t("shopBy")} ${esc(sbKey.replace(/ \(.*\)$/, "").toLowerCase())}</h2><div class="sb-row">${sbVals.map(([v, n]) =>
      `<a class="sb-tile" href="${toggle(`${sbKey}~${v}`)}" data-nav="results"><b>${esc(v)}</b><small>${n} ${t("products")}</small></a>`).join("")}</div></div>` : "";

    const chips = Object.entries(sel).flatMap(([k, vs]) => [...vs].map(v => `<a class="chip" href="${toggle(`${k}~${v}`)}" data-nav="results">${esc(v)}</a>`)).join("") +
      (pmin != null || pmax != null ? `<a class="chip" href="${link(p => { p.delete("pmin"); p.delete("pmax"); })}" data-nav="results">${pmin != null ? inr(pmin) : "₹0"} – ${pmax != null ? inr(pmax) : "any"}</a>` : "");
    const sortSel = id => `<label class="sort" for="${id}">${t("sortBy")} <select id="${id}" data-sort>${[["rec", t("rec")], ["price-desc", t("priceHi")], ["price-asc", t("priceLo")], ["brand-az", t("brandAz")], ["brand-za", t("brandZa")]]
      .map(([v, l]) => `<option value="${v}" ${v === sort ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
    const perPage = items.length > PER_PAGE ? `<div class="perpage">${t("perPage")} <a href="${link(p => { p.delete("pp"); p.delete("page"); })}" class="${!all ? "on" : ""}" data-nav="results">${PER_PAGE}</a><span class="bar"></span><a href="${link(p => { p.set("pp", "all"); p.delete("page"); })}" class="${all ? "on" : ""}" data-nav="results">${t("all")}</a></div>` : "";
    const pager = pages > 1 ? `<nav class="pager" aria-label="Pages">
      ${page > 1 ? `<a href="${link(p => p.set("page", page - 1))}" data-nav="results" rel="prev">◂ ${t("prev")}</a>` : `<span class="off">◂ ${t("prev")}</span>`}
      ${Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - page) <= 2)
        .map((n, i, a) => (i && n - a[i - 1] > 1 ? "<span>…</span>" : "") + (n === page ? `<span class="on" aria-current="page">${n}</span>` : `<a href="${link(p => p.set("page", n))}" data-nav="results">${n}</a>`)).join("")}
      ${page < pages ? `<a href="${link(p => p.set("page", page + 1))}" data-nav="results" rel="next">${t("next")} ▸</a>` : `<span class="off">${t("next")} ▸</span>`}
      <span class="pg-of">${t("page")} ${page} ${t("of")} ${pages}</span></nav>` : "";
    const crumbList = nSel ? [...o.crumbs.slice(0, -1), [o.crumbs[o.crumbs.length - 1][0], base]] : o.crumbs.slice(0, -1);
    const clearHref = base + (params.get("q") ? "?q=" + encodeURIComponent(params.get("q")) : "");

    main.innerHTML = crumbs(crumbList) + `
      <div class="listing">
        <aside class="side${state.drawer ? " drawer" : ""}${state.solo ? " has-solo" : ""}" id="side" aria-label="${t("filters")}">
          <div class="drawer-head"><button type="button" class="linkbtn" data-drawer aria-label="${t("close")}">✕</button><b>${t("filters")}</b>${nSel ? `<a href="${clearHref}" data-nav="results">${t("clearAll")}</a>` : "<span></span>"}</div>
          <div class="intro${nSel ? " filtered" : ""}"><h1><span class="h-text">${esc(heading)}</span> <small>(${items.length})</small></h1>
            ${nSel ? "" : `<p class="more-text">${esc(o.intro)}</p><button class="linkbtn" type="button" data-readmore aria-expanded="false">${t("readMore")}</button>`}</div>
          ${o.subcats && o.subcats.length ? `<h2 class="side-h">${t("categories")}</h2><ul class="subcats">${o.subcats.map(([l, h, n, on]) => `<li><a href="${h}"${on ? ' aria-current="page"' : ""}>${esc(l)} <small>(${n})</small></a></li>`).join("")}</ul>` : ""}
          <div class="filters-head"><h2>${t("filters")} <small>(${nSel} ${t("applied")})</small></h2>${nSel ? `<a href="${clearHref}" data-nav="results">${t("clearAll")}</a>` : ""}</div>
          ${facets}
          <div class="drawer-apply"><button class="btn btn-primary" type="button" data-drawer>${nSel ? `${t("apply")} (${items.length})` : t("close")}</button></div>
        </aside>
        <section id="results">
          ${o.banner || ""}
          ${shopBy}
          <div class="mob-bar"><label class="btn btn-ghost mob-sort">${t("sortBy")}<select data-sort aria-label="${t("sortBy")}">${[["rec", t("rec")], ["price-desc", t("priceHi")], ["price-asc", t("priceLo")], ["brand-az", t("brandAz")], ["brand-za", t("brandZa")]]
            .map(([v, l]) => `<option value="${v}" ${v === sort ? "selected" : ""}>${l}</option>`).join("")}</select></label><button class="btn btn-primary" type="button" data-drawer>${t("filter")} (${nSel})</button></div>
          ${chips ? `<div class="chips">${chips}</div>` : ""}
          <div class="results-bar"><span class="count"><b>${items.length}</b> ${t("products")}</span>${sortSel("sort-top")}${perPage}</div>
          ${pager}
          ${shown.length ? `<div class="grid">${shown.map(card).join("")}</div>` : `<div class="empty">${t("noResults")}</div>`}
          ${pager}
          <div class="results-bar">${sortSel("sort-bottom")}${perPage}</div>
          ${nSel ? "" : `<div class="seo"><h2>${esc(o.title)}</h2><p>${esc(o.seo || o.intro)}</p></div>`}
        </section>
      </div>`;
    state.lastListing = location.hash;

    const side = $("#side");
    document.body.classList.toggle("noscroll", state.drawer && isPhone());
    $("#overlay").hidden = true;
    side.addEventListener("click", e => {
      const fh = e.target.closest(".fh");
      if (fh) {
        const fc = fh.parentElement;
        if (side.classList.contains("drawer") && isPhone()) { state.solo = fc.dataset.facet; fc.classList.add("solo"); side.classList.add("has-solo"); side.scrollTop = 0; return; }
        const open = fc.classList.toggle("closed") === false; state.open[fc.dataset.facet] = open; fh.setAttribute("aria-expanded", open);
      }
      if (e.target.closest("[data-solo-back]")) { state.solo = null; $$(".facet.solo", side).forEach(f => f.classList.remove("solo")); side.classList.remove("has-solo"); }
      const m = e.target.closest("[data-more]");
      if (m) { const ul = m.closest(".opts"); ul.classList.add("show-all"); m.parentElement.remove(); }
    });
    side.addEventListener("submit", e => {
      if (!e.target.matches("[data-range]")) return; e.preventDefault();
      const mn = e.target.pmin.value.replace(/[^\d.]/g, ""), mx = e.target.pmax.value.replace(/[^\d.]/g, "");
      go(link(p => { mn ? p.set("pmin", mn) : p.delete("pmin"); mx ? p.set("pmax", mx) : p.delete("pmax"); p.delete("page"); }), "results");
    });
    $$("[data-sort]", main).forEach(s => s.addEventListener("change", () => go(link(p => { s.value === "rec" ? p.delete("sort") : p.set("sort", s.value); p.delete("page"); }), "results")));
    $$("[data-drawer]", main).forEach(b => b.addEventListener("click", () => {
      state.drawer = !state.drawer; state.solo = null;
      side.classList.toggle("drawer", state.drawer); side.classList.remove("has-solo"); $$(".facet.solo", side).forEach(f => f.classList.remove("solo"));
      document.body.classList.toggle("noscroll", state.drawer);
    }));
    wireCommon();
  }

  function features(it) {
    const f = [];
    for (const [k, v] of Object.entries(it.a)) {
      if (k === "Brand" || /colour/i.test(k)) continue;
      f.push(`${k.replace(/ \(.*\)$/, "")}: ${v}`);
    }
    if (it.m && !it.a.Material) f.push(`Material: ${it.m}`);
    f.push(it.type.name, `Sold per ${it.u}`);
    return [...new Set(f)];
  }

  function priceHtml(it) {
    if (!it.p) return `<div class="price-row"><span class="ask">${t("askPrice")}</span></div>`;
    const save = it.mrp ? Math.round((1 - it.p / it.mrp) * 100) : 0;
    return `<div class="price-row${save ? " offer" : ""}">${save ? `<span class="flag">−${save}%</span>` : ""}<span class="price" data-price="${it.p}">${inr(showPrice(it.p))}</span>` +
      (it.mrp ? `<s>MRP ${inr(showPrice(it.mrp))}</s>` : "") + `<span class="tax">${state.exGst ? t("exGst") : t("incGst")} · ${t("per")} ${esc(it.u)}</span></div>`;
  }
  const badge = it => {
    const save = it.mrp ? Math.round((1 - it.p / it.mrp) * 100) : 0;
    return save >= 10 ? `<span class="badge mrp">${save}% off MRP</span>` : "";
  };
  const qtyBox = (it, cls = "") => `<div class="qty ${cls}"><button type="button" data-step="-1" aria-label="Less">−</button><input class="qty-in" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="1" aria-label="Quantity"${typeof it.st === "number" ? ` data-max="${it.st}"` : ""}><button type="button" data-step="1" aria-label="More">+</button></div>`;
  const fulfil = it => `<div class="fulfil" role="radiogroup" aria-label="Collect or deliver">
      <label><input type="radio" name="f_${it.sku}" value="collect" checked>${t("collect")}</label>
      <label><input type="radio" name="f_${it.sku}" value="deliver">${t("deliver")}</label></div>`;
  const serviceLines = it => `<div class="svc"><div><b>${t("collect")}:</b> ${esc(CFG.collectReady)} · ${esc(CFG.hours)}</div><div><b>${t("deliver")}:</b> ${deliveryInfo()}</div></div>`;

  function card(it) {
    const n = state.compare.length, on = state.compare.includes(it.sku);
    return `<article class="card" data-sku="${it.sku}">
      <h3><a href="#/p/${it.sku}">${esc(it.title)}</a> <span class="code">(${it.sku})</span></h3>
      <a class="img-link" href="#/p/${it.sku}" tabindex="-1" aria-hidden="true">${pic(it.dept)}</a>
      ${badge(it)}
      <div class="card-mid">
        <a class="stars" href="#/p/${it.sku}?tab=reviews"><span aria-hidden="true">☆☆☆☆☆</span> ${t("noReviews")}</a>
        <ul class="feats">${features(it).slice(0, 3).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
        ${it.c ? `<span class="colour"><i style="background:${CAT.colours[it.c]}"></i>${esc(it.c)}</span>` : ""}
        <label class="cmp"><input type="checkbox" data-compare ${on ? "checked" : ""}> ${t("compare")} <span class="cmp-n">(${n}/${CMP_MAX})</span></label>
      </div>
      <div class="buy">
        <div class="buy-row">${qtyBox(it)}${priceHtml(it)}</div>
        ${stockLine(it)}
        ${fulfil(it)}
        ${serviceLines(it)}
        <button class="btn btn-add" type="button" data-add>${t("addBasket")}</button>
        <a class="btn btn-wa" href="${waLink(`Hello, I want: ${it.title} (${it.sku})`)}" target="_blank" rel="noopener">${t("whatsapp")}</a>
        <a class="btn btn-primary cmp-go" href="#/compare"${on && n >= 2 ? "" : " hidden"}>${t("compareNow")}</a>
      </div>
    </article>`;
  }

  function typePage(slug, params) {
    const ty = TYPES.find(x => x.slug === slug); if (!ty) return notFound();
    const d = DEPTS.find(x => x.name === ty.dept), g = d.groups.find(x => x.types.includes(ty.id));
    const items = ITEMS.filter(it => it.t === ty.id).sort((a, b) => a.sv - b.sv || a.n.localeCompare(b.n));
    listing({
      params, base: `#/c/${slug}`, title: ty.name, items, keys: ty.filters,
      crumbs: [[d.name, `#/d/${d.slug}`], [g.name, `#/g/${g.slug}`], [ty.name]],
      intro: blurb(ty.name, items), seo: seoText(ty.name, items),
    });
  }

  function groupPage(slug, params) {
    let d, g; for (const dd of DEPTS) { const gg = dd.groups.find(x => x.slug === slug); if (gg) { d = dd; g = gg; } }
    if (!g) return notFound();
    const items = ITEMS.filter(it => it.gslug === slug).sort((a, b) => a.t - b.t || a.sv - b.sv || a.n.localeCompare(b.n));
    const keys = ["Product Type"];
    for (const id of g.types) for (const k of TYPES[id].filters) if (!keys.includes(k)) keys.push(k);
    keys.sort((a, b) => (a === "Product Type" ? -2 : isSizeKey(a) ? -1 : 0) - (b === "Product Type" ? -2 : isSizeKey(b) ? -1 : 0));
    listing({
      params, base: `#/g/${slug}`, title: g.name, items, keys,
      crumbs: [[d.name, `#/d/${d.slug}`], [g.name]], intro: blurb(g.name, items), seo: seoText(g.name, items),
      subcats: g.types.map(id => TYPES[id]).filter(x => x.count).map(x => [x.name, `#/c/${x.slug}`, x.count]),
    });
  }

  function searchPage(params) {
    const q = params.get("q") || "";
    const { items, sizes, corrected, original } = search(q, params.get("exact"));
    const types = new Map(); for (const it of items) types.set(it.t, (types.get(it.t) || 0) + 1);
    const banner = (corrected ? `<div class="sizebanner">Showing results for <b>${esc(corrected)}</b>. ` +
      (original ? `<a href="#/search?q=${encodeURIComponent(q)}&exact=1">Search for “${esc(q)}” instead (${original})</a>` : `No results for “${esc(q)}”.`) + `</div>` : "") +
      (sizes.length ? `<div class="sizebanner">Showing size <b>${sizes.map(Sizes.label).join(" × ")}</b>. We read <i>${esc(q)}</i> the shop way: 3x4 = 3/4", 11/2 = 1 1/2", M8 = 8 mm, and match the mm size for each pipe type (UPVC 3/4" = 20 mm, PVC 3/4" = 25 mm).</div>` : "");
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
  function productPage(sku, params) {
    const it = BY_SKU.get(sku); if (!it) return notFound();
    const d = DEPTS.find(x => x.name === it.dept);
    setTitle(it.title);
    const specs = [[t("code"), it.sku], ["Brand", it.b], ["Category", `${it.group} › ${it.type.name}`], ...Object.entries(it.a).filter(([k]) => k !== "Brand"),
      ...(it.m && !it.a.Material ? [["Material", it.m]] : []), ...(it.c ? [["Colour", it.c]] : []), ["Sold per", it.u], ["Shop name", it.raw]];
    const related = ITEMS.filter(x => x !== it && x.t === it.t && it.sz.length && x.sz[0] === it.sz[0]);
    const like = [...related, ...ITEMS.filter(x => x !== it && x.t === it.t && !related.includes(x))].slice(0, 12);
    const tab = params.get("tab") || "specs";
    const desc = `${it.title} from ${it.b === "Unbranded" ? "our shop range" : it.b}. ${it.type.name} in our ${it.group.toLowerCase()} range${it.a["Size (inch)"] ? `, size ${it.a["Size (inch)"]}` : ""}${it.m ? `, ${it.m}` : ""}. Sold per ${it.u}, with a GST bill.`;
    main.innerHTML = crumbs([[it.dept, `#/d/${d.slug}`], [it.group, `#/g/${it.gslug}`], [it.type.name, `#/c/${it.type.slug}`], [it.title]]) + `
      <div class="pdp">
        <div class="gallery">
          <div class="main-img">${pic(it.dept, "img")}${badge(it)}<button type="button" class="zoom" data-zoom aria-label="Zoom image">⤢</button></div>
          <div class="thumbs"><button type="button" class="on" aria-label="Picture 1">${pic(it.dept, "th")}</button></div>
          <p class="note">Photo coming soon. The picture shows the department.</p>
        </div>
        <div class="details">
          <h1>${esc(it.title)} <span class="code">(${it.sku})</span></h1>
          <p class="rv-line"><a href="#tabs" data-tab-link="reviews"><span aria-hidden="true">☆☆☆☆☆</span> ${t("noReviews")}</a> · <button type="button" class="linkbtn" data-ask>Ask a question</button></p>
          <p>${esc(desc)}</p>
          <ul class="feats">${features(it).slice(0, 6).map(f => `<li>${esc(f)}</li>`).join("")}</ul>
          ${it.b !== "Unbranded" ? `<a class="viewall" href="#/c/${it.type.slug}?f=${encodeURIComponent("Brand~" + it.b)}">${t("viewAll")}: ${esc(it.b)} ${esc(it.type.name)}</a>` : ""}
        </div>
        <div class="buybox card" data-sku="${it.sku}">
          ${priceHtml(it)}
          ${qtyBox(it)}
          ${stockLine(it)}
          ${fulfil(it)}
          ${serviceLines(it)}
          <button class="btn btn-add" type="button" data-add>${t("addBasket")}</button>
          <a class="btn btn-wa" href="${waLink(`Hello, I want: ${it.title} (${it.sku})`)}" target="_blank" rel="noopener">${t("whatsapp")}</a>
          <label class="cmp"><input type="checkbox" data-compare ${state.compare.includes(it.sku) ? "checked" : ""}> ${t("compare")} <span class="cmp-n">(${state.compare.length}/${CMP_MAX})</span></label>
        </div>
      </div>
      ${carousel("You may also like", like)}
      <section class="tabs" id="tabs">
        <div role="tablist" aria-label="Product information">
          ${[["reviews", "Reviews"], ["questions", "Questions"], ["specs", "Specifications"]].map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="panel-${k}" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join("")}
        </div>
        <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews"${tab === "reviews" ? "" : " hidden"}><p>${t("noReviews")}. Bought this? Tell us how it went on WhatsApp and we will add your review.</p></div>
        <div role="tabpanel" id="panel-questions" aria-labelledby="tab-questions"${tab === "questions" ? "" : " hidden"}><p>No questions yet.</p><button type="button" class="btn btn-primary" data-ask>Ask a question</button></div>
        <div role="tabpanel" id="panel-specs" aria-labelledby="tab-specs"${tab === "specs" ? "" : " hidden"}><table class="specs">${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table></div>
      </section>`;
    const showTab = k => {
      $$("[data-tab]", main).forEach(b => b.setAttribute("aria-selected", b.dataset.tab === k));
      $$("[role=tabpanel]", main).forEach(p => { p.hidden = p.id !== "panel-" + k; });
    };
    $$("[data-tab]", main).forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
    $$("[data-tab-link]", main).forEach(a => a.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); showTab(a.dataset.tabLink); $("#tabs").scrollIntoView(); }));
    if (params.get("tab")) requestAnimationFrame(() => $("#tabs").scrollIntoView());
    $("[data-zoom]", main).addEventListener("click", () => modal(`<div class="viewer">${pic(it.dept, "img")}<div class="thumbs"><button type="button" class="on" aria-label="Picture 1">${pic(it.dept, "th")}</button></div></div><div class="modal-actions"><button class="btn btn-primary" type="button" data-close>${t("close")}</button></div>`));
    $$("[data-ask]", main).forEach(b => b.addEventListener("click", () => modal(`<h2>Ask a question</h2><p class="note">About ${esc(it.title)} (${it.sku})</p>
      <form id="ask-form"><label class="field">Your question<textarea name="q" maxlength="255" rows="3" required></textarea></label>
      <label class="field">Your name<input name="name" maxlength="25" required></label>
      <div class="modal-actions"><button class="btn btn-primary">Send on WhatsApp</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div></form>`, (m, close) => {
      m.querySelector("form").addEventListener("submit", e => {
        e.preventDefault(); const f = e.target;
        const text = `Question about ${it.title} (${it.sku}) from ${f.name.value}: ${f.q.value}`;
        if (CFG.whatsapp) window.open(waLink(text), "_blank", "noopener"); else toast("The shop's WhatsApp number is not set up yet.");
        close();
      });
    })));
    wireCommon();
  }

  // ---------- compare ----------
  function comparePage() {
    setTitle(t("compare"));
    const items = state.compare.map(s => BY_SKU.get(s)).filter(Boolean);
    const rows = [["Price", it => it.p ? inr(showPrice(it.p)) : t("askPrice")], ["Brand", it => it.b], ["Product type", it => it.type.name], ["Material", it => it.m || it.a.Material || "—"]];
    const keys = []; for (const it of items) for (const k of Object.keys(it.a)) if (!keys.includes(k) && k !== "Brand" && k !== "Material") keys.push(k);
    for (const k of keys) rows.push([k, it => it.a[k] || "—"]);
    rows.push(["Sold per", it => it.u], [t("code"), it => it.sku]);
    const slots = Array.from({ length: CMP_MAX }, (_, i) => items[i]);
    main.innerHTML = crumbs([[t("compare")]]) + `<p class="back-link"><a href="${state.lastListing}">‹ Back to listings</a></p>
      <div class="cmp-head"><h1>${t("compare")} <small>(${items.length}/${CMP_MAX})</small></h1>
        <label class="gst"><input type="checkbox" id="cmp-diff"> Highlight differences</label>
        <button type="button" class="linkbtn" data-cmp-clear-return>Clear all and return to listings</button></div>
      <div class="cmp-wrap"><table class="cmp-table">
        <thead><tr><th></th>${slots.map(it => it ? `<th><div class="cmp-slot">${pic(it.dept)}<a href="#/p/${it.sku}">${esc(it.title)}</a><button type="button" class="rm" data-cmp-rm="${it.sku}" aria-label="Remove ${esc(it.n)}">×</button></div></th>`
          : `<th><a class="cmp-slot empty-slot" href="${state.lastListing}"><span>+</span>Add a product</a></th>`).join("")}</tr></thead>
        <tbody>${rows.map(([k, fn]) => { const vals = slots.map(it => it ? fn(it) : ""); const diff = new Set(vals.filter((v, i) => slots[i])).size > 1;
          return `<tr class="${diff ? "diff" : ""}"><th>${esc(k)}</th>${vals.map(v => `<td>${esc(v)}</td>`).join("")}</tr>`; }).join("")}</tbody>
      </table></div>`;
    $("#cmp-diff").addEventListener("change", e => $(".cmp-table").classList.toggle("hl", e.target.checked));
    $$("[data-cmp-rm]", main).forEach(b => b.addEventListener("click", () => { toggleCompare(b.dataset.cmpRm, false); comparePage(); }));
    $("[data-cmp-clear-return]").addEventListener("click", () => { state.compare = []; store.set("compare", []); renderCompareBits(); go(state.lastListing); });
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
          <a href="${qp("", size)}" class="${!mat ? "on" : ""}" data-nav="keep">Any</a>
          ${MATS().map(m => `<a href="${qp(m, size)}" class="${m === mat ? "on" : ""}" data-nav="keep">${esc(m)}</a>`).join("")}</div></div>
        <div class="qo-step"><h2><i>2</i>Size</h2><div class="pick">
          ${sizes.map(s => `<a href="${qp(mat, s)}" class="${s === size ? "on" : ""}" data-nav="keep">${esc(Sizes.label(s))}<small>${sizeCount[s]}</small></a>`).join("") || "<span class='note'>No sizes for this material.</span>"}</div>
          <form class="qo-type" id="qo-type"><input name="s" id="qo-size" placeholder="or type a size: 3x4, 11/2, 25mm" aria-label="Type a size"><button class="btn btn-primary">${t("go")}</button></form></div>
        <div class="qo-step"><h2><i>3</i>Quantities ${size ? `<small class="qo-sum">${esc(mat || "All materials")} · ${esc(Sizes.label(size))}${esc(mmNote)} · ${items.length} items</small>` : ""}</h2>
          ${!size ? `<p class="note">Choose a size to see every fitting, pipe, valve and tank connector in that size.</p>` : items.length ? [...byType].map(([k, list]) => `
            <div class="qo-scroll"><table class="qo-table"><caption>${esc(k)} (${list.length})</caption>
              <thead><tr><th>Item</th><th class="hide-sm">Brand</th><th class="num">${t("price")}</th><th class="num">Qty</th></tr></thead>
              <tbody>${list.map(it => `<tr data-sku="${it.sku}"><td><a href="#/p/${it.sku}">${esc(it.n)}</a> <span class="note">${it.sku}</span></td><td class="hide-sm">${esc(it.b)}</td>
                <td class="num">${it.p ? inr(showPrice(it.p)) + ` <span class="note">/${esc(it.u)}</span>` : `<span class="note">${t("askPrice")}</span>`}</td>
                <td class="num"><input type="text" inputmode="numeric" maxlength="4" aria-label="Quantity for ${esc(it.n)}" data-qo></td></tr>`).join("")}</tbody></table></div>`).join("")
            : `<p class="note">${t("noResults")}</p>`}
        </div>
      </div>
      ${items.length ? `<div class="qo-bar"><span><b id="qo-lines">0</b> lines · <b id="qo-total">₹0</b> <small>${state.exGst ? t("exGst") : t("incGst")}</small></span><button class="btn btn-amber" type="button" id="qo-add" disabled>Add all to basket</button></div>` : ""}`;
    $("#qo-type").addEventListener("submit", e => {
      e.preventDefault(); const { sizes: s } = Sizes.parse(e.target.s.value);
      if (!s.length) { toast("Could not read that size. Try 3x4, 1 1/2 or 25mm."); return; }
      let tok = s[0];
      if (tok.endsWith("mm")) { const hit = pool.find(it => it.sz.includes(tok)); tok = hit?.sz.find(x => x.endsWith("in") && hit.sz.indexOf(x) <= 1) || tok; }
      go(qp(mat, tok), "keep");
    });
    const recalc = () => {
      let lines = 0, total = 0;
      $$("[data-qo]", main).forEach(inp => {
        inp.value = inp.value.replace(/\D/g, "").slice(0, 4);
        const q = +inp.value || 0; const tr = inp.closest("tr"); tr.classList.toggle("has", q > 0);
        if (q > 0) { lines++; total += showPrice(BY_SKU.get(tr.dataset.sku).p) * q; }
      });
      if ($("#qo-lines")) { $("#qo-lines").textContent = lines; $("#qo-total").textContent = inr(Math.round(total * 100) / 100); $("#qo-add").disabled = !lines; }
    };
    main.oninput = e => { if (e.target.matches("[data-qo]")) recalc(); };
    $("#qo-add")?.addEventListener("click", () => {
      let n = 0;
      $$("[data-qo]", main).forEach(inp => { const q = +inp.value || 0; if (q > 0) { addToBasket(inp.closest("tr").dataset.sku, q, "collect", true); n++; inp.value = ""; } });
      recalc(); toast(`${n} lines ${t("added").toLowerCase()} <a href="#/basket">${t("viewBasket")}</a>`);
    });
  }

  // ---------- basket + checkout ----------
  function basketPage() {
    setTitle(t("basket"));
    main.oninput = null;
    const lines = state.basket.map(l => ({ ...l, it: BY_SKU.get(l.sku) })).filter(l => l.it);
    const total = lines.reduce((s, l) => s + showPrice(l.it.p) * l.qty, 0);
    const ask = lines.filter(l => !l.it.p).length;
    const wantsDelivery = lines.some(l => l.f === "deliver");
    main.innerHTML = crumbs([[t("basket")]]) + `<h1>${t("basket")} <small>(${lines.length})</small></h1>` + (!lines.length ? `<div class="empty"><p>Your basket is empty.</p><a class="btn btn-primary" href="#/">${t("home")}</a> <a class="btn btn-amber" href="#/quick-order">${t("quickOrder")}</a></div>` : `
      <div class="basket">
        <div class="bl">${lines.map(l => `<div class="bl-row" data-sku="${l.sku}">${pic(l.it.dept)}
          <div><a href="#/p/${l.sku}">${esc(l.it.title)}</a><div class="note">${l.sku} · ${l.f === "deliver" ? t("deliver") : t("collect")} · ${l.it.p ? inr(showPrice(l.it.p)) + " / " + esc(l.it.u) : t("askPrice")}</div></div>
          <div class="qty"><button type="button" data-bstep="-1" aria-label="Less">−</button><input type="text" inputmode="numeric" maxlength="4" value="${l.qty}" data-bqty aria-label="Quantity"><button type="button" data-bstep="1" aria-label="More">+</button></div>
          <b>${l.it.p ? inr(Math.round(showPrice(l.it.p) * l.qty * 100) / 100) : "—"}</b>
          <button class="rm" type="button" data-rm>Remove</button></div>`).join("")}</div>
        <form class="co" id="checkout">
          <div class="total"><span>Total</span><span>${inr(Math.round(total * 100) / 100)}</span></div>
          <span class="note">${state.exGst ? t("exGst") : t("incGst")}${ask ? ` · ${ask} item(s) priced by the shop` : ""}</span>
          <label>Your name<input name="name" id="co-name" required autocomplete="name"></label>
          <label>Mobile number<input name="phone" id="co-phone" required inputmode="tel" autocomplete="tel" pattern="[0-9+ ]{10,15}"></label>
          <label>How do you want it?<select name="fulfilment" id="co-ful"><option value="collect">Reserve and collect at the shop</option><option value="delivery" ${wantsDelivery ? "selected" : ""}>Home delivery</option><option value="quote">Send me a bulk price quote</option></select></label>
          <label>PIN code (for delivery)<input name="pin" id="co-pin" inputmode="numeric" maxlength="6" value="${esc(state.pin)}"></label>
          <label>Delivery address (for delivery)<textarea name="address" id="co-addr" rows="2"></textarea></label>
          <label>Note<textarea name="note" id="co-note" rows="2" placeholder="Brand preference, timing..."></textarea></label>
          ${!CFG.whatsapp && !CFG.supabaseUrl ? `<div class="warn">Shop setup: add the WhatsApp number in js/config.js so orders reach the shop.</div>` : ""}
          <button class="btn btn-add">${CFG.supabaseUrl ? "Place order" : "Send order on WhatsApp"}</button>
          <span class="note">No payment now. The shop confirms stock and price, then you pay at the counter or on delivery.</span>
        </form>
      </div>`);
    const setQty = (sku, q) => { const l = state.basket.find(x => x.sku === sku); if (l) { l.qty = Math.min(9999, Math.max(1, q)); saveBasket(); basketPage(); } };
    $$(".bl-row", main).forEach(row => {
      const sku = row.dataset.sku;
      $$("[data-bstep]", row).forEach(b => b.addEventListener("click", () => setQty(sku, (+$("[data-bqty]", row).value || 1) + +b.dataset.bstep)));
      $("[data-bqty]", row).addEventListener("change", e => setQty(sku, Math.floor(+e.target.value.replace(/\D/g, "") || 1)));
      $("[data-rm]", row).addEventListener("click", () => { state.basket = state.basket.filter(x => x.sku !== sku); saveBasket(); basketPage(); });
    });
    $("#checkout")?.addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target;
      if (f.pin.value) { state.pin = f.pin.value.replace(/\D/g, "").slice(0, 6); store.set("pin", state.pin); }
      const data = { customer_name: f.name.value.trim(), phone: f.phone.value.trim(), fulfilment: f.fulfilment.value, address: [f.address.value.trim(), state.pin].filter(Boolean).join(", ") || null, note: f.note.value.trim() || null, items: lines.map(l => ({ sku: l.sku, qty: l.qty })) };
      const text = `Order from website\nName: ${data.customer_name}\nPhone: ${data.phone}\n${f.fulfilment.selectedOptions[0].text}${data.address ? "\nAddress: " + data.address : ""}\n\n` +
        lines.map(l => `${l.qty} x ${l.it.title} (${l.sku})${l.it.p ? " @ " + inr(l.it.p) : ""}`).join("\n") + `\n\nTotal ${inr(Math.round(lines.reduce((s, l) => s + l.it.p * l.qty, 0)))} inc GST${data.note ? "\nNote: " + data.note : ""}`;
      let orderNo = null;
      try { orderNo = await ShopData.placeOrder(data); } catch (err) { toast("Could not reach the shop system, sending on WhatsApp instead."); }
      main.innerHTML = `<div class="ok-box"><h1>${orderNo ? `Order ${esc(orderNo)} received` : "Almost done"}</h1>
        <p>${orderNo ? "The shop will call you to confirm stock and price." : "Send this order to the shop on WhatsApp. The shop will confirm stock and price."}</p>
        ${CFG.whatsapp ? `<a class="btn btn-add" style="max-width:320px" target="_blank" rel="noopener" href="${waLink((orderNo ? `Order ${orderNo}\n` : "") + text)}">Open WhatsApp</a>` : `<pre class="order-text">${esc(text)}</pre>`}
        <p><button class="linkbtn" type="button" id="clear-basket">Empty my basket</button></p></div>`;
      if (orderNo) { state.basket = []; saveBasket(); }
      $("#clear-basket").addEventListener("click", () => { state.basket = []; saveBasket(); go("#/"); });
    });
  }

  // ---------- info pages ----------
  function infoPage(v) {
    const contact = `${CFG.address ? `<p><b>Address:</b> ${esc(CFG.address)}</p>` : `<p class="warn">Shop address not set yet (js/config.js).</p>`}
      <p><b>Opening hours:</b> ${esc(CFG.hours)}</p><p><b>Collection:</b> ${esc(CFG.collectReady)}</p>${CFG.phone ? `<p><b>Phone:</b> <a href="tel:${esc(CFG.phone)}">${esc(CFG.phone)}</a></p>` : ""}
      <p><b>Delivery:</b> ${deliveryInfo()}</p>
      ${CFG.whatsapp ? `<p><a class="btn btn-wa" style="max-width:260px" href="${waLink("Hello")}">WhatsApp us</a></p>` : ""}`;
    const pages = {
      store: [t("store"), contact],
      account: [t("account"), `<p>Customer accounts (saved addresses, past orders, trade prices) will come when the shop switches on online sign-in.</p><p>For now, order with the basket or Quick order and the shop confirms on WhatsApp or phone.</p>`],
      help: [t("help"), `<h2 class="sec-title">Searching by size</h2>
        <p>Type sizes the way you say them at the counter. <b>3x4</b> or <b>3/4</b> or <b>½</b> means 3/4 or 1/2 inch. <b>11/2</b> means 1 1/2 inch, <b>21/2</b> means 2 1/2 inch. <b>4x2</b> means a 4 inch to 2 inch reducer. <b>8mm</b>, <b>8 mm</b> and <b>M8</b> are the same size. For pipes, millimetres match the right inch size for each pipe type (UPVC/CPVC 3/4" = 20 mm, PVC 3/4" = 25 mm, GI 3/4" = 20 mm NB).</p>
        <h2 class="sec-title">Prices and GST</h2><p>Prices include GST. Trade buyers can switch to "ex GST" at the top of the page. Every order gets a GST bill.</p>
        <h2 class="sec-title">Collect or delivery</h2><p>Add items to the basket and send the order. The shop confirms stock and price, then you collect at the counter or we deliver locally.</p>` + contact],
    };
    const [title, body] = pages[v];
    setTitle(title);
    main.innerHTML = crumbs([[title]]) + `<h1>${esc(title)}</h1><div class="seo">${body}</div>`;
  }

  // ---------- events shared by pages ----------
  function wireCommon() {
    $$("[data-readmore]", main).forEach(b => b.addEventListener("click", () => {
      const intro = b.closest(".intro"); const x = intro.classList.toggle("expanded");
      b.textContent = x ? t("readLess") : t("readMore"); b.setAttribute("aria-expanded", x);
    }));
    $$(".carousel", main).forEach(c => $$("[data-car]", c).forEach(b => b.addEventListener("click", () => {
      const tr = $(".car-track", c); tr.scrollBy({ left: +b.dataset.car * tr.clientWidth * 0.9, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    })));
  }
  main.addEventListener("click", e => {
    const step = e.target.closest("[data-step]");
    if (step) {
      const inp = step.parentElement.querySelector("input");
      const max = inp.dataset.max ? +inp.dataset.max : 9999;
      const v = (Math.floor(+inp.value) || 1) + +step.dataset.step;
      if (v > max) toast(`Only ${max} in stock.`);
      inp.value = Math.min(max, Math.max(1, v));
    }
    const add = e.target.closest("[data-add]");
    if (add) {
      const c = add.closest("[data-sku]");
      const q = Math.max(1, Math.floor(+(c.querySelector(".qty-in")?.value) || 1));
      const f = c.querySelector(".fulfil input:checked")?.value || "collect";
      addToBasket(c.dataset.sku, q, f === "deliver" ? "deliver" : "collect");
    }
    if (e.target.closest("[data-pin]")) askPin();
  });
  main.addEventListener("input", e => { if (e.target.matches(".qty-in")) e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });
  main.addEventListener("change", e => {
    if (e.target.matches(".qty-in")) {
      const max = e.target.dataset.max ? +e.target.dataset.max : 9999;
      const v = Math.floor(+e.target.value) || 0;
      if (v < 1) { toast("The smallest quantity is 1."); e.target.value = 1; }
      else if (v > max) { toast(`Only ${max} in stock.`); e.target.value = max; }
    }
    if (e.target.matches("[data-compare]")) {
      const sku = e.target.closest("[data-sku]").dataset.sku;
      if (!toggleCompare(sku, e.target.checked)) e.target.checked = false;
    }
  });
  document.addEventListener("click", e => {
    if (e.target.closest("[data-cmp-clear]")) { state.compare = []; store.set("compare", []); renderCompareBits(); }
    if (e.target.closest(".compare-tray a[aria-disabled]")) { e.preventDefault(); toast("Tick at least 2 products to compare."); }
  });
  $("#gst-toggle").addEventListener("change", e => { state.exGst = e.target.checked; store.set("exgst", state.exGst); renderShell(); route("keep"); });
  $("#lang-btn").addEventListener("click", () => { state.lang = state.lang === "en" ? "ta" : "en"; store.set("lang", state.lang); renderShell(); route("keep"); });

  // ---------- start ----------
  ShopData.load().then(cat => {
    prepare(cat);
    renderShell(); wireMenu(); wirePhone(); wireSearch();
    addEventListener("hashchange", () => route());
    route();
    window.SHOP = { ITEMS, TYPES, DEPTS, search, suggestions, state };   // used by the browser tests
  }).catch(err => {
    main.innerHTML = `<div class="empty"><h1>Could not load the item list</h1><p>${esc(err.message)}</p><p class="note">If you opened index.html straight from a folder, run the small web server instead (see README).</p></div>`;
  });
})();
