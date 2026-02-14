
# <img src="https://altsia.github.io/altsia/altsia.svg" title="altsia" width=100 /> VS Code Extension

Visual Studio Code extension for the Altsia

## Development install

This extension depends on a locally linked `altsia` package in development mode.

### 1. Build `altsia` from source

```bash
git clone https://github.com/altsia/altsia
cd altsia
moon build --release
```

### 2. Create `package.json`

Create `target/js/release/build/package.json` with:

```json
{
  "name": "altsia",
  "version": "0.1",
  "main": "altsia.js",
  "types": "altsia.d.ts"
}
```

Then register it as a global link:

```bash
cd target/js/release/build
npm link
```

### 3. Link `altsia` into this extension

```bash
cd /path/to/vscode-altsia
npm install
npm link altsia
npm run copy:katex
```

### 4. Build and run extension development host

```bash
npm run compile
```

In VS Code, run the launch config: `Run Altsia Preview Extension` (or press `F5`).
