# Mighty Picker

A browser-based Jackbox game library and Steam launcher.

## Requirements

- Node.js 18 or newer
- A modern browser
- Steam installed with the relevant Jackbox Party Packs

Node 18 or newer is required because the asset downloader uses the built-in `fetch` API.

## Setup

1. Open a terminal in this folder.
2. Download the game artwork:

   ```powershell
   node download-assets.js
   ```

   The downloader reads `pack-games.json`, retrieves artwork from the Jackbox Utility server, retrieves metadata from the official Jackbox game pages, and writes the artwork to `assets/`. It also creates `assets/manifest.json` and the tracked `game-metadata.json` file.

3. Start a local web server. The page should be served over HTTP so it can load the catalog and local asset manifest:

   ```powershell
   npx http-server --cors -p 8080
   ```

4. Open [http://127.0.0.1:8080/game-launcher.html](http://127.0.0.1:8080/game-launcher.html) in your browser.

The `assets/` directory is intentionally ignored by Git. Run the downloader again whenever you want to refresh the local artwork.

## Downloader Options

The optional argument controls the delay between game requests in milliseconds. The default is 500 ms:

```powershell
node download-assets.js 1000
```

Some games may not be present in the current Jackbox Utility dataset. Those games are reported as skipped, and the downloader preserves any previously downloaded asset instead of replacing it.

## Controls

- Mouse: select a game, then choose **Launch on Steam**.
- Keyboard: use arrow keys or `WASD` to move, then press `Enter` or `Space` to launch.
- Controller: use the D-pad or left stick to move, `A` to launch, and `B` to move backward.

## Files

- `game-launcher.html`: the browser interface markup.
- `game-launcher.css`: launcher layout, controls, cards, detail panel, and modal styles.
- `game-launcher.js`: catalog loading, filtering, controller input, and Steam launch logic.
- `pack-games.json`: the game catalog and installed-game paths.
- `download-assets.js`: downloads official game artwork and generates the asset manifest.
- `game-metadata.json`: generated metadata for every catalog entry, including player count, duration, features, game type, pack, language, description, and game mode.
- `assets/`: generated local artwork; ignored by Git.