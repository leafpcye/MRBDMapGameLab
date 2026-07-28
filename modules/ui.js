export function renderRows(container, rows) {
  container.replaceChildren();
  const list = document.createElement("dl");
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = typeof value === "string" ? value : JSON.stringify(value);
    list.append(dt, dd);
  });
  container.append(list);
}

export function renderRecent(container, entries, limit = 5) {
  container.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = `RECENT EVENTS · LAST ${Math.min(limit, entries.length)}`;
  const list = document.createElement("ol");
  entries.slice(-limit).reverse().forEach((entry) => {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = entry.event;
    item.append(strong, ` · #${entry.seq} · ${entry.wallTime.slice(11, 23)}`);
    list.append(item);
  });
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = "No module events";
    list.append(item);
  }
  container.append(heading, list);
}

export function shortId(id) {
  return id.replace(/^(session|page)-/, "").slice(0, 8);
}
