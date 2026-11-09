import json, csv, sys, os

atlas_path = sys.argv[1]
csv_path   = sys.argv[2]
out_dir    = sys.argv[3]

with open(atlas_path, encoding="utf-8") as f:
    topo = json.load(f)

sx, sy = topo["transform"]["scale"]
tx, ty = topo["transform"]["translate"]

def decode(arc):
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx; y += dy
        pts.append((x * sx + tx, y * sy + ty))
    return pts

arcs = [decode(a) for a in topo["arcs"]]

def ring(idxs):
    pts = []
    for i in idxs:
        a = arcs[~i][::-1] if i < 0 else arcs[i]
        pts.extend(a[1:] if pts else a)
    return pts

def fmt(v):
    r = round(v, 1)
    return str(int(r)) if r == int(r) else str(r)

def path_d(polys):
    out = []
    for poly in polys:
        for idxs in poly:
            pts = ring(idxs)
            d, last = [], None
            for p in pts:
                q = (fmt(p[0]), fmt(p[1]))
                if q == last:
                    continue
                d.append(("M" if last is None else "L") + q[0] + " " + q[1])
                last = q
            if len(d) > 3:
                out.append("".join(d) + "Z")
    return "".join(out)

geo = {}
for g in topo["objects"]["states"]["geometries"]:
    name = g["properties"]["name"]
    polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
    geo[name] = path_d(polys)

rows = list(csv.DictReader(open(csv_path, encoding="utf-8-sig")))
states = []
for r in rows:
    name = r["state_name"]
    if name not in geo:
        print("NO GEOMETRY for", name); sys.exit(1)
    states.append({
        "code": r["state_code"],
        "name": name,
        "index": float(r["usage_per_capita_index"]),
        "share": float(r["usage_pct"]),
        "d": geo[name],
    })

missing = set(geo) - {s["name"] for s in states}
print("geometry present but not in CSV:", sorted(missing))

# rank: 1 = highest index. Ties share the better rank.
order = sorted(states, key=lambda s: -s["index"])
rank = {}
for i, s in enumerate(order):
    if i and s["index"] == order[i-1]["index"]:
        rank[s["code"]] = rank[order[i-1]["code"]]
    else:
        rank[s["code"]] = i + 1
n = len(states)
for s in states:
    s["rank"] = rank[s["code"]]
    s["tier"] = (s["rank"] - 1) * 4 // n   # 0..3 by rank quartile

# states with an identical index must never get different colours
best = {}
for s in states:
    best[s["index"]] = min(best.get(s["index"], 9), s["tier"])
for s in states:
    s["tier"] = best[s["index"]]

os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "states.json"), "w", encoding="utf-8") as f:
    json.dump({
        "meta": {
            "month": "May 2026",
            "metric": "usage_per_capita_index",
            "source": "Anthropic Economic Index, Claude.ai conversations, May 2026 (released 2026-06-26), CC BY",
            "url": "https://www.anthropic.com/research/economic-index-june-2026-report",
            "projection": "Albers USA, viewBox 0 0 975 610",
        },
        "states": sorted(states, key=lambda s: s["rank"]),
    }, f, separators=(",", ":"))

print("states:", n, "| top10:", [(s["code"], s["index"]) for s in order[:10]])
print("tier sizes:", {t: sum(1 for s in states if s["tier"] == t) for t in range(4)})
print("cut indices:", [order[i]["index"] for i in (0, n//4-1, n//4, n//2-1, n//2, 3*n//4-1, 3*n//4, n-1)])
