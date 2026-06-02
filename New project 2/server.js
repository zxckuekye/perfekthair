const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const dbPath = path.join(root, "bookings.json");

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function readBookings() {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.bookings) ? data.bookings : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeBookings(bookings) {
  await fs.writeFile(dbPath, JSON.stringify({ bookings }, null, 2), "utf8");
}

function getBusyMap(bookings) {
  return bookings.reduce((busy, booking) => {
    if (!busy[booking.date]) busy[booking.date] = [];
    busy[booking.date].push(booking.time);
    return busy;
  }, {});
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json;charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function isValidBooking(data) {
  return ["date", "time", "name", "phone", "service"].every((field) => {
    return typeof data[field] === "string" && data[field].trim().length > 0;
  });
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/bookings" && request.method === "GET") {
    const bookings = await readBookings();
    sendJson(response, 200, { bookings, busy: getBusyMap(bookings) });
    return;
  }

  if (url.pathname === "/api/bookings" && request.method === "POST") {
    let data;
    try {
      data = await readJsonBody(request);
    } catch {
      sendJson(response, 400, { message: "Неверный формат данных." });
      return;
    }

    if (!isValidBooking(data)) {
      sendJson(response, 400, { message: "Заполните имя, телефон, услугу, дату и время." });
      return;
    }

    const bookings = await readBookings();
    const alreadyBooked = bookings.some((booking) => booking.date === data.date && booking.time === data.time);
    if (alreadyBooked) {
      sendJson(response, 409, { message: "Это время уже занято. Выберите другой слот.", busy: getBusyMap(bookings) });
      return;
    }

    const booking = {
      id: crypto.randomUUID(),
      date: data.date.trim(),
      time: data.time.trim(),
      name: data.name.trim(),
      phone: data.phone.trim(),
      service: data.service.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedBookings = [...bookings, booking];
    await writeBookings(updatedBookings);
    sendJson(response, 201, { booking, bookings: updatedBookings, busy: getBusyMap(updatedBookings) });
    return;
  }

  sendJson(response, 404, { message: "API endpoint not found." });
}

async function serveStatic(request, response, url) {
  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === "/") requestPath = "/index.html";

  const filePath = path.resolve(root, `.${requestPath}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain;charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    await serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, 500, { message: "Server error", error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`PERFEKT HAIR site: http://${host}:${port}`);
});
