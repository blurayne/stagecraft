# webslides-exporter

## About

Export

- Use Playwright and chromium to open a Reveal.js Presentation (as HTTP URL) 
- Iterate through slide (by pressing "Space") and make screenshots (save to disk)
- Create a stagecraft.json with slide notes and screenshots information embeded

Generate PPTX/PDF

- Use stagecraft.json to generate PPTX or PDF


## Setup

```bash
yarn install
npx playwright install chromium 
npm install -g tsx 
```

## Usage

For now:

```bash
tsx index.ts
```

## TODO

- ( ) Links
  - ( ) Determine regions of links in HTML (element region)
  - ( ) Embed regions in stagecraft file
  - ( ) Make links possible for PDF
  - ( ) Make links possible for PPTX 

