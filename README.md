# XML Formatter & Validator

An XML formatter, minifier, and validator with a real code editor and a collapsible tree view.
Runs entirely in the browser; nothing you paste ever leaves your machine.

## Features

- **Format / Beautify** and **Minify / Compact**
- **Validate** using the browser's own `DOMParser` — the one spec-guaranteed way to detect a real
  parse failure, surfacing the engine's own error message rather than a possibly-wrong derived
  line/column
- **Tree View** — repeated sibling tags collapse into arrays and attributes/text land in
  `@attributes`/`#text`, the same generic tree renderer used by the JSON and YAML versions of this
  tool
- Upload a `.xml` file or paste directly; download the formatted result
- Dark / light theme, synced to your system preference

## Why I built this

This is one piece of a larger internal DevOps tool I built at work consolidating the utility pages
a platform engineer reaches for daily (JSON/YAML/XML formatters, IP/CIDR calculators, cron
checkers, certificate and JWT decoders) into one place — this repo is the XML formatter piece,
cleaned up and open-sourced on its own.

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [CodeMirror 6](https://codemirror.net/) (via `@uiw/react-codemirror`) for the editor panes
- The browser's native `DOMParser`/`XMLSerializer` — no XML parsing library needed

## Running locally

```bash
git clone https://github.com/Babug01/xml-formatter.git
cd xml-formatter
npm install
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
