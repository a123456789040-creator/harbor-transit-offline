import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const release=JSON.parse(await readFile(new URL('./release.json',import.meta.url),'utf8'));
const port=Number(process.env.HARBOR_PORT??8837);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'harbor-transit-offline',...release}));return;}
    const name=decodeURIComponent(url.pathname),target=path.resolve(root,`.${name==='/'?'/index.html':name}`);
    if(!target.startsWith(path.resolve(root)+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    if(!(await stat(target)).isFile())throw new Error('Not a file');
    res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');
    res.end(req.method==='HEAD'?undefined:await readFile(target));
  }catch(e){res.writeHead(e instanceof URIError?400:404);res.end('Not found');}
}).on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 8837 is in use. Close the other offline copy and try again.':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${server.address().port}/`));
