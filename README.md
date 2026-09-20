# Mighty Picker

A standalone Jackbox game library and Steam launcher for Windows. Can also be run in a browser.

## Requirements

- Windows 10 or 11
- Steam installed with Jackbox Party Packs
- Node.js 18+ (for development and asset downloads)
- Rust (optional, only needed if compiling from source)

## Usage

### Running the app

Run the compiled executable:

```powershell
.\src-tauri\target\release\mighty-picker.exe
```

Or run the installer if you want start menu shortcuts:

```powershell
.\src-tauri\target\release\bundle\nsis\Mighty Picker_1.0.0_x64-setup.exe
```

### Development

To run with live reload:

```powershell
npm run dev
```

### Browser mode

If you prefer to run it in a browser instead of the desktop app:

```powershell
npx http-server --cors -p 8080
```

Then open `http://127.0.0.1:8080/`.

## Build instructions

### Prerequisites

- Node.js 18 or newer
- Rust toolchain (`stable-x86_64-pc-windows-msvc`)
- Visual Studio C++ Build Tools (Desktop development with C++)

### Steps

1. Install dependencies:
   ```powershell
   npm install
   ```

2. Download game artwork and generate the local manifest:
   ```powershell
   node download-assets.js
   ```

3. Build the release binary and installer:
   ```powershell
   npm run build
   ```

The build output will be placed in:
- Executable: `src-tauri\target\release\mighty-picker.exe`
- Installer: `src-tauri\target\release\bundle\nsis\Mighty Picker_1.0.0_x64-setup.exe`

## Asset updates

When the desktop app opens, it checks for missing game artwork and metadata in the background and downloads them automatically if connected to the internet.

To download all artwork manually from the command line:

```powershell
node download-assets.js
```

You can pass a delay in milliseconds as an argument (default is 500):

```powershell
node download-assets.js 1000
```

## Controls

### Mouse
- Click a game card to select it.
- Click "Launch on Steam" to start the game.

### Keyboard
- Arrow keys / WASD: navigate games
- Enter / Space: launch selected game
- F: open advanced filters
- R: cycle sort order
- Escape / Enter: dismiss modals

### Controller
- D-pad / Left stick: navigate games
- A: launch selected game / confirm
- B: back / dismiss modals
- LB / RB: cycle quick filters
- X: open advanced filters
- Y: cycle sort order

## Files

- `src-tauri/`: Tauri v2 desktop wrapper and config
- `game-launcher.html`: main UI markup
- `game-launcher.css`: styling
- `game-launcher.js`: UI logic, input handling, and Steam launcher
- `pack-games.json`: list of packs and games
- `game-metadata.json`: game details (player counts, duration, tags)
- `download-assets.js`: asset downloader script
- `assets/`: downloaded artwork and manifest