async function loadSnapshot() {
  const snapshotPath = document.body.dataset.snapshot || "./assets/chapter1_snapshot.json";
  const res = await fetch(snapshotPath, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load snapshot: ${res.status}`);
  return res.json();
}

function createTooltip() {
  const el = document.createElement("div");
  el.className = "tooltip";
  document.body.appendChild(el);
  return el;
}

function setTooltip(tooltip, point) {
  tooltip.innerHTML = "";
  const title = document.createElement("div");
  title.textContent = point.subject;
  title.style.fontWeight = "700";
  const kind = document.createElement("div");
  kind.className = "tooltip-meta";
  kind.textContent = `${point.kind} / ${point.mime_type}`;
  const pre = document.createElement("pre");
  pre.textContent = point.art;
  tooltip.append(title, kind, pre);
}

function moveTooltip(tooltip, event) {
  const pad = 16;
  const box = tooltip.getBoundingClientRect();
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  if (x + box.width > window.innerWidth - 8) x = event.clientX - box.width - pad;
  if (y + box.height > window.innerHeight - 8) y = event.clientY - box.height - pad;
  tooltip.style.left = `${Math.max(8, x)}px`;
  tooltip.style.top = `${Math.max(8, y)}px`;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

function l2(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function interpretPair(kindA, kindB, cosineValue) {
  const pair = [kindA, kindB].sort().join("+");
  if (pair === "image+text+image") return "The fused object stays closest to the image form.";
  if (pair === "image+text+text") return "The fused object still preserves a strong textual relation.";
  if (pair === "image+text") return "Text and raster are related, but clearly distinct.";
  if (cosineValue > 0.8) return "Very tightly aligned.";
  if (cosineValue > 0.6) return "Related, with meaningful shared structure.";
  return "Distinct but still semantically linked.";
}

function renderPairTable(snapshot) {
  const body = document.getElementById("pair-table");
  body.innerHTML = "";
  snapshot.pairs.forEach((pair) => {
    const tr = document.createElement("tr");
    const pairName = document.createElement("td");
    pairName.textContent = `${pair.a_kind} vs ${pair.b_kind}`;
    const cosineCell = document.createElement("td");
    cosineCell.textContent = pair.cosine.toFixed(4);
    const l2Cell = document.createElement("td");
    l2Cell.textContent = pair.l2.toFixed(4);
    const note = document.createElement("td");
    note.textContent = interpretPair(pair.a_kind, pair.b_kind, pair.cosine);
    tr.append(pairName, cosineCell, l2Cell, note);
    body.appendChild(tr);
  });
}

function renderAscii(snapshot) {
  document.getElementById("ascii-art").textContent = snapshot.points.find((p) => p.kind === "text")?.art || "";
  document.getElementById("metric-count").textContent = String(snapshot.points.length);
  const image = document.getElementById("artifact-image");
  if (image) {
    image.src = document.body.dataset.image || image.src;
  }
}

function renderPlot(snapshot) {
  const svg = document.getElementById("plot");
  const tooltip = createTooltip();
  const slotA = document.getElementById("slot-a");
  const slotB = document.getElementById("slot-b");
  const metrics = document.getElementById("compare-metrics");
  const clearBtn = document.getElementById("clear-selection");
  let selectedA = null;
  let selectedB = null;

  const w = 860;
  const h = 520;
  const margin = 80;
  const xs = snapshot.points.map((p) => p.coords[0]);
  const ys = snapshot.points.map((p) => p.coords[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);

  const colorByKind = {
    text: "#207a73",
    image: "#b85b31",
    "image+text": "#b9912d",
  };

  function sx(x) {
    return margin + ((x - minX) / spanX) * (w - margin * 2);
  }

  function sy(y) {
    return h - margin - ((y - minY) / spanY) * (h - margin * 2);
  }

  function updateCompare() {
    slotA.textContent = selectedA ? `${selectedA.kind} selected` : "Select point A";
    slotB.textContent = selectedB ? `${selectedB.kind} selected` : "Select point B";
    if (selectedA && selectedB) {
      const sim = cosine(selectedA.embedding, selectedB.embedding);
      const dist = l2(selectedA.embedding, selectedB.embedding);
      metrics.innerHTML = `
        <div><strong>Cosine</strong>: ${sim.toFixed(4)}</div>
        <div><strong>L2</strong>: ${dist.toFixed(4)}</div>
        <div><strong>Reading</strong>: ${interpretPair(selectedA.kind, selectedB.kind, sim)}</div>
      `;
    } else {
      metrics.textContent = "Similarity metrics appear here.";
    }
  }

  function updateHighlight() {
    svg.querySelectorAll("[data-kind]").forEach((el) => {
      el.setAttribute("stroke", "none");
      el.setAttribute("stroke-width", "0");
      el.setAttribute("opacity", "0.9");
    });
    if (selectedA) {
      const el = svg.querySelector(`[data-id="${selectedA.id}"]`);
      if (el) {
        el.setAttribute("stroke", "#f5f1ea");
        el.setAttribute("stroke-width", "3");
      }
    }
    if (selectedB) {
      const el = svg.querySelector(`[data-id="${selectedB.id}"]`);
      if (el) {
        el.setAttribute("stroke", "#111");
        el.setAttribute("stroke-width", "3");
      }
    }
  }

  function selectPoint(point) {
    if (!selectedA || (selectedA && selectedB)) {
      selectedA = point;
      selectedB = null;
    } else {
      selectedB = point;
    }
    updateCompare();
    updateHighlight();
  }

  function clearSelection() {
    selectedA = null;
    selectedB = null;
    updateCompare();
    updateHighlight();
  }

  clearBtn.addEventListener("click", clearSelection);

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", String(w));
  bg.setAttribute("height", String(h));
  bg.setAttribute("fill", "transparent");
  bg.addEventListener("click", clearSelection);
  svg.appendChild(bg);

  snapshot.points.forEach((point) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(w / 2));
    line.setAttribute("y1", String(h / 2));
    line.setAttribute("x2", String(sx(point.coords[0])));
    line.setAttribute("y2", String(sy(point.coords[1])));
    line.setAttribute("stroke", "rgba(23, 18, 13, 0.12)");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(sx(point.coords[0])));
    circle.setAttribute("cy", String(sy(point.coords[1])));
    circle.setAttribute("r", "16");
    circle.setAttribute("fill", colorByKind[point.kind] || "#666");
    circle.setAttribute("data-id", point.id);
    circle.setAttribute("data-kind", point.kind);
    circle.style.cursor = "pointer";
    circle.addEventListener("mouseenter", (event) => {
      setTooltip(tooltip, point);
      tooltip.style.display = "block";
      moveTooltip(tooltip, event);
    });
    circle.addEventListener("mousemove", (event) => moveTooltip(tooltip, event));
    circle.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
    circle.addEventListener("click", (event) => {
      event.stopPropagation();
      selectPoint(point);
    });
    svg.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(sx(point.coords[0]) + 20));
    label.setAttribute("y", String(sy(point.coords[1]) - 18));
    label.setAttribute("fill", "#584a3f");
    label.setAttribute("font-family", "DejaVu Sans Mono, Liberation Mono, monospace");
    label.setAttribute("font-size", "13");
    label.textContent = point.kind;
    svg.appendChild(label);
  });

  updateCompare();
}

async function main() {
  const snapshot = await loadSnapshot();
  renderAscii(snapshot);
  renderPairTable(snapshot);
  renderPlot(snapshot);
}

main().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<main class="page"><section class="panel"><h1>Snapshot failed to load</h1><p>${error.message}</p></section></main>`;
});
