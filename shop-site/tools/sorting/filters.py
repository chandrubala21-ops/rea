# Screwfix-style filters: each group gets its own filter list, values pulled from the item name.
import re

def _num(x):
    return x.rstrip("0").rstrip(".") if "." in x else x

def inch(n):
    # shop notation: 11/2'' = 1 1/2", 21/2 = 2 1/2", 3/4 = 3/4"
    m = re.search(r"(\d+(?:/\d)?)(?:\s*[\*x]\s*(\d+(?:/\d)?))?\s*(?:''|\"|”|inch)", n)
    if not m:
        return ""
    def f(v):
        if v is None: return None
        mm = re.fullmatch(r"(\d)(\d/\d)", v)
        return f"{mm.group(1)} {mm.group(2)}" if mm else v
    a, b = f(m.group(1)), f(m.group(2))
    return f'{a}" x {b}"' if b else f'{a}"'

def rx(p, fmt="{}", flags=re.I):
    c = re.compile(p, flags)
    def g(n):
        m = c.search(n)
        return fmt.format(*[_num(x) for x in m.groups() if x is not None]).upper() if m and fmt == "{}" else (fmt.format(*[_num(x) for x in m.groups() if x is not None]) if m else "")
    return g

MATERIAL = [("CPVC", r"cpvc"), ("UPVC", r"upvc"), ("HDPE", r"hdpe"), ("PVC", r"pvc"), ("GI", r"\bgi\b"),
            ("Brass", r"brass|bross|brose"), ("Stainless Steel", r"\bss\b|stainless"), ("CP (Chrome)", r"\bcp\b|chrome"),
            ("CI (Cast Iron)", r"\bci\b"), ("MS (Mild Steel)", r"\bms\b"), ("Copper", r"copper"), ("Aluminium", r"alumin|\bal\b")]
def material(n):
    for k, p in MATERIAL:
        if re.search(p, n, re.I): return k
    return ""

def colour(n):
    for c in ["White", "Black", "Grey", "Ivory", "Gold", "Silver", "Brown", "Wood", "Red", "Blue", "Green", "Yellow"]:
        if re.search(c, n, re.I): return c
    return ""

def pack(n):
    m = re.search(r"(\d+(?:\.\d+)?)\s*(ltr|lt|litre|liter|l)\b", n, re.I)
    if m: return f"{_num(m.group(1))} L"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(ml|kg|kgs|gm|grm|g)\b", n, re.I)
    if m:
        u = {"kgs": "kg", "grm": "g", "gm": "g"}.get(m.group(2).lower(), m.group(2).lower())
        return f"{_num(m.group(1))} {u}"
    return ""

def first(pairs):
    cs = [(k, re.compile(v, re.I)) for k, v in pairs]
    def g(n):
        for k, c in cs:
            if c.search(n): return k
        return ""
    return g

SHAPE = first([("Thread Adapter (MTA/FTA)", r"\bmta\b|\bfta\b|thread adapt"), ("45° Elbow (Shoe)", r"sho[eo]"),
    ("Reducer Coupler", r"r\.? ?coupl|reducer coupl"), ("Coupler", r"coupl"), ("Elbow", r"elbow|\bel\b"),
    ("Tee", r"\btee\b|y tee"), ("Bend", r"bend"), ("End Cap", r"dummy|end cap"), ("Reducer Bush", r"bush"),
    ("Reducer", r"reduc"), ("Union", r"union"), ("Nipple", r"nipple"), ("Flange", r"flange"),
    ("Saddle", r"sh?add?[ae]l|saddle"), ("Socket", r"socket")])

X = {
    "Fitting Shape": SHAPE,
    "Type": first([("Paint Brush", r"brush"), ("Roller", r"roller"), ("Roller Tray", r"tray"),
                   ("Scraper / Putty Blade", r"scraper|blade|patti|spatula"), ("Sandpaper", r"paper|emery")]),
    "Size (inch)": inch,
    "Size (mm)": rx(r"(\d+(?:\.\d+)?)\s*mm\b", "{} mm"),
    "Wire size (sq mm)": rx(r"(\d+(?:\.\d+)?)\s*sq\.?\s*mm", "{} sq mm"),
    "Cores": rx(r"(\d)\s*core", "{} core"),
    "Current (A)": rx(r"(\d+)\s*a(?:mp)?\b", "{} A"),
    "Poles": rx(r"(\d)\s*pole", "{} pole"),
    "Modules": rx(r"(\d+)\s*m(?:odule)?\b", "{} module"),
    "Wattage": rx(r"(\d+(?:\.\d+)?)\s*w(?:att|t)?s?\b", "{} W"),
    "Fan sweep": rx(r"(\d{3,4})\s*mm", "{} mm"),
    "Capacity (litres)": rx(r"(\d+(?:\.\d+)?)\s*(?:ltr|lt|litre|l)\b", "{} L"),
    "Motor power (HP)": rx(r"(\d+(?:\.\d+)?)\s*hp", "{} HP"),
    "Stages": rx(r"(\d+)\s*(?:st|stage)\b", "{} stage"),
    "Bore size": rx(r"\b([3468])\s*(?:''|\")", '{}" bore'),
    "Capacitance (MFD)": rx(r"(\d+(?:/\d+)?)\s*(?:mfd|mft|mf)\b", "{} MFD"),
    "Bearing number": rx(r"\b(\d{4,5})\b"),
    "Belt section": rx(r"\b([ABC])\s?-?\d{2,3}\b", "{}-section"),
    "Belt length (inch)": rx(r"\b[ABC]\s?-?(\d{2,3})\b", "{}\""),
    "Pack size": pack,
    "Material": material,
    "Colour / finish": colour,
}

B = ["Brand"]
G = {
    "Pipes": ["Material", "Size (inch)", "Size (mm)"] + B,
    "Pipe Fittings": ["Material", "Fitting Shape", "Size (inch)", "Size (mm)"] + B,
    "Valves": ["Material", "Size (inch)", "Size (mm)"] + B,
    "Taps & Mixers": B + ["Material", "Size (inch)"],
    "Bathroom & Sanitary": B + ["Material", "Size (inch)"],
    "Water Tanks": B + ["Capacity (litres)", "Size (inch)"],
    "Hoses & Connectors": ["Material", "Size (inch)", "Size (mm)"] + B,
    "Plumbing Sundries": B + ["Size (inch)", "Pack size"],
    "Water Filters & Pumps": B,
    "Cables & Wires": B + ["Wire size (sq mm)", "Cores"],
    "Switches & Sockets": B + ["Current (A)", "Modules", "Colour / finish"],
    "Switchgear & Distribution": B + ["Current (A)", "Poles"],
    "Lighting": B + ["Wattage"],
    "Fans & Appliances": B + ["Fan sweep", "Capacity (litres)", "Colour / finish"],
    "Electrical Accessories": B + ["Size (inch)"],
    "Pumps": B + ["Motor power (HP)", "Stages", "Bore size"],
    "Motors": B + ["Motor power (HP)"],
    "Starters & Control Panels": B + ["Motor power (HP)", "Current (A)"],
    "Capacitors": B + ["Capacitance (MFD)"],
    "Pump Spares": B + ["Motor power (HP)", "Size (mm)"],
    "Interior Wall Paint": B + ["Pack size"],
    "Exterior Wall Paint": B + ["Pack size"],
    "Enamel, Metal & Wood": B + ["Pack size", "Colour / finish"],
    "Primers": B + ["Pack size"],
    "Stainers & Bases": B + ["Pack size"],
    "Putty & Wall Prep": B + ["Pack size"],
    "Thinners & Solvents": B + ["Pack size"],
    "Brushes, Rollers & Tools": ["Type"] + B + ["Size (inch)"],
    "Bearings": B + ["Bearing number"],
    "Screws, Nails & Fixings": ["Material", "Size (inch)", "Size (mm)"] + B,
    "Pipe Clamps & Collars": ["Material", "Size (inch)"] + B,
    "Security & Ironmongery": B + ["Size (mm)", "Size (inch)"],
    "Adhesives & Sealants": B + ["Pack size"],
    "Belts & Transmission": B + ["Belt section", "Belt length (inch)"],
    "Hand Tools": B + ["Size (inch)", "Size (mm)"],
    "Power Tools": B + ["Wattage", "Size (inch)", "Size (mm)"],
    "Power Tool Accessories": B + ["Size (inch)", "Size (mm)"],
    "Agri & Irrigation": B + ["Size (inch)", "Size (mm)", "Size (mm)"],
    "Borewell": B + ["Size (inch)", "Motor power (HP)"],
}
DEFAULT = B

# ---- richer, category-specific filters ----
def shade(n):
    s = re.sub(r"\(.*?\)|\d+(\.\d+)?\s*(ltr|lt|litre|l|ml|kg|kgs|gm|g)\b", " ", n, flags=re.I)
    s = re.sub(r"\b(ap|np|ner|nerolac|asian|paints?|mrf|agsar|barlax|sheenlac|agaram|venlac|enam[ae]l|oil|synthetic|pinte|w/b|&)\b", " ", s, flags=re.I)
    s = re.sub(r"[-–]+|\s+", " ", s).strip().title()
    return s if 2 < len(s) < 30 else ""

X.update({
    "Range": first([("Royale", r"royale|royal(?! ivory)"), ("Apcolite", r"apcolite"), ("Tractor", r"tract"), ("Apex", r"apex"),
                    ("Ace", r"\bace\b"), ("Ultima", r"ultima"), ("Premium", r"premium"), ("Suraksha", r"suraksha"),
                    ("Beauty", r"beauty"), ("Impressions", r"impression"), ("Excel", r"excel"), ("Visa / Vista", r"visa|vista"),
                    ("Altura", r"altura|\balt\b"), ("Aqua Fresh", r"aqua ?fresh"), ("Veco", r"veco"), ("Crimson", r"crimson"),
                    ("Distemper", r"distemper")]),
    "Finish": first([("Gloss", r"gloss|glossy|shine|shyne"), ("Satin", r"satin"), ("Sheen", r"sheen"),
                     ("Matt", r"\bmatt?e?\b"), ("Metallic", r"metal+ic|pearl|gold|silver")]),
    "Shade": shade,
    "Surface": first([("Wood", r"wood"), ("Metal", r"red oxide|zinc|metal|iron|steel"), ("Wall (interior)", r"\bint|interior"),
                      ("Wall (exterior)", r"\bext|exterior"), ("Wall", r"wall|cement")]),
    "Base": first([("Water based", r"water|w/b|acrylic|emulsion"), ("Solvent / oil based", r"oil|solvent|enamel|synthetic|thinner")]),
    "Base number": rx(r"\b(b[w0-9]{1,2}|bse ?\d+|pns ?\d+|rb ?\d+\w?|te ?\d+|vs ?\d+)\b", "{}"),
    "Pressure class": rx(r"(\d+(?:\.\d+)?)\s*kg(?:s)?\b(?!.*cem)", "{} kg/cm²"),
    "Pipe length": rx(r"(\d+(?:\.\d+)?)\s*(?:m|mtr|mtrs|meter|metre|feet|ft)\b", "{} m"),
    "Pipe schedule": first([("SCH 40", r"sch ?40"), ("SCH 80", r"sch ?80"), ("Class B", r"class ?b|\bb class"), ("Class C", r"class ?c"),
                            ("Medium", r"medium"), ("Heavy", r"heavy"), ("Light", r"\blight\b")]),
    "Thread": first([("Male thread (MTA)", r"\bmta\b|male"), ("Female thread (FTA)", r"\bfta\b|female"),
                     ("Threaded", r"thread|brass insert|\bbi\b"), ("Plain (solvent joint)", r"plain|pvc|upvc|cpvc")]),
    "Tap type": first([("Bib (wall)", r"bib|short body"), ("Long body", r"long body"), ("Pillar (basin)", r"pillar"),
                       ("Sink / swan neck", r"sink|swan"), ("2-way", r"2 ?way|two way"), ("Angle cock", r"angle"),
                       ("Push / urinal", r"push"), ("Washing machine", r"washing"), ("Nozzle", r"nozzle")]),
    "Mount": first([("Wall mounted", r"wall|bib|long body"), ("Deck / table", r"pillar|table|deck|sink")]),
    "Tank layers": rx(r"(\d)\s*layer", "{} layer"),
    "Valve handle": first([("Long handle", r"long handle|l\.?h"), ("Short handle", r"short handle|s\.?h"), ("Wheel", r"wheel")]),
    "Phase": first([("3 phase", r"3 ?ph|three phase|tpn"), ("Single phase", r"1 ?ph|single phase|sp\b")]),
    "Wire type": first([("FRLS", r"frls"), ("FR", r"\bfr\b"), ("HRFR", r"hrfr"), ("Flexible", r"flex"), ("Submersible", r"sub")]),
    "Coil length": rx(r"(\d+)\s*(?:mtr|mtrs|meter|metre|m)\b", "{} m"),
    "MCB curve": rx(r"\b([bcd])\s?-?curve|\b([bcd])\s?\d{1,2}\s?a\b", "{}"),
    "Light colour": first([("Cool white", r"cool|day ?light|6500|white"), ("Warm white", r"warm|yellow|3000|2700"), ("Colour", r"colou?r|rgb")]),
    "Bulb base": first([("B22 (pin)", r"b22|pin"), ("E27 (screw)", r"e27|screw")]),
    "Fan colour": colour,
    "Fan type": first([("BLDC (energy saving)", r"bldc"), ("Decorative", r"decor|aura|renesa"), ("High speed", r"high ?speed|hs\b")]),
    "Pump outlet": rx(r"(\d+(?:\.\d+)?\s*\*\s*\d+(?:\.\d+)?)", "{}"),
    "Pump body": first([("Stainless steel", r"\bss\b|steel"), ("Cast iron", r"\bci\b"), ("Noryl / plastic", r"noryl|pvc"), ("Aluminium", r"alu")]),
    "Seal size (ID,OD,W mm)": rx(r"(\d{2}\s*,\s*\d{2}\s*,\s*\d{1,2})", "{}"),
    "Bearing seal": first([("2RS (rubber sealed)", r"2rs"), ("ZZ (metal shield)", r"zz"), ("Open", r".")]),
    "Head type": first([("CSK (flat)", r"csk|flat"), ("Pan", r"pan"), ("Hex", r"hex"), ("Coach", r"coach"), ("Self drilling", r"self|silf|sdr")]),
    "Lock type": first([("Padlock", r"pad|press|link"), ("Door lock", r"door|mortice|night latch"), ("Cupboard", r"cupboard|drawer")]),
    "Disc size": inch,
    "Tool use": first([("Metal", r"metal|ms\b|steel"), ("Wood", r"wood"), ("Concrete / granite", r"granite|concrete|marble|masonry|wall|tile"), ("Glass", r"glass")]),
    "Power source": first([("Cordless", r"cordless|battery|\d+ ?v\b"), ("Corded", r".")]),
})

# Per product type: its own filter set (overrides the group default above).
P = {
    # Paint
    "Interior Emulsions": B + ["Range", "Finish", "Pack size"],
    "Exterior Emulsions": B + ["Range", "Finish", "Pack size"],
    "Enamel Paints": B + ["Shade", "Finish", "Range", "Pack size"],
    "Metal & Aluminium Paint": B + ["Shade", "Surface", "Pack size"],
    "Wood Finishes & Varnish": B + ["Finish", "Base", "Pack size"],
    "Spray Paints": B + ["Shade", "Finish", "Pack size"],
    "Wall & Wood Primers": B + ["Surface", "Base", "Pack size"],
    "Tinting Bases": B + ["Range", "Base number", "Pack size"],
    "Stainers & Colourants": B + ["Shade", "Pack size"],
    "Wall Putty": B + ["Pack size"],
    "Waterproofing": B + ["Surface", "Pack size"],
    "Cement, White Cement & Lime": B + ["Pack size"],
    "Thinners & Turpentine": B + ["Pack size"],
    # Plumbing
    "PVC Pipes": ["Size (inch)", "Size (mm)", "Pressure class", "Pipe length"] + B,
    "UPVC Pipes": ["Size (inch)", "Size (mm)", "Pipe schedule", "Pipe length"] + B,
    "CPVC Pipes": ["Size (inch)", "Size (mm)", "Pipe schedule", "Pipe length"] + B,
    "GI Pipes": ["Size (inch)", "Pipe schedule", "Pipe length"] + B,
    "Pipes (other)": ["Material", "Size (inch)", "Pressure class"] + B,
    "Thread Adapters (MTA / FTA)": ["Material", "Thread", "Size (inch)", "Size (mm)"] + B,
    "PVC Fittings": ["Fitting Shape", "Size (inch)", "Size (mm)", "Thread"] + B,
    "UPVC Fittings": ["Fitting Shape", "Size (inch)", "Size (mm)", "Thread"] + B,
    "CPVC Fittings": ["Fitting Shape", "Size (inch)", "Size (mm)", "Thread"] + B,
    "GI Fittings": ["Fitting Shape", "Size (inch)"] + B,
    "Brass Fittings": ["Fitting Shape", "Size (inch)"] + B,
    "Ball Valves": ["Material", "Size (inch)", "Size (mm)", "Valve handle"] + B,
    "Gate Valves": ["Material", "Size (inch)"] + B,
    "Foot Valves": ["Material", "Size (inch)"] + B,
    "Non-Return (NRV) & Check Valves": ["Material", "Size (inch)"] + B,
    "Bib, Pillar & Long Body Taps": ["Tap type", "Material", "Mount", "Size (inch)"] + B,
    "Wall & Sink Mixers": ["Tap type", "Mount", "Material"] + B,
    "Water Tanks": B + ["Capacity (litres)", "Tank layers", "Colour / finish"],
    # Electrical
    "House Wires": B + ["Wire size (sq mm)", "Wire type", "Coil length", "Colour / finish"],
    "Submersible & Flat Cables": B + ["Wire size (sq mm)", "Cores", "Coil length"],
    "Multi-core & Round Cables": B + ["Wire size (sq mm)", "Cores", "Coil length"],
    "MCBs (Breakers)": B + ["Current (A)", "Poles", "MCB curve"],
    "RCCB & ELCB": B + ["Current (A)", "Poles"],
    "Isolators": B + ["Current (A)", "Poles"],
    "Distribution Boards": B + ["Poles", "Phase"],
    "Changeover Switches": B + ["Current (A)", "Poles", "Phase"],
    "Switches": B + ["Current (A)", "Colour / finish"],
    "Sockets": B + ["Current (A)", "Colour / finish"],
    "Modular Plates": B + ["Modules", "Colour / finish"],
    "LED Bulbs": B + ["Wattage", "Light colour", "Bulb base"],
    "Tube Lights & Battens": B + ["Wattage", "Light colour"],
    "Panel, Spot & Downlights": B + ["Wattage", "Light colour"],
    "Flood & Street Lights": B + ["Wattage"],
    "Ceiling Fans": B + ["Fan sweep", "Fan type", "Fan colour"],
    "Geysers (Water Heaters)": B + ["Capacity (litres)"],
    # Pumps & motors
    "Submersible Pumps": B + ["Motor power (HP)", "Stages", "Bore size", "Phase", "Pump body"],
    "Openwell Pumps": B + ["Motor power (HP)", "Phase"],
    "Self-Priming Pumps": B + ["Motor power (HP)", "Pump outlet", "Phase"],
    "Monoblock & Jet Pumps": B + ["Motor power (HP)", "Pump outlet", "Phase"],
    "Starters, DOL & Panels": B + ["Motor power (HP)", "Phase"],
    "Seals, Coils & Winding Parts": B + ["Seal size (ID,OD,W mm)", "Motor power (HP)"],
    # Hardware & tools
    "Ball & Roller Bearings": B + ["Bearing number", "Bearing seal"],
    "Screws": ["Head type", "Material", "Size (inch)", "Size (mm)"] + B,
    "Bolts & Nuts": ["Material", "Size (inch)", "Size (mm)"] + B,
    "Locks & Padlocks": B + ["Lock type", "Size (mm)"],
    "Cutting & Grinding Discs": B + ["Tool use", "Disc size"],
    "Drill Bits & Hole Saws": B + ["Tool use", "Size (mm)"],
    "Drills & Rotary Hammers": B + ["Power source", "Size (mm)", "Wattage"],
    "Angle Grinders": B + ["Power source", "Disc size", "Wattage"],
}

def filters_for(group, ptype):
    return list(dict.fromkeys(P.get(ptype) or G.get(group) or DEFAULT))
