import { chromium, devices, Page } from 'playwright';  // Or 'chromium' or 'webkit'.
import { format } from "util";
import pptxgen from "pptxgenjs";
import PDFDocument  from "pdfkit";
import format from '@stdlib/string-format'
const { setImmediate: setImmediatePromise } = require('node:timers/promises');
import fs from "fs";

async function sleep(seconds) {
  return new Promise((resolve) =>setTimeout(resolve, seconds * 1000));
}


import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import {unified} from 'unified'


// slide.addNotes('This is my favorite slide!');


// let pres = new pptxgen();
// let slide = pres.addSlide();

class SpeakerNotes {
  markdown: String | null= null
  html: String | null = null
}

class PagePile {
  speakerNotes: SpeakerNotes
  screenshots: String[] = []

  constructor() {
    this.screenshots = []
    this.speakerNotes = new SpeakerNotes();
  }
}

class RevealPager {

  currentPile: PagePile;
  dump: PagePile[];
  page: Page;
  screenshotCounter: number = 1;

  constructor(page: Page) {
    this.page = page;
    this.dump = [];
    this.currentPile = this.getClearPile();
    console.dir(this.getClearPile());
  }

  public async convert(html: Compatible) {
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

  private getClearPile(): PagePile {
    return new PagePile();
  }

  private clearCurrentPile() {
    this.currentPile = this.getClearPile();
  }

  public async next() {
    const total: number = await this.page.evaluate(`Reveal.getTotalSlides()`);
    const current: number = await this.page.evaluate(`window.slideNumber`);

    // page.evaluate(`Reveal.isLastSlide()`) is just for safety if injected code doesn't work
    if (total == current || await this.page.evaluate(`Reveal.isLastSlide()`)) {
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

    const slideNotesHtml: string = await this.page.evaluate(`Reveal.getSlideNotes()`);
    this.currentPile.speakerNotes.html = slideNotesHtml;

    const slideNotesMarkdown: string = await this.convert(slideNotesHtml)   
    this.currentPile.speakerNotes.markdown = slideNotesMarkdown;

    console.info(`Speaker Notes: ${slideNotesMarkdown}`);
    console.log(JSON.stringify(this.dump));
    return true
  }

  public getDump() {
    return this.dump;
  }


}

class TimeoutError extends Error {}

class App {

  dumpFilename: string = 'stagecraft.json'

  public async main() {
    // await this.generatePptx();
    // await this.grabSlides();
    await this.generatePdf();
    
  }

  public async generatePptx() {    
    let pres = new pptxgen(); 
    pres.defineLayout({ name:'layout', width:16, height:9 });
    pres.layout = 'layout'
    
    const pagepiles = this.readDump();
    for (let pagepile of pagepiles) { 
      let notes = pagepile.speakerNotes.markdown;
      for (let filename of pagepile.screenshots) {
        console.info("Adding ${filename}");
        let slide = pres.addSlide();
        slide.background = { path: filename };  
        // slide.addImage({ path: "screenshot-0001.png", w: '100%', h:'100%' }); 
        if (notes) {
          slide.addNotes(String(notes));
        } else {
          slide.addNotes("\n");
        }
      }
    }
    
    // slide.addText('Hello World!', { x:1.5, y:1.5, fontSize:18, color:'363636', transparency: 100  });
    await pres.writeFile({ fileName: "example.pptx" });
    await sleep(1);
  }


  public async generatePdf() {
    var width = 1600;
    var height = 900;
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

    // doc.info['Title'] = 'Test Document';
    // doc.info['Author'] = 'Devon Govett';
    // doc.registerFont('Palatino', 'fonts/PalatinoBold.ttf');

    doc.pipe(fs.createWriteStream('example.pdf'));

    const pagepiles = this.readDump();
    for (let pagepile of pagepiles) { 
      let notes = pagepile.speakerNotes.markdown;
      for (let filename of pagepile.screenshots) {
        console.info("Adding ${filename}");
        doc.image(filename, 0, 0, {width: 1600, height: 900});
        doc.addPage(pagespec);
        // slide.addImage({ path: "screenshot-0001.png", w: '100%', h:'100%' }); 
        /*
        if (notes) {
          slide.addNotes(String(notes));
        } else {
          slide.addNotes("\n");
        }
        */
      }
    }
    // .text('Stretch', 320, 130);
  
    doc.end();
    await sleep(1);
  }

  
  public readDump(): PagePile[] {
    // TODO: how to parse into TypeScript structure?
    return JSON.parse(fs.readFileSync(this.dumpFilename, 'utf8'));
  }

  public writeDump(pager: RevealPager) {
    fs.writeFileSync(this.dumpFilename, JSON.stringify(pager.getDump(), null, 2), 'utf8');
  }

  public async grabSlides() {

      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto('http://devd.io:8000/reveal.html?file=jq/index.md');

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
      document.body.style.height = String(Math.ceil(document.body.clientHeight/zoom))  + 'px';
    `)


    console.info("Reveal.js is ready");
    
    await page.evaluate(`
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
      this.writeDump(pager)
    }
    await browser.close();
  }

}


new App().main()