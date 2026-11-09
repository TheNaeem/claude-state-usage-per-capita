/* Claude.ai usage per capita by state - May 2026
   Data: Anthropic Economic Index (CC BY). See data/states.json. */

const SVG_NS = "http://www.w3.org/2000/svg";

const TIERS = [
  { key: 0, label: "Leading",      hint: "top 25%" },
  { key: 1, label: "Upper middle", hint: "" },
  { key: 2, label: "Lower middle", hint: "" },
  { key: 3, label: "Emerging",     hint: "bottom 25%" },
];

const fmt = (n) => n.toFixed(2);
const el = (id) => document.getElementById(id);

const map     = el("map");
const mapWrap = el("mapWrap");
const tip     = el("tip");
const tipName = tip.querySelector(".tip-name");
const tipVal  = tip.querySelector(".tip-val");
const tipRank = tip.querySelector(".tip-rank");

let byCode = new Map();
let activeEl = null;

/* ---------- tooltip ------------------------------------------------- */

function showTip(code, clientX, clientY, anchorEl) {
  const s = byCode.get(code);
  if (!s) return;

  tipName.textContent = s.name;
  tipVal.textContent  = fmt(s.index);
  tipRank.textContent = `Rank ${s.rank} of 51 · ${TIERS[s.tier].label}`;
  tip.hidden = false;

  const wrap = mapWrap.getBoundingClientRect();
  let x, y;
  if (typeof clientX === "number") {
    x = clientX - wrap.left;
    y = clientY - wrap.top - 14;
  } else {
    const b = anchorEl.getBoundingClientRect();
    x = b.left + b.width / 2 - wrap.left;
    y = b.top - wrap.top - 8;
  }

  const half = tip.offsetWidth / 2 + 4;
  x = Math.max(half, Math.min(wrap.width - half, x));
  if (y < tip.offsetHeight + 4) y = y + tip.offsetHeight + 28; // flip below

  tip.style.left = `${x}px`;
  tip.style.top  = `${y}px`;

  if (activeEl && activeEl !== anchorEl) activeEl.classList.remove("is-active");
  if (anchorEl) { anchorEl.classList.add("is-active"); activeEl = anchorEl; }
}

function hideTip() {
  tip.hidden = true;
  if (activeEl) { activeEl.classList.remove("is-active"); activeEl = null; }
}

/* On a phone the whole map is ~315px wide, so Rhode Island is a couple of
   pixels across. If a pointer misses every shape, fall back to the nearest
   state centroid - with a wider reach for fingers than for a mouse. */
const centroids = [];   // { code, node, x, y } in viewBox units

function clientToSvg(clientX, clientY) {
  const ctm = map.getScreenCTM();
  if (!ctm) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return pt;
}

function nearest(clientX, clientY, reach) {
  const p = clientToSvg(clientX, clientY);
  if (!p) return null;
  let best = null, bestD = reach * reach;
  for (const c of centroids) {
    const dx = c.x - p.x, dy = c.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function targetCode(ev) {
  const t = ev.target.closest("[data-code]");
  if (t) return { code: t.dataset.code, node: t };

  if (typeof ev.clientX !== "number") return null;
  const reach = ev.pointerType === "mouse" ? 26 : 70;
  const c = nearest(ev.clientX, ev.clientY, reach);
  return c ? { code: c.code, node: c.node } : null;
}

/* ---------- build the map ------------------------------------------- */

function drawMap(states) {
  const frag = document.createDocumentFragment();

  for (const s of states) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", s.d);
    p.setAttribute("class", `state t${s.tier}`);
    p.setAttribute("tabindex", "0");
    p.setAttribute("role", "img");
    p.setAttribute("aria-label",
      `${s.name}: index ${fmt(s.index)}, rank ${s.rank} of 51, ${TIERS[s.tier].label}`);
    p.dataset.code = s.code;
    frag.appendChild(p);
  }
  map.appendChild(frag);

  for (const node of map.querySelectorAll("path.state")) {
    const bb = node.getBBox();
    centroids.push({
      code: node.dataset.code, node,
      x: bb.x + bb.width / 2,
      y: bb.y + bb.height / 2,
    });
  }

  // D.C. is a few pixels wide at this scale - give it a labelled chip.
  const dc = map.querySelector('[data-code="DC"]');
  const dcData = byCode.get("DC");
  if (!dc || !dcData) return;

  const b  = dc.getBBox();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const chipW = 62, chipH = 32;
  const chipX = Math.min(cx + 44, 975 - chipW - 2);
  const chipY = cy + 74;

  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("id", "dcChip");
  g.setAttribute("tabindex", "0");
  g.setAttribute("role", "img");
  g.setAttribute("aria-label",
    `District of Columbia: index ${fmt(dcData.index)}, rank ${dcData.rank} of 51, ${TIERS[dcData.tier].label}`);
  g.dataset.code = "DC";

  const line = document.createElementNS(SVG_NS, "path");
  line.setAttribute("id", "dcLine");
  line.setAttribute("d", `M${cx} ${cy}L${chipX + chipW / 2} ${chipY}`);

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", chipX); rect.setAttribute("y", chipY);
  rect.setAttribute("width", chipW); rect.setAttribute("height", chipH);
  rect.setAttribute("rx", "6");
  rect.setAttribute("class", `t${dcData.tier}`);

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", chipX + chipW / 2);
  text.setAttribute("y", chipY + chipH / 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.textContent = "DC";

  g.append(rect, text);
  map.append(line, g);
}

/* ---------- legend, top 10, table ----------------------------------- */

function drawLegend(states) {
  const out = TIERS.map((t) => {
    const vals = states.filter((s) => s.tier === t.key).map((s) => s.index);
    const lo = fmt(Math.min(...vals)), hi = fmt(Math.max(...vals));
    const hint = t.hint ? ` (${t.hint})` : "";
    return `<li><span class="sw t${t.key}" aria-hidden="true"></span>
      <span>${t.label}${hint}</span>
      <span class="rng">${lo}–${hi}</span></li>`;
  }).join("");
  el("legend").innerHTML = out;
}

function drawTop10(states) {
  const top = states.slice(0, 10);
  const max = top[0].index;
  el("top10").innerHTML = top.map((s) => `
    <li>
      <span class="rk">${s.rank}</span>
      <span class="nm">${s.name}</span>
      <span class="bar" aria-hidden="true"><i style="width:${(s.index / max) * 100}%"></i></span>
      <span class="vl">${fmt(s.index)}</span>
    </li>`).join("");
}

function drawTable(states) {
  const body = states.map((s) => `
    <tr>
      <td>${s.rank}</td>
      <td>${s.name}</td>
      <td class="num">${fmt(s.index)}</td>
      <td class="grp"><span class="sw t${s.tier}" aria-hidden="true"></span>${TIERS[s.tier].label}</td>
    </tr>`).join("");
  el("fullTable").querySelector("tbody").innerHTML = body;
}

function drawHero(states) {
  const first = states[0], second = states[1];
  el("heroNum").textContent  = fmt(first.index);
  el("heroName").textContent = first.name;
  el("heroSub").textContent  =
    `uses Claude.ai ${fmt(first.index / second.index)} times as much per person as ${second.name}, the next highest`;
}

/* ---------- go ------------------------------------------------------ */

fetch("data/states.json")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then((payload) => {
    const states = payload.states;
    byCode = new Map(states.map((s) => [s.code, s]));

    drawMap(states);
    drawLegend(states);
    drawTop10(states);
    drawTable(states);
    drawHero(states);

    map.addEventListener("pointermove", (ev) => {
      const t = targetCode(ev);
      if (t) showTip(t.code, ev.clientX, ev.clientY, t.node);
      else hideTip();
    });
    map.addEventListener("pointerdown", (ev) => {
      const t = targetCode(ev);
      if (t) { ev.preventDefault(); showTip(t.code, ev.clientX, ev.clientY, t.node); }
      else hideTip();
    });
    map.addEventListener("pointerleave", hideTip);

    map.addEventListener("focusin", (ev) => {
      const t = targetCode(ev);
      if (t) showTip(t.code, undefined, undefined, t.node);
    });
    map.addEventListener("focusout", hideTip);

    document.addEventListener("pointerdown", (ev) => {
      if (!map.contains(ev.target)) hideTip();
    });
    window.addEventListener("keydown", (ev) => { if (ev.key === "Escape") hideTip(); });
    window.addEventListener("resize", hideTip);
  })
  .catch((err) => {
    mapWrap.innerHTML =
      '<p class="note" role="alert">The map data could not be loaded. Please reload the page.</p>';
    console.error("states.json failed to load:", err);
  });
