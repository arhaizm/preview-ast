export function pickStories(cards, limit, random = Math.random) {
  const pool = Array.from(cards);
  const count = Math.min(limit, pool.length);
  if (count === pool.length) return pool;

  for (let index = 0; index < count; index += 1) {
    const picked = index + Math.floor(random() * (pool.length - index));
    [pool[index], pool[picked]] = [pool[picked], pool[index]];
  }
  return pool.slice(0, count);
}

export function randomizeStories(section, random = Math.random) {
  if (!section || section.dataset.randomStories === "done") return;

  const list = section.querySelector("[data-story-list]");
  const pool = section.querySelector("[data-story-pool]");
  if (!list || !pool) return;

  section.dataset.randomStories = "done";
  if (list.contains(section.ownerDocument.activeElement)) return;

  const cards = pickStories(pool.content.children, list.children.length, random);
  if (cards.length !== list.children.length) return;
  list.replaceChildren(...cards.map((card) => card.cloneNode(true)));
}

if (typeof document !== "undefined") {
  randomizeStories(document.querySelector("[data-random-stories]"));
}
