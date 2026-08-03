// Server statico minimo per i test: serve la cartella del progetto così com'è,
// senza dipendenze esterne. L'app è fatta di file statici, non serve altro.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.rules': 'text/plain; charset=utf-8',
};

// radice: cartella del progetto (una sopra test/lib)
const RADICE = path.resolve(__dirname, '..', '..');

function avvia(porta) {
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';
    // Niente uscite dalla cartella del progetto.
    const file = path.join(RADICE, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(RADICE)) { res.writeHead(403); return res.end('vietato'); }

    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('non trovato'); }
      res.writeHead(200, {
        'Content-Type': TIPI[path.extname(file).toLowerCase()] || 'application/octet-stream',
        // I test devono vedere sempre l'ultima build, mai una copia in cache.
        'Cache-Control': 'no-store',
      });
      res.end(buf);
    });
  });

  return new Promise((ris, rif) => {
    srv.on('error', rif);
    srv.listen(porta, '127.0.0.1', () => ris(srv));
  });
}

module.exports = { avvia, RADICE };

// Avviabile anche a mano: node test/lib/server.js 8091
if (require.main === module) {
  const porta = parseInt(process.argv[2], 10) || 8091;
  avvia(porta).then(() => console.log('in ascolto su http://localhost:' + porta));
}
