async function main() {
  const source = document.body.dataset.intro;
  const response = await fetch(source);
  const snapshot = await response.json();

  document.getElementById("metric-model").textContent = snapshot.embedding_model;
  document.getElementById("metric-objects").textContent = String(snapshot.object_count);
  document.getElementById("metric-dims").textContent = String(snapshot.vector_size);

  renderPairs(snapshot.pairs.slice(0, 8));
  renderPlot(snapshot.points);
  renderObservations(snapshot.pairs);
}

function renderPairs(pairs) {
  const body = document.getElementById("pair-table-body");
  body.innerHTML = "";
  for (const pair of pairs) {
    const tr = document.createElement("tr");
    const pairCell = document.createElement("td");
    pairCell.textContent = `${pair.a} ↔ ${pair.b}`;
    const cosineCell = document.createElement("td");
    cosineCell.textContent = pair.cosine.toFixed(4);
    const l2Cell = document.createElement("td");
    l2Cell.textContent = pair.l2.toFixed(4);
    tr.append(pairCell, cosineCell, l2Cell);
    body.appendChild(tr);
  }
}

function renderPlot(points) {
  const svg = document.getElementById("intro-plot");
  const width = 760;
  const height = 420;
  const padX = 72;
  const padY = 54;

  const mapX = (x) => padX + x * (width - padX * 2);
  const mapY = (y) => height - padY - y * (height - padY * 2);

  const palette = {
    text: "#6a3eff",
    image: "#216f69",
    "image+text": "#d26b2d",
    photo: "#a6404b",
    "photo+text": "#3d6fd6",
    "photo+ascii-image": "#111111",
  };

  svg.innerHTML = "";
  svg.appendChild(line(56, height - 44, width - 36, height - 44, "axis"));
  svg.appendChild(line(56, 30, 56, height - 44, "axis"));

  const guides = [
    ["text", "image+text"],
    ["image", "image+text"],
    ["photo", "photo+text"],
    ["photo", "photo+ascii-image"],
    ["image", "photo+ascii-image"],
  ];

  for (const [a, b] of guides) {
    const pa = points.find((point) => point.kind === a);
    const pb = points.find((point) => point.kind === b);
    if (!pa || !pb) continue;
    svg.appendChild(line(mapX(pa.x), mapY(pa.y), mapX(pb.x), mapY(pb.y), "bridge"));
  }

  for (const point of points) {
    const cx = mapX(point.x);
    const cy = mapY(point.y);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("r", "10");
    dot.setAttribute("fill", palette[point.kind] || "#444");
    dot.setAttribute("class", "plot-dot");

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(cx + 14));
    label.setAttribute("y", String(cy + 4));
    label.setAttribute("class", "plot-label");
    label.textContent = point.kind;

    g.append(dot, label);
    svg.appendChild(g);
  }
}

function renderObservations(pairs) {
  const farthest = [...pairs].sort((a, b) => b.l2 - a.l2)[0];
  const photoPairs = pairs
    .filter((pair) => pair.a === "photo" || pair.b === "photo")
    .sort((a, b) => b.cosine - a.cosine);
  const asciiBridge = pairs.find(
    (pair) =>
      (pair.a === "image" && pair.b === "image+text") ||
      (pair.a === "image+text" && pair.b === "image"),
  );

  setObservation("obs-farthest-pair", farthest, false);
  setObservation("obs-farthest-meta", farthest, true);
  setObservation("obs-photo-nearest-pair", photoPairs[0], false);
  setObservation("obs-photo-nearest-meta", photoPairs[0], true);
  if (asciiBridge) {
    setObservation("obs-ascii-bridge-pair", asciiBridge, false);
    setObservation("obs-ascii-bridge-meta", asciiBridge, true);
  }
}

function setObservation(id, pair, metricsOnly) {
  const el = document.getElementById(id);
  if (!el || !pair) return;
  if (metricsOnly) {
    el.textContent = `cos ${pair.cosine.toFixed(4)}, l2 ${pair.l2.toFixed(4)}`;
    return;
  }
  el.textContent = `${pair.a} ↔ ${pair.b}`;
}

function line(x1, y1, x2, y2, className) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
  el.setAttribute("x1", String(x1));
  el.setAttribute("y1", String(y1));
  el.setAttribute("x2", String(x2));
  el.setAttribute("y2", String(y2));
  el.setAttribute("class", className);
  return el;
}

main().catch((error) => {
  console.error(error);
});
