import {defineConfig} from 'vite';
import {resolve,relative,isAbsolute} from 'node:path';
import {realpathSync} from 'node:fs';
// Vite 6 rejects colons anywhere in file paths. This project lives in
// `ux:ui essentials`, so replace that check with a confined real-path guard.
const root=realpathSync(process.cwd());
export default defineConfig({base:process.env.GITHUB_ACTIONS?'./':'/downhill-ski-game/',build:{rollupOptions:{input:{game:resolve(root,'index.html')}}},server:{host:'127.0.0.1',fs:{strict:false}},plugins:[{
 name:'confine-local-files',
 configureServer(server){server.middlewares.use((req,res,next)=>{
  try{
   const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
   if(pathname.startsWith('/@id/')||pathname.startsWith('/@vite/'))return next();
   const file=pathname.startsWith('/@fs/')?resolve(pathname.slice(4)):resolve(root,'.'+pathname);
   let actual=file;try{actual=realpathSync(file);}catch{}
   const rel=relative(root,actual);
   if(rel.startsWith('..')||isAbsolute(rel)||rel.split('/').some(s=>s.startsWith('.')&&s!=='.vite')){res.statusCode=403;res.end('File outside game assets');return;}
   next();
  }catch{res.statusCode=400;res.end('Invalid path');}
 });}
}]});
