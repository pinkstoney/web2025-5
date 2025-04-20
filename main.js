import { program } from 'commander';
import superagent from 'superagent';
import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';

program
    .requiredOption('-h, --host <host>', 'Server address')
    .requiredOption('-p, --port <port>', 'Server port')
    .requiredOption('-c, --cache <path>', 'Path to cache directory')
    .parse(process.argv);

const options = program.opts();

async function ensureCacheDir() {
    try {
        await fs.access(options.cache);
    } catch (error) {
        await fs.mkdir(options.cache, { recursive: true });
        console.log(`Created cache directory: ${options.cache}`);
    }
}

function getImagePath(httpCode) {
    return path.join(options.cache, `${httpCode}.jpg`);
}

async function handleGet(httpCode, res) {
    const imagePath = getImagePath(httpCode);
    
    try {
        const imageData = await fs.readFile(imagePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(imageData);
    } catch (error) {
        try {
            const response = await superagent
                .get(`https://http.cat/${httpCode}`)
                .buffer(true)
                .responseType('arraybuffer');
            
            await fs.writeFile(imagePath, Buffer.from(response.body));
            
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(Buffer.from(response.body));
        } catch (fetchError) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`Not Found: No image for HTTP code ${httpCode}\n`);
        }
    }
}

function handlePut(httpCode, req, res) {
    const imagePath = getImagePath(httpCode);
    let data = [];

    req.on('data', chunk => {
        data.push(chunk);
    });

    req.on('end', async () => {
        try {
            const imageBuffer = Buffer.concat(data);
            await fs.writeFile(imagePath, imageBuffer);
            res.writeHead(201, { 'Content-Type': 'text/plain' });
            res.end(`Created: Image for HTTP code ${httpCode} saved\n`);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Server Error: ${error.message}\n`);
        }
    });
}

async function handleDelete(httpCode, res) {
    const imagePath = getImagePath(httpCode);

    try {
        await fs.access(imagePath);
        await fs.unlink(imagePath);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`OK: Image for HTTP code ${httpCode} deleted\n`);
    } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not Found: No image for HTTP code ${httpCode}\n`);
    }
}

async function processRequest(req, res) {
    await ensureCacheDir();

    const httpCode = req.url.substring(1); 

    if (!/^\d+$/.test(httpCode)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: URL should contain only an HTTP code (e.g., /200)\n');
        return;
    }

    switch (req.method) {
        case 'GET':
            await handleGet(httpCode, res);
            break;

        case 'PUT':
            handlePut(httpCode, req, res);
            break;

        case 'DELETE':
            await handleDelete(httpCode, res);
            break;

        default:
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed\n');
    }
}

const server = http.createServer((req, res) => {
    processRequest(req, res).catch(error => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${error.message}\n`);
    });
});

server.listen(options.port, options.host, () => {
    console.log(`Server running at http://${options.host}:${options.port}/`);
    console.log(`Cache directory: ${options.cache}`);
});

server.on('error', error => {
    console.error(`Server error: ${error.message}`);
    process.exit(1);
});


