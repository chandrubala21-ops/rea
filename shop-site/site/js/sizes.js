// Shop size notation. Mirrors size_tokens() in db/schema.sql; tests in tools/test_sizes.mjs.
//   3x4, 3/4, 3/4"     -> 3/4in        11/2, 1 1/2, 1.5"  -> 1-1/2in
//   4x2, 4*2           -> 4in + 2in    20mm, 20 mm        -> 20mm
(function (root) {
  const DEC = { "0.25": "1/4", "0.5": "1/2", "0.75": "3/4" };

  function decimalInch(n) {
    const whole = Math.floor(n), frac = DEC[String(+(n - whole).toFixed(2))];
    if (n === whole) return String(whole);
    if (!frac) return null;
    return whole ? `${whole}-${frac}` : frac;
  }

  function parse(q) {
    let s = " " + String(q).toLowerCase().replace(/''|”|″/g, '"')
      .replace(/(\d)?\s*([¼½¾])/g, (_, w, f) => `${w ? w + " " : " "}${{ "¼": "1/4", "½": "1/2", "¾": "3/4" }[f]}`) + " ";
    const sizes = [], extra = [];
    const take = (re, fn) => { s = s.replace(re, (...m) => { fn(m); return " "; }); };
    // cable: 4 sq mm, 10*4sqmm (4 cores x 10 sq mm is written both ways) -> word '4sqmm'
    take(/(?:\d+\s*[x*]\s*)?(\d+(?:\.\d+)?)\s*sq\.?\s*mm\b/g, m => extra.push(`${+m[1]}sqmm`));
    take(/(\d+(?:\.\d+)?)\s*-?\s*mm\b/g, m => sizes.push(`${+m[1]}mm`));   // 8mm, 8 mm, 8-mm
    take(/(^|[^a-z0-9])m(\d{1,2})(?![\d.])/g, m => sizes.push(`${+m[2]}mm`));     // M8 bolt thread = 8 mm
    // whole + fraction written with a space: 1 1/2
    take(/(^|[^\d/.])(\d{1,2})\s+(\d)\s*\/\s*([248])(?![\d/])\s*(?:"|inch\b|in\b)?/g, m => sizes.push(`${m[2]}-${m[3]}/${m[4]}in`));
    take(/(^|[^\d/.])(\d{1,2})\s*[x*/]\s*(\d{1,2})(?![\d/.])\s*(?:"|inch\b|in\b)?/g, m => {
      const a = +m[2], b = +m[3];
      if (m[2].length === 2 && a % 10 > 0 && a % 10 < b && [2, 4, 8].includes(b)) sizes.push(`${Math.floor(a / 10)}-${a % 10}/${b}in`);
      else if (a < b && [2, 4, 8, 16].includes(b)) sizes.push(`${a}/${b}in`);
      else sizes.push(`${a}in`, `${b}in`);
    });
    take(/(^|\s)(\d+(?:\.\d+)?)\s*(?:"|inch\b|in\b)/g, m => { const t = decimalInch(+m[2]); if (t) sizes.push(t + "in"); });
    const words = s.split(/[^a-z0-9஀-௿.]+/).map(w => w.replace(/^\.+|\.+$/g, "")).filter(Boolean);
    return { sizes: [...new Set(sizes)], words: [...words, ...extra] };
  }

  // '1-1/2in' -> '1 1/2"', '25mm' -> '25 mm'
  function label(tok) {
    if (tok.endsWith("mm")) return tok.slice(0, -2) + " mm";
    return tok.slice(0, -2).replace("-", " ") + '"';
  }

  // numeric value for sorting: '1 1/2"' -> 1.5, '25 mm' -> 25 (mm after inches)
  function value(v) {
    const s = String(v);
    const m = s.match(/(\d+)(?:[ -](\d+)\/(\d+))?(?:\/(\d+))?/);
    if (!m) return Infinity;
    let n = +m[1];
    if (m[2]) n += m[2] / m[3];
    if (m[4]) n = m[1] / m[4];
    if (/mm/.test(s)) n += 1000;
    return n;
  }

  root.Sizes = { parse, label, value };
})(typeof window !== "undefined" ? window : globalThis);
