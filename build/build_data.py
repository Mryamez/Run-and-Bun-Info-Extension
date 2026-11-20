"""Builds extension/data.js from Pokemon Showdown data, using Gen 8 text
and stats, then layers the Run & Bun changes (rnb_changes.json) on top.

Usage: py -I build_data.py <download_dir> <out_file>
"""
import json, re, sys, os

DL, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))


def read(name):
    with open(os.path.join(DL, name), encoding="utf8") as f:
        return f.read()


def parse_blocks(src):
    """Parse a Showdown TS table into {id: {field: value, 'genN': {...}}}.
    Only keeps simple scalar fields (strings, numbers, true/false/null)."""
    out, cur, sub = {}, None, None
    scalar = re.compile(r'^(\t+)("?[A-Za-z0-9]+"?): (".*"|-?[\d.]+|true|false|null),\s*$')
    for line in src.splitlines():
        m = re.match(r'^\t("?[a-z0-9]+"?): \{\s*$', line)
        if m:
            cur = out.setdefault(m.group(1).strip('"'), {})
            sub = None
            continue
        if cur is None:
            continue
        m = re.match(r'^\t\t(gen\d): \{\s*$', line)
        if m:
            sub = cur.setdefault(m.group(1), {})
            continue
        if re.match(r'^\t\t\},?\s*$', line):
            sub = None
            continue
        m = scalar.match(line)
        if m:
            depth, key, val = len(m.group(1)), m.group(2).strip('"'), json.loads(m.group(3))
            if depth == 2:
                cur[key] = val
            elif depth == 3 and sub is not None:
                sub[key] = val
    return out


def gen8_text(entry):
    """Text for Gen 8: a gen8 block overrides the newest text; older blocks don't apply."""
    g8 = entry.get("gen8", {})
    return (g8.get("desc", entry.get("desc", "")),
            g8.get("shortDesc", entry.get("shortDesc", "")))


def js_obj_to_json(js):
    """Client .js files are `exports.X = {...}` with unquoted keys."""
    body = js[js.index("{"):].rstrip().rstrip(";")
    body = re.sub(r'([{,])([A-Za-z0-9_$]+):', r'\1"\2":', body)
    return json.loads(body)


moves_stats = json.loads(read("moves.json"))
moves_text = parse_blocks(read("text_moves.ts"))
abil_text = parse_blocks(read("text_abilities.ts"))
item_text = parse_blocks(read("text_items.ts"))
items_meta = js_obj_to_json(read("items.js"))
gen8_move_mods = parse_blocks(read("mods_gen8_moves.ts"))

with open(os.path.join(HERE, "rnb_changes.json"), encoding="utf8") as f:
    rnb = json.load(f)

FLAG_NAMES = {
    "contact": "Contact", "sound": "Sound", "punch": "Punch", "bite": "Bite",
    "pulse": "Pulse", "bullet": "Ball/Bomb", "powder": "Powder", "dance": "Dance",
    "wind": "Wind", "slicing": "Slicing", "heal": "Heal", "recharge": "Recharge",
    "charge": "Charge turn", "defrost": "Thaws user", "bypasssub": "Ignores Substitute",
    "reflectable": "Magic Coat-able",
}
TARGETS = {
    "normal": "One target", "allAdjacentFoes": "All foes (spread)", "allAdjacent": "All adjacent (spread)",
    "self": "Self", "any": "Any target", "adjacentAlly": "Ally", "adjacentAllyOrSelf": "Self or ally",
    "adjacentFoe": "Adjacent foe", "allySide": "User's side", "foeSide": "Foe's side", "all": "Whole field",
    "allies": "User and allies", "randomNormal": "Random foe", "scripted": "Scripted",
}

moves = {}
for mid, s in moves_stats.items():
    if s.get("isNonstandard") in ("CAP", "LGPE", "Custom") or s.get("isZ") or s.get("isMax"):
        continue
    if mid.startswith("hiddenpower") and mid != "hiddenpower":
        continue
    s = dict(s)
    for k, v in gen8_move_mods.get(mid, {}).items():
        if k in ("basePower", "accuracy", "pp", "priority", "type", "category"):
            s[k] = v
    t = moves_text.get(mid, {})
    d, sd = gen8_text(t)
    moves[mid] = {
        "n": s["name"], "t": s["type"], "c": s["category"],
        "bp": s.get("basePower", 0), "acc": s.get("accuracy", True), "pp": s.get("pp", 0),
        "pri": s.get("priority", 0), "tg": TARGETS.get(s.get("target"), s.get("target")),
        "fl": [FLAG_NAMES[f] for f in s.get("flags", {}) if f in FLAG_NAMES],
        "d": d, "sd": sd, "num": s.get("num", 0),
    }
    if s.get("num", 0) > 826:
        moves[mid]["newer"] = True  # not in Sword/Shield (Legends Arceus or Gen 9)

abilities = {}
for aid, t in abil_text.items():
    if aid == "noability" or "name" not in t:
        continue
    d, sd = gen8_text(t)
    abilities[aid] = {"n": t["name"], "d": d, "sd": sd}

items = {}
for iid, t in item_text.items():
    if "name" not in t:
        continue
    meta = items_meta.get(iid, {})
    if meta.get("isNonstandard") in ("CAP", "Custom"):
        continue
    d, sd = gen8_text(t)
    entry = {"n": t["name"], "d": d, "sd": sd}
    fling = (meta.get("fling") or {}).get("basePower")
    if fling:
        entry["fling"] = fling
    if meta.get("naturalGift"):
        entry["ng"] = [meta["naturalGift"]["basePower"], meta["naturalGift"]["type"]]
    if meta.get("gen", 0) > 8:
        entry["newer"] = True
    items[iid] = entry

for kind, table in (("moves", moves), ("abilities", abilities), ("items", items)):
    for key, note in rnb.get(kind, {}).items():
        if key not in table:
            raise SystemExit(f"Run & Bun note for unknown {kind[:-1]}: {key}")
        table[key]["rb"] = note

data = {"moves": moves, "abilities": abilities, "items": items, "general": rnb["general"]}
with open(OUT, "w", encoding="utf8") as f:
    f.write("// Generated by build/build_data.py. Data: Pokemon Showdown (Gen 8) + Run & Bun changes.\n")
    f.write("var RNB_DEX = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print(f"moves={len(moves)} abilities={len(abilities)} items={len(items)} size={os.path.getsize(OUT)}")
