const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { program } = require('commander');

// Налаштування параметрів командного рядка
program
    .requiredOption('-h, --host <host>', 'Server host address')
    .requiredOption('-p, --port <port>', 'Server port', parseInt)
    .requiredOption('-c, --cache <path>', 'Path to cache directory');

program.parse(process.argv);

const options = program.opts();

// Створення директорії для кешу, якщо вона не існує
async function initializeCacheDir() {
    try {
        await fs.access(options.cache);
        console.log(`Cache directory exists: ${options.cache}`);
    } catch {
        await fs.mkdir(options.cache, { recursive: true });
        console.log(`Cache directory created: ${options.cache}`);
    }
}

// Отримання шляху до файлу кешу для заданого HTTP коду
function getCacheFilePath(httpCode) {
    return path.join(options.cache, `${httpCode}.jpg`);
}

// GET - отримати картинку з кешу
async function handleGet(httpCode, res) {
    const filePath = getCacheFilePath(httpCode);

    try {
        const imageData = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(imageData);
        console.log(`Cache hit: ${httpCode}`);
    } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found\n');
        console.log(`Cache miss: ${httpCode}`);
    }
}

// PUT - записати картинку у кеш
async function handlePut(httpCode, req, res) {
    const filePath = getCacheFilePath(httpCode);
    const chunks = [];

    req.on('data', chunk => {
        chunks.push(chunk);
    });

    req.on('end', async () => {
        try {
            const imageData = Buffer.concat(chunks);
            await fs.writeFile(filePath, imageData);
            res.writeHead(201, { 'Content-Type': 'text/plain' });
            res.end('Created\n');
            console.log(`Saved to cache: ${httpCode}`);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error\n');
            console.error(`Error saving to cache: ${error.message}`);
        }
    });
}

// DELETE - видалити картинку з кешу
async function handleDelete(httpCode, res) {
    const filePath = getCacheFilePath(httpCode);

    try {
        await fs.unlink(filePath);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK\n');
        console.log(`Deleted from cache: ${httpCode}`);
    } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found\n');
        console.log(`Not found in cache: ${httpCode}`);
    }
}

// Створення HTTP сервера
const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Отримання HTTP коду з URL (наприклад, /200 -> 200)
    const httpCode = req.url.slice(1);

    // Перевірка, чи це валідний HTTP код
    if (!httpCode || !/^\d{3}$/.test(httpCode)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: Invalid HTTP code\n');
        return;
    }

    // Обробка різних HTTP методів
    switch (req.method) {
        case 'GET':
            handleGet(httpCode, res);
            break;
        case 'PUT':
            handlePut(httpCode, req, res);
            break;
        case 'DELETE':
            handleDelete(httpCode, res);
            break;
        default:
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed\n');
    }
});

// Ініціалізація та запуск сервера
async function startServer() {
    try {
        await initializeCacheDir();

        server.listen(options.port, options.host, () => {
            console.log(`Server is running on http://${options.host}:${options.port}`);
            console.log(`Cache directory: ${options.cache}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();