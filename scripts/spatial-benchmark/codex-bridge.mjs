// Runs inside an empty network/filesystem namespace. Only the mounted Unix
// socket reaches a host broker that permits the declared model endpoint.
import http from "node:http";
import { spawn } from "node:child_process";
const config = JSON.parse(process.argv[2]);
const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      socketPath: "/transport.sock",
      path: request.url,
      method: request.method,
      headers: request.headers,
    },
    (r) => {
      response.writeHead(r.statusCode, r.headers);
      r.pipe(response);
    },
  );
  upstream.on("error", () => {
    response.writeHead(502);
    response.end("Model transport unavailable");
  });
  request.pipe(upstream);
});
server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const args = [
    ...config.args,
    "-c",
    `model_providers.benchmark.base_url="http://127.0.0.1:${port}"`,
  ];
  const child = spawn("/client/codex", args, {
    cwd: "/generation",
    env: {
      PATH: "/runtime",
      HOME: "/client-home",
      CODEX_HOME: "/client-home/.codex",
    },
    stdio: ["pipe", "inherit", "inherit"],
  });
  process.stdin.pipe(child.stdin);
  child.on("error", () => {
    server.close();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    server.close();
    process.exitCode = code ?? 1;
  });
});
