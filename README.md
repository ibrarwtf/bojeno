# ⍢ Bojeno

Local-first job-search automation desktop app. See [`bojeno-project-brief.md`](./bojeno-project-brief.md) for the full architecture and decisions, and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the git/issue workflow.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Checks

```bash
npm run typecheck
npm run lint
npm run test
```

### Build

```bash
npm run build
```

Packaging (`electron-builder`) is deferred until v0.1 works end-to-end — see the project brief.
