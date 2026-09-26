import { readFileSync, writeFileSync } from "node:fs";
import { locals, foreigners } from "./data.mjs";

const taxonomy = JSON.parse(
  readFileSync(new URL("../../../docs/drafts/tag-taxonomy-proposal.json", import.meta.url), "utf8")
);
const known = new Set(taxonomy.tags.map((t) => t.id));
const errors = [];

// Which portrait each person gets. Generated images drift from their prompt, so a face is matched
// to a person by how it actually reads (tools/vision: apparent age, gender, region) rather than by
// the order the prompts were written in. Absent the file, fall back to the id-based name.
let photoMap = {};
try {
  photoMap = JSON.parse(readFileSync(new URL("./photo-map.json", import.meta.url), "utf8"));
} catch {
  console.warn("no photo-map.json — portraits fall back to <id>.jpg");
}

function tags(list, who) {
  const ids = list.split(/\s+/).filter(Boolean);
  for (const id of ids) if (!known.has(id)) errors.push(`${who}: unknown tag ${id}`);
  return ids;
}

function register(gender) {
  return gender === "m" ? "male" : gender === "f" ? "female" : "neutral";
}

function portrait(age, gender, who, job, place) {
  const person = gender === "m" ? "man" : "woman";
  return (
    `Realistic smartphone portrait photo, head and shoulders, of a ${who} ${person} who clearly looks ${age} years old ` +
    `and works as a ${job}, photographed in ${place}, Chiang Mai, Thailand. Hot tropical weather, light short-sleeved ` +
    `everyday clothes, natural daylight, relaxed friendly expression, softly blurred background, candid photo. No text, no watermark.`
  );
}

const profiles = [];

locals.forEach(([name, g, age, jobEn, jobTh, hood, introTh, introEn, give, learn], i) => {
  profiles.push({
    id: `l${String(i + 1).padStart(2, "0")}`,
    display_name: name,
    community: "local",
    gender: g,
    age,
    occupation: jobEn,
    occupation_th: jobTh,
    origin: "Thai",
    neighborhood: hood,
    stay: null,
    interface_language: "th",
    politeness_register: register(g),
    intro: introTh,
    intro_en: introEn,
    give: tags(give, name),
    learn: tags(learn, name),
    image_prompt: portrait(age, g, "Thai (Southeast Asian, northern Thai)", jobEn.toLowerCase(), hood),
  });
});

foreigners.forEach(([name, g, age, job, who, stay, hood, intro, give, learn, ui], i) => {
  profiles.push({
    id: `f${String(i + 1).padStart(2, "0")}`,
    display_name: name,
    community: "foreigner",
    gender: g,
    age,
    occupation: job,
    occupation_th: null,
    origin: who,
    neighborhood: hood,
    stay,
    interface_language: ui || "en",
    politeness_register: register(g),
    intro,
    intro_en: intro,
    give: tags(give, name),
    learn: tags(learn, name),
    image_prompt: portrait(age, g, who, job.toLowerCase(), hood),
  });
});

const counts = profiles.reduce((a, p) => ((a[p.community] = (a[p.community] || 0) + 1), a), {});
const unused = [...known].filter((id) => !profiles.some((p) => p.give.includes(id) || p.learn.includes(id)));

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
for (const p of profiles) p.photo = `portraits/${photoMap[p.id] ?? `${p.id}.jpg`}`;
writeFileSync(new URL("./profiles.json", import.meta.url), JSON.stringify(profiles, null, 1));
console.log("profiles", profiles.length, counts, "tags unused:", unused.join(", ") || "none");
