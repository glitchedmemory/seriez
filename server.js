const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const path = require("path");

const dev = false;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    
    // Fix Turbopack CSS chunk mismatch
    if (parsedUrl.pathname === "/_next/static/chunks/259_-80kt8mhh.css") {
      const cssPath = path.join(__dirname, ".next/static/chunks/2urolxst4sso2.css");
      if (fs.existsSync(cssPath)) {
        res.setHeader("Content-Type", "text/css");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        fs.createReadStream(cssPath).pipe(res);
        return;
      }
    }
    
    handle(req, res, parsedUrl);
  }).listen(3000, () => {
    console.log("> Ready on http://localhost:3000");
  });
});
