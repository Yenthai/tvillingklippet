import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.bokadirekt.se/places/tvillingklippet-ab-133892";
const PLACE_ID = 133892;

const EXPECTED_SERVICES = [
  ["3367080", "Klippning hår/skägg"],
  ["3376547", "Hårklippning & vaxning"],
  ["3376548", "Hårklippning skägg/hår & vaxning"],
  ["3384931", "Barn klippning tjej 0-7 år"],
  ["3384935", "Hårklippning barn 8-10 år tjej"],
  ["3367085", "Barn klippning 0-7 år"],
  ["3367086", "Pensionär klippning herr"],
  ["3367087", "Dam klippning"],
  ["3367158", "Herrklippning"],
  ["3367657", "Barn klippning 8-10 år"],
  ["3384944", "Rakning av hår/skägg"],
  ["3367177", "Endast skägg"],
  ["3371671", "Hårborttagning vaxning"],
  ["3372290", "Schamponering & styling herr"],
  ["3380948", "Schamponering & styling dam"],
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const indexPath = path.join(repoRoot, "index.html");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const readSource = async () => {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "TvillingklippetPriceSync/1.0 (+https://github.com/Yenthai/tvillingklippet)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Bokadirekt request failed with ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const extractJsonObject = (source, start) => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error("Could not parse Bokadirekt service object");
};

const findService = (source, id) => {
  let cursor = 0;

  while (cursor < source.length) {
    const idIndex = source.indexOf(`"id":${id}`, cursor);
    if (idIndex === -1) return null;

    const objectStart = source.lastIndexOf("{", idIndex);
    if (objectStart === -1) {
      cursor = idIndex + 1;
      continue;
    }

    const rawObject = extractJsonObject(source, objectStart);
    const service = JSON.parse(rawObject);

    if (service.id === Number(id) && service.place === PLACE_ID) {
      return service;
    }

    cursor = idIndex + 1;
  }

  return null;
};

const serviceToLabels = (service) => {
  if (service.extra?.inactive) {
    throw new Error(`Bokadirekt service ${service.id} is inactive`);
  }

  if (!Number.isFinite(service.price) || !Number.isFinite(service.duration)) {
    throw new Error(`Bokadirekt service ${service.id} is missing price or duration`);
  }

  return {
    id: String(service.id),
    name: service.name,
    priceLabel: `${service.price} kr`,
    durationLabel: `${Math.round(service.duration / 60)} min`,
  };
};

const loadServices = async () => {
  const source = await readSource();
  const services = new Map();
  const missing = [];

  for (const [id, expectedName] of EXPECTED_SERVICES) {
    const service = findService(source, id);

    if (!service) {
      missing.push(`${id} ${expectedName}`);
      continue;
    }

    services.set(id, serviceToLabels(service));
  }

  if (missing.length) {
    throw new Error(`Missing Bokadirekt services:\n${missing.map((item) => `- ${item}`).join("\n")}`);
  }

  return services;
};

const updateServiceBlock = (html, service) => {
  const detailsPattern = new RegExp(
    `<details\\s+class="price-item"\\s+data-bokadirekt-service-id="${service.id}"[^>]*>[\\s\\S]*?<\\/details>`,
    "u",
  );
  const match = html.match(detailsPattern);

  if (!match) {
    throw new Error(`Could not find price row in index.html for Bokadirekt service ${service.id}`);
  }

  let block = match[0];
  const nextBlock = block
    .replace(
      /<span class="service-price">[^<]*<\/span>/u,
      `<span class="service-price">${escapeHtml(service.priceLabel)}</span>`,
    )
    .replace(
      /(<div class="service-details">\s*<span>)[^<]*(<\/span>)/u,
      `$1${escapeHtml(service.durationLabel)}$2`,
    );

  if (nextBlock === block) {
    return { html, changed: false };
  }

  return {
    html: html.slice(0, match.index) + nextBlock + html.slice(match.index + block.length),
    changed: true,
  };
};

const validateLocalMappings = async () => {
  const html = await fs.readFile(indexPath, "utf8");
  const missing = EXPECTED_SERVICES.filter(([id]) => !html.includes(`data-bokadirekt-service-id="${id}"`));

  if (missing.length) {
    throw new Error(
      `Missing data-bokadirekt-service-id in index.html:\n${missing
        .map(([id, name]) => `- ${id} ${name}`)
        .join("\n")}`,
    );
  }
};

const main = async () => {
  await validateLocalMappings();
  const services = await loadServices();

  if (checkOnly) {
    console.log(`Found ${services.size} Bokadirekt services for place ${PLACE_ID}.`);
    for (const [id, service] of services) {
      console.log(`${id} ${service.name}: ${service.priceLabel}, ${service.durationLabel}`);
    }
    return;
  }

  let html = await fs.readFile(indexPath, "utf8");
  const changedServices = [];

  for (const service of services.values()) {
    const result = updateServiceBlock(html, service);
    html = result.html;

    if (result.changed) {
      changedServices.push(`${service.id} ${service.name}: ${service.priceLabel}, ${service.durationLabel}`);
    }
  }

  if (!changedServices.length) {
    console.log("No Bokadirekt price changes.");
    return;
  }

  await fs.writeFile(indexPath, html);
  console.log(`Updated ${changedServices.length} Bokadirekt services in index.html:`);
  for (const item of changedServices) {
    console.log(`- ${item}`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
