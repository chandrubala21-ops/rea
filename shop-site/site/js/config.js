// Shop settings. Change these and reload the page; nothing else needs editing.
window.SHOP_CONFIG = {
  name: "Senthil Andavar Hardwares",
  nameTa: "செந்தில் ஆண்டவர் ஹார்டுவேர்ஸ்",
  tagline: "Hardware, electrical, plumbing and paint for trade and home",
  // Fill these in before going live.
  phone: "",            // e.g. "+91 98765 43210"
  whatsapp: "",         // digits only with country code, e.g. "919876543210"
  address: "",
  hours: "Mon–Sat 9am–9pm",
  // The promise strip under the menu (like the click & collect / delivery strip).
  promises: [
    { strong: "RESERVE & COLLECT", text: "ready at the counter in 30 minutes" },
    { strong: "LOCAL DELIVERY", text: "same or next day" },
    { strong: "BULK ORDERS", text: "quick order by material and size" },
  ],
  // Collection and delivery shown on every product card.
  collectReady: "Ready in 30 minutes",
  delivery: {
    pins: [],            // PIN codes the shop delivers to, e.g. ["620001", "620002"]. Empty = the shop confirms by phone.
    charge: 50,          // ₹ per order
    freeOver: 2000,      // free delivery on orders over this (₹)
    cutoffHour: 14,      // orders before 2 pm go out today
  },
  // Leave empty to run from data/catalog.json. Fill in after creating the Supabase project.
  supabaseUrl: "",
  supabaseAnonKey: "",
};
