import { chromium, devices, Page } from 'playwright'; // Or 'chromium' or 'webkit'.
import pptxgen from 'pptxgenjs';
import PDFDocument from 'pdfkit';
import format = require("@stdlib/string-format");
import * as fs from 'fs';
import { Command, OptionValues } from 'commander'; // Import OptionValues
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified'

async function sleep(seconds: number) {
 return new Promise((resolve) =>setTimeout(resolve, seconds * 1000));
}

interface SpeakerNotes {
 markdown?: string
 html?: string
}

interface PageLink {
 text: string
 href: string
 x: number
 y: number
 l: number
 t: number
 w: number
 h: number
}

interface PagePile {
 speakerNotes: SpeakerNotes
 screenshots: string[]
 links: PageLink[]
}

export class RevealPager {

 private currentPile!: PagePile;
 private dump!: PagePile[];
 private page: Page;
 private screenshotCounter: number = 1;

 constructor(page: Page) {
  this.page = page;
  this.currentPile = this.getCleanPagePile();
  this.dump = [];
 }

 public async convert(html: string) {
  const rehype = unified()
   .use(rehypeParse)
   .use(rehypeRemark)
   .use(remarkStringify);
 
  return String(await rehype.process(html));
 }

 public async createScreenshot() {
  const filename = format("screenshot-%04d.png", this.screenshotCounter);
  this.screenshotCounter += 1;
  console.info( `Creating Screenshot ${filename}`);
  // fullpage has to be false sicne we are using zoom!
  await this.page.screenshot({ path: filename, fullPage: false});
  this.currentPile.screenshots.push(filename);
  return filename;
 }

 private getCleanPagePile(): PagePile {
  return {
   screenshots: [],
   speakerNotes: {},
   links: []
  }
 }

 private clearCurrentPile() {
  this.currentPile = this.getCleanPagePile()
 }

 public async next() {
  const total: number = await this.page.evaluate(`Reveal.getTotalSlides()`);
  const current: number = await this.page.evaluate(`window.slideNumber`);

  // page.evaluate(`Reveal.isLastSlide()`) is just for safety if injected code doesn't work
  if (total === current || await this.page.evaluate(`Reveal.isLastSlide()`)) {
   return false;
  }

  this.dump.push(this.currentPile);
  this.clearCurrentPile();
 
  console.info(`Advancing to next slide ${current + 1}/${total}`);

  // console.log(await this.page.evaluate(`window.slideNumber`));
  const start = performance.now();
  // space will tragger next gragment or next slide
  // if it's next slide 'onslidetransitionstart' will set slideReady to false
  await this.page.keyboard.press('Space');
  await sleep(0.05); 
  // event 'onslidetransitionend' will set this to true
  await this.page.waitForFunction(`window.slideReady`);
  // except there was no such event and slideReady stayed true
  // which will occur when we just skip from one fragment to another
  // unfortunatly there is not event 'onfragmentransitionend'
  // so we check for the duration
  const transationDuration = (performance.now() - start) / 1000;
  if (transationDuration<0.20) {
   console.info(`No page change. Delaying for 1s`);
   await sleep(1);
  } else {
   console.info(`Transition took ${transationDuration}s`);
  }

  this.currentPile.links = await this.page.evaluate(`window.getLinkElements()`);
  console.info(`Got links: ${JSON.stringify(this.currentPile.links, null, 2)}`);

  const slideNotesHtml: string = await this.page.evaluate(`Reveal.getSlideNotes()`);
  this.currentPile.speakerNotes.html = slideNotesHtml;

  const slideNotesMarkdown: string = await this.convert(slideNotesHtml) 
  this.currentPile.speakerNotes.markdown = slideNotesMarkdown;

  console.info(`Speaker Notes: ${slideNotesMarkdown}`);
  return true
 }

 public getDump() {
  return this.dump;
 }


}

class App {

 // Default values
 private defaultDumpFilename: string = 'stagecraft.json';
 private defaultUrl: string = 'http://127.0.0.1:8000/local-reveal.html';
 private defaultPptxFilename: string = 'presentation.pptx';
 private defaultPdfFilename: string = 'presentation.pdf';

 private commanderApp: Command;

 constructor() {
 
  this.commanderApp = new Command();
  this.commanderApp
   .name("stagecraft")
   .description("Screenshot Reveal.js presentation in chromium using playwright and create PPTX or PDF")
   .version("0.1.0");
 }

 public async main() {

  this.commanderApp.command('export')
   .description('Create stagecraft export')
   .option('-u, --url <string>', 'URL to start with', this.defaultUrl)
   .option('-f, --filename <string>', 'Path to stagecraft dump file', this.defaultDumpFilename)
   .action((options: OptionValues) => {
    this.exportSlides(options.url, options.filename);
   });

  this.commanderApp.command('generate-pdf')
   .description('Generate a PDF from a stagecraft export')
   .argument('[pdf-filename]', 'Output PDF Filename', this.defaultPdfFilename)
   .option('-f, --filename <string>', 'Path to stagecraft dump file', this.defaultDumpFilename)
   .action((pdfFilename: string, options: OptionValues) => {
    this.generatePdf(pdfFilename, options.filename);
   });

  this.commanderApp.command('generate-pptx')
   .description('Generate a PPTX from a stagecraft export')
   .argument('[pptx-filename]', 'Output PPTX Filename', this.defaultPptxFilename)
   .option('-f, --filename <string>', 'Path to stagecraft dump file', this.defaultDumpFilename)
   .action((pptxFilename: string, options: OptionValues) => {
    this.generatePptx(pptxFilename, options.filename);
   });

  this.commanderApp.parse(process.argv);
 }

 // --- New/Updated Methods to use command options ---

 public async generatePptx(pptxFilename: string, dumpFilename: string) { 
  const pres = new pptxgen();
  pres.defineLayout({ name:'layout', width:1600/100, height:900/100 });
  pres.layout = 'layout'
  const pagepiles = this.readDump(dumpFilename);
  for (let pagepile of pagepiles) {
   let notes = (pagepile.speakerNotes.markdown && String(pagepile.speakerNotes.markdown).trim().length) ? pagepile.speakerNotes.markdown.trim() : "";
   for (let filename of pagepile.screenshots) {
    console.info(`Adding ${filename}`);
    let slide = pres.addSlide();
    slide.background = { "path": filename };
    // slide.addImage({ path: "screenshot-0001.png", w: '100%', h:'100%' });
    if (notes) {
     slide.addNotes(notes);
    } else {
     slide.addNotes("\n");
    }
    for (let link of pagepile.links) {
     if (link.l>0 && link.t>0) {
      console.log(`Adding Link for ${link.text}: ${link.href} (${link.l},${link.t}:${link.w}x${link.h})`);
     
      slide.addText("", {
       w: link.w/100,
       h: link.h/100,
       x: link.l/100,
       y: link.t/100,
       hyperlink: {
        tooltip: link.text,
        url: link.href
       },
       fill: { color: "FF0000", transparency: 100, type: "solid" },
       shape: pres.ShapeType.rect,
       // line: { color: "FF0000", width: 1, dashType: "solid" },
      });
      // debug: transparency: 50
     
     }
    }
   }
  }
 
  console.info("Writing file");
  await pres.writeFile({ fileName: pptxFilename });
  await sleep(1);
  console.info("Done");
 }


 public async generatePdf(pdfFilename: string, dumpFilename: string) {
  const width = 1600;
  const height = 900;

  let pageCounter = 1;

  let pagespec = {
   size: [width,height],
   margins : {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
   }
  };

  let doc = new PDFDocument(pagespec);

  doc.pipe(fs.createWriteStream(pdfFilename));

  const pagepiles = this.readDump(dumpFilename);
  for (let pagepile of pagepiles) {
   let notes = (pagepile.speakerNotes.markdown && String(pagepile.speakerNotes.markdown).trim().length) ? pagepile.speakerNotes.markdown.trim() : null;
   for (let filename of pagepile.screenshots) {
    if (pageCounter>1) {
     doc.addPage(pagespec);
    }
    console.info(`Adding ${filename}`);
    doc.image(filename, 0, 0, {width: 1600, height: 900});
    if (notes) {
     // This note call seems non-standard for PDFKit, 
     // but keeping it as-is from the original for functionality.
     doc.note(width-32, 8, 32, 32, notes) 
    }
    for (let link of pagepile.links) {
     if (link.l>0 && link.t>0) {
      console.log(`Adding Link for ${link.text}: ${link.href} (${link.l},${link.t}:${link.w}x${link.h})`);
      doc.link(link.l, link.t, link.w, link.h, link.href);
     }
    }
    pageCounter += 1;
    doc.flushPages();
   }
  }
  doc.end();
  console.info(`Writing PDF ${pdfFilename}`);
  await sleep(1);
 }


 public readDump(dumpFilename: string): PagePile[] {
  console.info(`Reading dump file: ${dumpFilename}`);
  return JSON.parse(fs.readFileSync(dumpFilename, 'utf8'));
 }

 public writeDump(pager: RevealPager, dumpFilename: string) {
  console.info(`Writing dump file: ${dumpFilename}`);
  fs.writeFileSync(dumpFilename, JSON.stringify(pager.getDump(), null, 2), 'utf8');
 }

 public async exportSlides(url: string, dumpFilename: string) {

   console.info(`Starting export from URL: ${url}`);
   const browser = await chromium.launch();
   const page = await browser.newPage();
   await page.goto(url); // Use the URL option

   const pager = new RevealPager(page);

   await page.keyboard.down('Control');
   await page.keyboard.press('0');
   await page.keyboard.up('Control');

   // await page.evaluate(`document.body.style.zoom=0.6`);
  
   page.setViewportSize({ width: 1600, height: 900 });
   await page.waitForFunction(`Reveal.isReady()`);

   await page.evaluate(`
   var zoom = 0.7;
   document.body.style.width = '';
   document.body.style.height = '';
   document.body.style.transform = 'translate(-50%,-50%) scale('+zoom+') translate(50%,50%)';
   document.body.style.width = String(Math.ceil(document.body.clientWidth/zoom)) + 'px';
   document.body.style.height = String(Math.ceil(document.body.clientHeight/zoom)) + 'px';
  `)


  console.info("Reveal.js is ready");
 
  await page.evaluate(`
 
   window.getLinkElements = function() {
    return Array.from(
     document
      .querySelectorAll('.slides > .present a'))
      .filter((elem) => elem.href)
      .map((elem) => {
       let bounds = elem.getBoundingClientRect();
       return {
         "text": elem.textContent,
         "href": elem.href,
         "x": bounds.x,
         "y": bounds.y,
         "w": bounds.width,
         "h": bounds.height,
         "t": bounds.top + window.scrollY,
         "l": bounds.left + window.scrollX
       }
      }
    );
   };

   Reveal.on('slidetransitionend', event => {
    window.slideReady = true;
   });
   Reveal.addEventListener('slidechanged', function(evt) {
    window.slideReady = false;
    window.slideNumber += 1
   });
   window.slideReady = true;
   window.slideNumber = 1;
  `);
  console.info("Injected Reveal.js slide event hook");
  await sleep(1);

  console.info("Reveal.js is ready");
  await pager.createScreenshot();
 
  await sleep(1);
  while (await pager.next()) {
   await pager.createScreenshot();
   this.writeDump(pager, dumpFilename)
  }
  await browser.close();
 }

}


new App().main()