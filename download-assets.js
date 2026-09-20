const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const catalogPath = path.join(root, "pack-games.json");
const assetsDir = path.join(root, "assets");
const manifestPath = path.join(assetsDir, "manifest.json");
const metadataPath = path.join(root, "game-metadata.json");
const utilityPacksUrl = "https://raw.githubusercontent.com/AkiraArtuhaxis/JackboxUtility-Server-en/main/api/v2/packs.json";
const utilityAssetsUrl = "https://raw.githubusercontent.com/AkiraArtuhaxis/JackboxUtility-Server-en/main/assets/";
const delayMs = Number(process.argv[2]) || 500;

const slugOverrides = {
  "You Don't Know Jack 2015": "you-dont-know-jack-2015",
  "You Don't Know Jack: Full Stream": "you-dont-know-jack-full-stream",
  "The Devils and the Details": "the-devils-and-the-details",
  "Fakin' It": "fakin-it",
  "Fakin' It All Night Long": "fakin-it-all-night-long",
  "Tee K.O.": "tee-ko",
  "Tee K.O. 2": "tee-k-o-2",
  "The Wheel of Enormous Proportions": "the-wheel-of-enormous-proportions",
  "The Poll Mine": "the-poll-mine",
  "Blather 'Round": "blather-round",
  "Dodo Re Mi": "dodo-re-mi",
  "We Forgot a Card!": "we-forgot-a-card",
  "Champ'd Up": "champd-up",
  "Quiplash 2": "quiplash-2-1",
  "FixyText": "fixy-text",
};

function slugFor(title) {
  return slugOverrides[title] || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function findArtwork(html, title) {
  const imagePattern = /<img[^>]+src=["'](https:\/\/cms-assets\.jackboxgames\.com\/[^"']+)["'][^>]*>/gi;
  const images = [...html.matchAll(imagePattern)].map((match) => ({
    url: match[1].replace(/&amp;/g, "&"),
    tag: match[0]
  })).filter(({ url }) => /\.(png|jpe?g|webp)(\?|$)/i.test(url));
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const titleImage = images.find(({ tag }) => {
    const alt = tag.match(/alt=["']([^"']+)["']/i)?.[1] || "";
    return alt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalizedTitle;
  });
  const pageImage = images.find(({ tag }) => /alt=["'][^"']+["']/i.test(tag));
  return titleImage?.url || pageImage?.url || images[0]?.url;
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeTitle(title) {
  return normalize(title).replace("thejackboxpartystarter", "");
}

function findIndexArtwork(html, game, pack) {
  const tiles = [...html.matchAll(/<h3[^>]*class=["']game-tile["'][^>]*>([\s\S]*?)<\/h3>/gi)]
    .map((match) => {
      const tile = match[1];
      const href = tile.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] || "";
      const image = tile.match(/<img[^>]+alt=["']([^"']+)["'][^>]+src=["']([^"']+)["']/i);
      return image ? { href, title: image[1], url: image[2].replace(/&amp;/g, "&") } : null;
    })
    .filter(Boolean);
  const titleKey = normalizeTitle(game.title);
  const packKey = normalize(pack.title);
  const exactTitle = (tile) => normalizeTitle(tile.title) === titleKey;
  const matchesTitle = (tile) => normalizeTitle(tile.title).includes(titleKey);
  const matchesPack = (tile) => normalizeTitle(tile.href).includes(packKey.replace("jackbox", ""));
  const match = tiles.find((tile) => exactTitle(tile) && matchesPack(tile))
    || tiles.find((tile) => matchesTitle(tile) && matchesPack(tile))
    || tiles.find(exactTitle)
    || tiles.find(matchesTitle);
  return match?.url;
}

function findUtilityGame(utilityPacks, game, pack) {
  const utilityPack = utilityPacks.find((candidate) => String(candidate.launchers_id?.steam) === String(pack.steamAppId));
  if (!utilityPack) return null;
  const pathKey = normalize(game.path);
  const titleKey = normalizeTitle(game.title);
  return utilityPack.games.find((candidate) => normalize(candidate.path) === pathKey)
    || utilityPack.games.find((candidate) => normalizeTitle(candidate.name) === titleKey)
    || null;
}

function findUtilityBackground(utilityGame) {
  return utilityGame?.background ? new URL(utilityGame.background, utilityAssetsUrl).toString() : null;
}

function cleanText(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function detailBlock(html, label) {
  const match = html.match(new RegExp(`<p[^>]*>${label}</p>[\\s\\S]*?</div>`));
  return match ? match[0] : "";
}

function detailValue(html, label) {
  const block = detailBlock(html, label);
  const values = [...block.matchAll(/<p[^>]*>(.*?)<\/p>/g)].map((match) => cleanText(match[1]));
  if (values[1]) return values[1];
  const plainValue = cleanText(block).replace(label, "").trim();
  return plainValue || "Unknown";
}

function extractMetadata(game, pack, html) {
  const familyBlock = detailBlock(html, "Family Friendly Setting");
  const moderationBlock = detailBlock(html, "Moderation Settings");
  const audience = detailValue(html, "Audience Capacity");
  const features = [];
  if (familyBlock.includes("circle-check")) features.push("Family friendly");
  if (moderationBlock.includes("circle-check")) features.push("Moderation");
  if (audience !== "Unknown" && audience !== "N/A") features.push(`Audience mode: ${audience}`);

  const languageBlock = detailBlock(html, "Languages");
  const language = [...languageBlock.matchAll(/<span[^>]*>(.*?)<\/span>/g)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);

  return {
    id: game.id,
    title: game.title,
    packId: pack.id,
    pack: pack.title,
    playerCount: detailValue(html, "Player Count"),
    duration: detailValue(html, "Duration"),
    features,
    gameType: detailValue(html, "Game Type"),
    language: language.length ? language : ["Unknown"]
  };
}

function fallbackMetadata(game, pack) {
  return {
    id: game.id,
    title: game.title,
    packId: pack.id,
    pack: pack.title,
    playerCount: "Unknown",
    duration: "Unknown",
    features: [],
    gameType: "Unknown",
    language: ["Unknown"],
    description: "Unknown",
    gameMode: "Unknown"
  };
}

function labelFor(value) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rangeLabel(range, suffix) {
  if (!range?.min || !range?.max) return "Unknown";
  return range.min === range.max ? `${range.min} ${suffix}` : `${range.min} - ${range.max} ${suffix}`;
}

function extractUtilityMetadata(game, pack, utilityGame) {
  const info = utilityGame?.game_info;
  if (!info) return fallbackMetadata(game, pack);
  const tags = Array.isArray(info.tags) ? info.tags : [];
  const features = tags.map(labelFor);
  if (info.family_friendly === "FAMILY_FRIENDLY") features.push("Family friendly");
  if (info.audience) features.push("Audience");
  if (info.moderation && info.moderation !== "NO_MODERATION") features.push("Moderation");
  if (info.stream_friendly === "PLAYABLE") features.push("Stream friendly");
  if (info.subtitles) features.push("Subtitles");
  const gameType = tags.length ? labelFor(tags[0]) : "Unknown";
  return {
    id: game.id,
    title: game.title,
    packId: pack.id,
    pack: pack.title,
    playerCount: rangeLabel(info.players, "Players"),
    duration: rangeLabel(info.playtime, "Minutes"),
    features: [...new Set(features)],
    gameType,
    language: [info.translation === "NATIVELY_TRANSLATED" ? "English (translated)" : "English"],
    description: info.description || info.small_description || info.tagline || "Unknown",
    gameMode: info.type ? labelFor(info.type) : "Unknown"
  };
}

function extensionFor(url, contentType) {
  const type = contentType.split(";")[0].toLowerCase();
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/jpeg") return ".jpg";
  const match = new URL(url).pathname.match(/\.(png|jpe?g|webp)$/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : ".img";
}

async function pause() {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function downloadGame(game, pack, utilityGame) {
  const metadata = extractUtilityMetadata(game, pack, utilityGame);

  try {
    const backgroundUrl = findUtilityBackground(utilityGame);
    if (!backgroundUrl) throw new Error("game background not found on Jackbox Utility server");
    const backgroundResponse = await fetch(backgroundUrl);
    if (!backgroundResponse.ok) throw new Error(`background returned ${backgroundResponse.status}`);
    const extension = extensionFor(backgroundUrl, backgroundResponse.headers.get("content-type") || "");
    const relativePath = `assets/${pack.id}-${game.id}-background${extension}`;
    await fs.writeFile(path.join(root, relativePath), Buffer.from(await backgroundResponse.arrayBuffer()));
    const asset = { path: relativePath, source: backgroundUrl, backgroundPath: relativePath, backgroundSource: backgroundUrl };
    return { asset, metadata };
  } catch (error) {
    console.warn(`Skipped ${game.title}: ${error.message}`);
    return { asset: null, metadata };
  }
}

async function readJsonIfPresent(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const games = catalog.packs.flatMap((pack) => pack.games.map((game) => ({ game, pack })));
  await fs.mkdir(assetsDir, { recursive: true });
  const utilityResponse = await fetch(utilityPacksUrl);
  if (!utilityResponse.ok) throw new Error(`Jackbox Utility server request failed: ${utilityResponse.status}`);
  const utilityPacks = JSON.parse(await utilityResponse.text()).packs;
  const manifest = await readJsonIfPresent(manifestPath, {});
  const metadata = await readJsonIfPresent(metadataPath, []);
  let updatedAssets = 0;
  let preservedAssets = 0;

  for (const [index, entry] of games.entries()) {
    const { game, pack } = entry;
    process.stdout.write(`[${index + 1}/${games.length}] ${game.title}\n`);
    const utilityGame = findUtilityGame(utilityPacks, game, pack);
    const result = await downloadGame(game, pack, utilityGame);
    const key = `${pack.id}:${game.id}`;
    if (result.asset) {
      manifest[key] = { ...manifest[key], ...result.asset };
      updatedAssets += 1;
    } else if (manifest[key]) {
      preservedAssets += 1;
    }
    const metadataIndex = metadata.findIndex((record) => `${record.packId}:${record.id}` === key);
    if (metadataIndex >= 0) {
      metadata[metadataIndex] = { ...fallbackMetadata(game, pack), ...metadata[metadataIndex] };
      if (result.metadata.playerCount !== "Unknown" || result.metadata.gameType !== "Unknown") metadata[metadataIndex] = result.metadata;
    } else {
      metadata.push(result.metadata);
    }
    if (index < games.length - 1) await pause();
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Updated ${updatedAssets} game assets and preserved ${preservedAssets} existing assets.`);
  console.log(`Manifest written to ${path.relative(root, manifestPath)}.`);
  console.log(`Metadata written to ${path.relative(root, metadataPath)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
