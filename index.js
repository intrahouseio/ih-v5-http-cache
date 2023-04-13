const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const { http, https } = require('follow-redirects');

let plugin;

let opt = {};
let settings = {};
let channels = [];

function onResponse(req, res) {
  const params = url.parse(req.url, true);

  if (params.query.proxy) {
    proxy(params.query.proxy, req, res);
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(`Not found query param 'proxy' in url! Example: http://YOU_IP:${settings.port || 8098}/?proxy=https://example.org/image.png`);
    res.end();
  }
}

function proxy(proxyUrl, req, res) {
  const target = url.parse(proxyUrl);

  const targetDir = path.join(__dirname, 'cache', target.host);
  const targeFile = crypto.createHash('md5').update(proxyUrl).digest('hex');
  const targetPath = path.join(targetDir, targeFile);

  if (fs.existsSync(targetPath)) {
    res.writeHead(200);
    fs.ReadStream(targetPath).pipe(res);
    return;
  }

  if (req && req.headers) {
    delete req.headers.host;
    delete req.headers.connection;
    delete req.headers['accept-encoding'];
  }

  const options = {
    hostname: target.hostname,
    port: target.port || (target.protocol === 'http:' ? 80 : 443),
    path: target.path,
    method: req.method,
    headers: req.headers

  };

  fs.mkdirSync(targetDir, { recursive: true });

  const file = fs.WriteStream(targetPath);

  try {
    (target.protocol === 'http:' ? http : https).get(options, res2 => {
      res2.on('data', data => {
        res.write(data);
        file.write(data);
      });
  
      res2.on('end', () => {
        res.end();
        file.close();
      })
  
      res2.on('error', () => {
        file.close();
      })
    });
  } catch (e) {
    file.close();
  }
}

async function main(options) {
  try {
    const argv = JSON.parse(process.argv[2]);
    const pluginapi = argv && argv.pluginapi ? argv.pluginapi : 'ih-plugin-api';
   
    plugin = require(pluginapi+'/index.js')();
  } catch (e) {
    console.log('ERROR: Missing or invalid pluginapi path')
    process.exit(1);
  }
  
  opt = plugin.opt;
  settings = await plugin.params.get();
  channels = await plugin.channels.get();

  plugin.log(`http-cache port: ${settings.port || 8098}`)

  http.createServer(onResponse).listen(settings.port || 8098);

  plugin.onChange('params', data => {
    process.exit(0);
  });
}

main();