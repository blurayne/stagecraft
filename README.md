# Stagecraft

## About

This tool exports a Reveal.js Web Presentation to to a PDF or PPTX using Playwright Chromium. The PPTX can then be used to import to Google Presentations – including text overlays ;)

I'm not much into [TypeScript](https://www.typescriptlang.org/) and this project was also a little expedition into the ECMA/TypeScript landscape. Honestly, I very much missed *Python Data Classes* or *@attr* and the toolchain gave me not what I'd expect from a dynamic language.

## Features

- Adjust Zoom Level
- Have a 1:1 visual representation by using real screenshots
- Embed *Slide Notes* and maintain *Links* and as overlay
- Export as *PDF* or *PPTX*
  
## Usage

For now `bin/stagecraft`:

```bash
Usage: stagecraft [options] [command]

Screenshot Reveal.js presentation in chromium using playwright and create PPTX or PDF

Options:
  -V, --version                    output the version number
  -h, --help                       display help for command

Commands:
  export                           Create stagecraft export
  generate-pdf [options] [string]  Generate a PDF from a stagecraft export
  generate-pptx [options]          Generate a PPTX from a stagecraft export
  help [command]                   display help for command
```

## How Does it work?

The tool is basically divided into two passes:

**Dump/Export**

- Use Playwright and chromium to open a Reveal.js Presentation (as HTTP URL) 
- Iterate through slide (by invoking the "Space" ley) and make screenshots (save to disk)
- Create a `stagecraft.json` 
  - with slide notes, link and layout information embedded
  - and  `screenshots-%04d.png` alongside 

**Generate PPTX/PDF**

- Generate PPTX or PDF from the dumped screenshits and the `stagecraft.json` file.


## Development Environment Setup

The OCI develpment image is not ready yet, therefore:

1. Install NodeJS 18 along with NPX and NPM

1. Install dependencies

   ```
   npm install
   ```

1. Install browser for playwright
   ```
   npx playwright install chrome
   ```

1. Install TSX (Node.js enhanced to run TypeScript & ESM) 
   `````
   npm install -g tsx
   `````

1. Run app with `tsx index.ts`or `bin/stagecraft`


## TODO

- [ ] CLI Interface
  - [ ] Turn hardcoded values into options

- [ ] Compile TS to JS using *@vercel/ncc* and build efficient OCI image  that only uses nodejs runtime
  *(since I do not want to package 600MB+ of node_modules into a container image; vercel/ncc build does 8.9MB includign a matching app icon!)*
- [ ] Development Environment
  - [ ] Makefile
  - [ ] Devcontainer Setup
  - [ ] Distro Container *(hopefully we can base on alpine)*
    

## Appendix

### Bun

`./stagecraft export` doesn't work with `bun` but building PDF and PPTX (which is only 0.08 o 0.11x faster – so *bun* – *no to the hype*)

```
47 |     const e = new _errors.TimeoutError(error.error.message);
48 |     e.stack = error.error.stack || '';
49 |     return e;
50 |   }
51 |   const e = new Error(error.error.message);
52 |   e.stack = error.error.stack || '';
                ^
TypeError: launch: launch: undefined is not an object (evaluating 'pipeRead.on')
```

Please read: [The Jared Wilcurt: Bun hype. How we learned nothing from Yarn](https://dev.to/thejaredwilcurt/bun-hype-how-we-learned-nothing-from-yarn-2n3j) especially the "Bun is actually much worse" section

