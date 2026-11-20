const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const esbuildDir = fs.readdirSync(path.join(root,'node_modules/.pnpm')).find(name => /^esbuild@/.test(name));
const esbuild = require(path.join(root,'node_modules/.pnpm',esbuildDir,'node_modules/esbuild'));
const asData = file => 'data:image/png;base64,'+fs.readFileSync(file).toString('base64');
const textureDir = path.join(root,'public/game/hex-map/tex');
const textures = Object.fromEntries(fs.readdirSync(textureDir).map(file => [file,asData(path.join(textureDir,file))]));
let renderer = fs.readFileSync(path.join(root,'app/utils/tondoRender.ts'),'utf8');
function replace(before,after){if(!renderer.includes(before)) throw new Error('Renderer changed: '+before); renderer = renderer.replace(before,after);}
replace("const TEX = '/game/hex-map/tex/'",'const TEXTURES = '+JSON.stringify(textures));
replace("im.src = TEX + name + '.png'","im.src = TEXTURES[name + '.png']");
replace("['spr-juan', 'JUAN'], ",'');
replace('  function draw(T: number, s: MapFrameState) {','  function setAvatar(sprite: Sprite) { SPR.JUAN = sprite; }\n  function draw(T: number, s: MapFrameState) {');
replace("blit('JUAN', jx, jy + 4, jq, jr, { frames: 4, frame: step === 0 ? 1 : 0, mirror: facing < 0 })","blit('JUAN', jx, jy - 2, jq, jr, { anchor: 'centre' })");
replace('dt / 380','dt / 760');
replace('return { draw, tick, walkTo, snap, pixelHex, walking:','return { draw, tick, walkTo, snap, pixelHex, setAvatar, walking:');
// Bundle a private snapshot so the preview never changes app code or needs a server.
renderer += '\nwindow.previewMap = {createTondoRenderer, NB, tile, tkey, hexDist};';
const bundled = esbuild.buildSync({stdin:{contents:renderer,loader:'ts',resolveDir:path.join(root,'app/utils')},bundle:true,format:'iife',target:'es2020',write:false}).outputFiles[0].text;
const assetRoot = 'C:/Users/Thirde/Pictures/pauwi-assets';
const frames = {};
for(const kind of ['idle','move']) frames[kind] = Array.from({length:20},(_,i) => asData(path.join(assetRoot,kind,'survivor-'+kind+'_flashlight_'+i+'.png')));
frames.original = [textures['spr-juan.png']];
const html = fs.readFileSync(path.join(__dirname,'source.html'),'utf8').replace('/* MAP_RENDERER */',bundled.replaceAll('</script','<\\/script')).replace('/* ANIMATION_FRAMES */',JSON.stringify(frames));
fs.writeFileSync(path.join(__dirname,'index.html'),html);
for(const [,script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new (require('node:vm').Script)(script);
console.log('Built standalone index.html: 40 original frames embedded; both scripts parse ('+Math.round(Buffer.byteLength(html)/1024)+' KB).');
