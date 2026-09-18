import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'optimized');
const jobs = [
  { name:'logo-smelloff-white', src:'assets/brand/logo-smelloff-white.png', variants:[{width:160,format:'webp',quality:82},{width:240,format:'webp',quality:82}] },
  { name:'odorstrike-bottle-cutout', src:'assets/odorstrike-bottle-cutout.webp', variants:[{width:160,format:'webp',quality:82},{width:240,format:'webp',quality:82}] },
  { name:'odorstrike-bottle', src:'assets/odorstrike-bottle.jpg', variants:[{width:240,format:'webp',quality:82},{width:360,format:'webp',quality:82},{width:240,format:'avif',quality:58},{width:360,format:'avif',quality:58}] },
];
async function run(){
  fs.mkdirSync(OUT,{recursive:true});
  for(const job of jobs){
    const source=path.join(ROOT,job.src);
    if(!fs.existsSync(source)) throw new Error(`Missing source image: ${job.src}`);
    const meta=await sharp(source).metadata();
    if(!meta.width||!meta.height) throw new Error(`Unable to read dimensions: ${job.src}`);
    for(const v of job.variants){
      const target=path.join(OUT,`${job.name}-${v.width}.${v.format}`);
      let image=sharp(source).resize({width:v.width,withoutEnlargement:true,fit:'inside'});
      image=v.format==='avif' ? image.avif({quality:v.quality,effort:6}) : image.webp({quality:v.quality,effort:6});
      await image.toFile(target);
      console.log(`${path.relative(ROOT,target)} · ${fs.statSync(target).size} bytes · ${meta.width}x${meta.height} → ${v.width}px`);
    }
  }
}
function minifyCss(source) {
  let out = '';
  let quote = '';
  let comment = false;
  let pendingSpace = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1] || '';
    if (comment) {
      if (ch === '*' && next === '/') {
        comment = false;
        i += 1;
      }
      continue;
    }
    if (!quote && ch === '/' && next === '*') {
      comment = true;
      i += 1;
      continue;
    }
    if (quote) {
      out += ch;
      if (ch === '\\' && source[i + 1]) {
        out += source[++i];
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (pendingSpace && out && !/[({>:;,]$/.test(out)) out += ' ';
      pendingSpace = false;
      quote = ch;
      out += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      pendingSpace = true;
      continue;
    }
    const punctuation = /[{}:;,>+~]/.test(ch);
    if (pendingSpace) {
      if (out && !/[({>:;,]$/.test(out) && !punctuation) out += ' ';
      pendingSpace = false;
    }
    out += ch;
  }
  return out.replace(/;}/g, '}').trim();
}

function minifyCssFile(relPath) {
  const source = path.join(ROOT, relPath);
  if (!fs.existsSync(source)) throw new Error(`Missing CSS file: ${relPath}`);
  const outputRel = relPath.replace(/\.css$/, '.min.css');
  const target = path.join(ROOT, outputRel);
  fs.writeFileSync(target, minifyCss(fs.readFileSync(source, 'utf8')));
  console.log(`${outputRel} · ${fs.statSync(target).size} bytes`);
}

minifyCssFile('assets/css/soft.css');
minifyCssFile('assets/css/chrome.css');

run().catch(error=>{console.error(error);process.exit(1);});
