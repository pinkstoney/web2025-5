import { program } from 'commander';
import superagent from 'superagent';
import http from 'http';

program
    .requiredOption('-h, --host <host>', 'Server address')
    .requiredOption('-p, --port <port>', 'Server port')
    .requiredOption('-c, --cache <path>', 'Path to cache directory')
    .parse(process.argv);

const options = program.opts();

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server is running\n');
});

server.listen(options.port, options.host, () => {
});


