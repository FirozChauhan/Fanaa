/**
 * Minimal in-memory S3-compatible server used for local development/testing.
 *
 * Point the app at it with:
 *   R2_ENDPOINT=http://127.0.0.1:9099 \
 *   R2_ACCOUNT_ID=local \
 *   R2_ACCESS_KEY_ID=test \
 *   R2_SECRET_ACCESS_KEY=test \
 *   R2_BUCKET_NAME=test-bucket \
 *   ENC_PASSPHRASE=whatever \
 *   npm run dev
 *
 * Supports exactly what fanaa uses: PutObject, GetObject, DeleteObject,
 * ListObjectsV2 (path-style, no auth).
 */
import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT ?? 9099);
const BUCKET = process.env.R2_BUCKET_NAME ?? "test-bucket";
const store = new Map(); // key -> Buffer

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function xml(code) {
  return `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/xml", ...headers });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);

  if (parts[0] !== BUCKET) return send(res, 404, xml("NoSuchBucket"));

  // ListObjectsV2
  if (req.method === "GET" && parts.length === 1 && url.searchParams.get("list-type") === "2") {
    const prefix = url.searchParams.get("prefix") ?? "";
    const contents = [...store.keys()]
      .filter((k) => k.startsWith(prefix))
      .sort()
      .map(
        (k) =>
          `<Contents><Key>${k}</Key><LastModified>2026-01-01T00:00:00.000Z</LastModified><ETag>"x"</ETag><Size>${store.get(k).length}</Size></Contents>`,
      )
      .join("");
    return send(
      res,
      200,
      `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${BUCKET}</Name><IsTruncated>false</IsTruncated><MaxKeys>1000</MaxKeys>${contents}</ListBucketResult>`,
    );
  }

  const key = parts.slice(1).join("/");

  if (req.method === "PUT") {
    const body = await readBody(req);
    store.set(key, body);
    return send(res, 200, "", { ETag: `"mock"`, "Content-Length": "0" });
  }

  if (req.method === "GET") {
    const body = store.get(key);
    if (!body) return send(res, 404, xml("NoSuchKey"));
    res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": body.length });
    return res.end(body);
  }

  if (req.method === "DELETE") {
    store.delete(key);
    res.writeHead(204);
    return res.end();
  }

  return send(res, 501, xml("NotImplemented"));
});

server.listen(PORT, () => {
  console.log(`mock-r2 listening on http://127.0.0.1:${PORT} (bucket: ${BUCKET})`);
});
