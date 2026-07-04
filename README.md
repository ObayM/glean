<h1 align="center">
  <img src="./assets/icon.png" alt="Logo" width="300" />
  <br />Glean
</h1>
<h3 align="center">The coolest way to turn a highlighted word into an Anki flashcard</h3>
<div align="center">
  <img alt="GitHub Release" src="https://img.shields.io/github/v/release/ObayM/glean?logo=github&label=Latest%20Build">
  <img alt="GitHub Downloads (all assets, all releases)" src="https://img.shields.io/github/downloads/ObayM/glean/total?label=Downloads&logo=github">
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/ObayM/glean?style=flat&logo=github&label=Stars&color=yellow">
</div>

> [!CAUTION]
> This is early days. Glean glues together a browser, a free community AI proxy, and a local Anki add-on - expect the occasional flaky definition, a dead audio source, or a card that doesn't quite land. The code is small and open, so if something looks wrong you can go read exactly what it did.

![demo](./assets/demo.gif)

Glean doesn't touch Anki's files directly. It runs entirely as a Chrome extension: a content script watches for a highlighted or right-clicked word, hands the surrounding sentence to a background service worker, which asks an AI for a context-matched definition and example, grabs pronunciation audio from whichever source actually has the word, and posts the finished note to your local Anki through the [AnkiConnect](https://foosoft.net/projects/anki-connect/) add-on. Anki itself never has to know Glean exists.

This runs on Chrome and any other Chromium-based browser (Edge, Brave, Arc, and so on) that supports Manifest V3. See below for the state of things elsewhere.

## Installation

You'll need the official [Anki desktop app](https://apps.ankiweb.net/) with the AnkiConnect add-on installed, since Glean talks to your existing Anki library rather than replacing it.

The fastest way in (no toolchain needed):

1. Grab the [latest release zip](https://github.com/ObayM/glean/releases/latest/download/glean.zip) and unzip it.
2. Open `chrome://extensions`, flip on **Developer mode** (top right), and click **Load unpacked**.
3. Select the unzipped folder.

Building from source instead? Glean is a [WXT](https://wxt.dev) + Svelte + TypeScript project, so it needs a one-time build:

```bash
npm install
npm run build
```

Then **Load unpacked** and point Chrome at `.output/chrome-mv3/` (not the repo root — the manifest is generated into `.output`). For live-reloading development, `npm run dev` instead.

Then, in Anki:

1. Go to **Tools > Add-ons > Get Add-ons...** and enter the code `2055492159`.
2. Restart Anki. AnkiConnect now listens on `http://127.0.0.1:8765` whenever Anki is open.

Glean will open its onboarding wizard on first install - it'll walk you through getting a free [Hack Club AI](https://ai.hackclub.com/dashboard) key (required, for definitions) and a free [Merriam-Webster](https://dictionaryapi.com/) key (optional, for nicer pronunciation audio).

### But nothing happens when I click "Add to Anki"!

This almost always means Anki isn't open, or AnkiConnect isn't installed. Glean talks to `http://127.0.0.1:8765`, which only exists while Anki is running with the add-on active - there's no cloud fallback. Open Anki, wait a second for AnkiConnect to bind the port, and try again. The extension's popup shows a live **Anki Connection** status if you want to confirm before you start highlighting words.

### But my key won't verify!

Hack Club AI keys are free but rate-limited and occasionally slow to provision - give it a minute after generating one. If it still fails, hit **Test API Key** on the options page to see the actual error instead of guessing.

## Development

Glean is built with [WXT](https://wxt.dev), Svelte 5, and TypeScript. `npm run dev` starts a live-reloading dev build; `npm run build` produces `.output/chrome-mv3/`; `npm run check` runs the type + Svelte diagnostics (kept at zero). WXT generates the manifest, so you won't find one in the repo root — it lands in `.output`. The service worker's console lives behind "Inspect views: service worker" on the extensions page; the content script just uses normal page DevTools.

## Other browsers

> [!NOTE]
> Chrome and Chromium-based browsers (Edge, Brave, Arc) are the tested target. Since the move to WXT there's now a Firefox build target too — `npm run build:firefox` — but it's not yet verified end-to-end, so treat it as experimental. PRs welcome. Safari is a bigger lift and isn't currently planned.

## Customization

Open the extension's options page (`chrome://extensions` > Glean > Details > Extension options) to manage your API keys and target deck. Everything is stored locally in `chrome.storage.local` - there's no account, no sync, and no server keeping a copy of your words.

Hack Club AI is the default because it's free and needs no setup beyond an email, but if you'd rather bring your own key, switch **AI Provider** to **OpenRouter** on the options page and paste in an [OpenRouter](https://openrouter.ai/keys) key instead. Both providers let you type in any model ID they support (there's a sensible default pre-filled for each, so you don't have to) - OpenRouter in particular has a bunch of free-tier models (their IDs end in `:free`) if you want to experiment without spending anything.

If you want to change how the actual flashcard looks in Anki, that lives in one place: `CARD_CSS`, `CARD_FRONT`, and `CARD_BACK` in `lib/anki-connect.ts`. Edit those, rebuild (`npm run build`), reload the extension, and delete the existing **Glean Vocab** note type in Anki so it gets recreated with your changes - Glean only creates it once and won't overwrite an existing one.

## Credits

- [Anki](https://apps.ankiweb.net/) and [AnkiConnect](https://foosoft.net/projects/anki-connect/) for making a local flashcard API possible at all.
- [Hack Club AI](https://ai.hackclub.com/) for a free, no-nonsense LLM proxy, and [OpenRouter](https://openrouter.ai/) for the bring-your-own-key alternative.
- [Free Dictionary API](https://dictionaryapi.dev/) and [Merriam-Webster](https://dictionaryapi.com/) for pronunciation audio.
- Claude for cleaning up the code and generally being a good assistant.

## Legal

This is under the MIT License. See the [LICENSE](LICENSE) file for the legal mumbo jumbo. In short: do what you want with it, just don't blame me. If you're not sure what that means, see [choosealicense.com/licenses/mit](https://choosealicense.com/licenses/mit/). This code is provided to you for free, use at your own risk!
