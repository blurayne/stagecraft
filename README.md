# Stagecraft

## About

This tool is intended to export a Web Presentation from a browser (currently only Reveal.js supported) to a PDF or PPTX which then can be imported to Google Docs. 

**Features:**

- Adjust Zoom Level
- Have a 1:1 visual representation by using real screenshots
- Embed *Slide Notes* and maintain *Links* and as overlay
- Export as *PDF* or *PPTX*
  

## How Does it work?

The tool is basically divided in two sections:

**Dump/Export**

- Use Playwright and chromium to open a Reveal.js Presentation (as HTTP URL) 
- Iterate through slide (by pressing "Space") and make screenshots (save to disk)
- Create a `stagecraft.json` 
  - with slide notes, link and layout information embedded
  - and  `screenshots-%04d.png` alongside 


**Generate PPTX/PDF**

- Use stagecraft.json to generate PPTX or PDF

  

**NOTE:** I'm a beginner with TypeScript still learning from https://www.typescriptlang.org/ while thinking about *Python dataclasses* or `attr` in loving memory and thinking compiling is a much worse experience than in a static language.



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

5. Run app with `tsx index.ts`or `bin/stagecraft`



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

