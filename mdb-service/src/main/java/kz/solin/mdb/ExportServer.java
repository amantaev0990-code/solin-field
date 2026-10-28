package kz.solin.mdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

/**
 * Self-hosted HTTPS-behind-proxy MDB conversion API.
 * Configure SOLIN_EXPORT_TOKEN, SOLIN_ALLOWED_ORIGIN, SOLIN_TEMPLATE_DIR, PORT.
 * Never commit/upload personal forest MDB files or the bearer token into GitHub.
 */
public final class ExportServer {
  private static final int MAX_BODY = 25 * 1024 * 1024;
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final Semaphore SLOTS = new Semaphore(1);

  private final String token;
  private final String allowedOrigin;
  private final Path templates;
  private final TransferWriter writer = new TransferWriter();

  private ExportServer(String token, String allowedOrigin, Path templates) {
    this.token = token;
    this.allowedOrigin = allowedOrigin;
    this.templates = templates;
  }

  public static void main(String[] args) throws IOException {
    String token = System.getenv("SOLIN_EXPORT_TOKEN");
    if (token == null || token.length() < 32) {
      throw new IllegalStateException("SOLIN_EXPORT_TOKEN must have at least 32 characters.");
    }
    String origin = System.getenv().getOrDefault("SOLIN_ALLOWED_ORIGIN", "https://amantaev0990-code.github.io");
    Path templates = Path.of(System.getenv().getOrDefault("SOLIN_TEMPLATE_DIR", "/data/templates")).toAbsolutePath().normalize();
    int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
    HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 8);
    ExportServer app = new ExportServer(token, origin, templates);
    server.createContext("/health", app::health);
    server.createContext("/api/export", app::export);
    server.setExecutor(Executors.newFixedThreadPool(4));
    server.start();
    System.out.println("SOLI-N MDB service listening, port=" + port + ", templates configured=" + Files.isDirectory(templates));
  }

  private void commonHeaders(HttpExchange exchange) {
    var h = exchange.getResponseHeaders();
    h.set("Cache-Control", "no-store, max-age=0");
    h.set("Pragma", "no-cache");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "no-referrer");
    h.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    String origin = exchange.getRequestHeaders().getFirst("Origin");
    if (allowedOrigin.equals(origin)) {
      h.set("Access-Control-Allow-Origin", origin);
      h.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      h.set("Vary", "Origin");
    }
  }

  private void health(HttpExchange exchange) throws IOException {
    commonHeaders(exchange);
    if (!"GET".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "Method not allowed"); return;
    }
    byte[] bytes = "{\"status\":\"ok\"}".getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(200, bytes.length);
    try (var output = exchange.getResponseBody()) { output.write(bytes); }
  }

  private void export(HttpExchange exchange) throws IOException {
    commonHeaders(exchange);
    if ("OPTIONS".equals(exchange.getRequestMethod())) {
      // Deny preflights from unexpected sites.
      if (!allowedOrigin.equals(exchange.getRequestHeaders().getFirst("Origin"))) {
        sendJson(exchange, 403, "Origin not allowed"); return;
      }
      exchange.sendResponseHeaders(204, -1);
      exchange.close();
      return;
    }
    if (!"POST".equals(exchange.getRequestMethod())) {
      sendJson(exchange, 405, "Use POST for MDB export"); return;
    }
    String origin = exchange.getRequestHeaders().getFirst("Origin");
    if (origin != null && !allowedOrigin.equals(origin)) {
      sendJson(exchange, 403, "Origin not allowed"); return;
    }
    String provided = exchange.getRequestHeaders().getFirst("Authorization");
    String expected = "Bearer " + token;
    if (provided == null || !MessageDigest.isEqual(
         provided.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8))) {
      sendJson(exchange, 401, "Unauthorized"); return;
    }
    String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
    if (contentType == null || !contentType.toLowerCase().startsWith("application/json")) {
      sendJson(exchange, 415, "Only JSON transfer supported"); return;
    }
    if (!SLOTS.tryAcquire()) { sendJson(exchange, 429, "Converter is busy. Try again."); return; }
    Path copy = null;
    try {
      byte[] body = exchange.getRequestBody().readNBytes(MAX_BODY + 1);
      if (body.length == 0 || body.length > MAX_BODY) {
        sendJson(exchange, 413, "Transfer too large (limit 25 MB)"); return;
      }
      JsonNode payload = JSON.readTree(body);
      TransferWriter.Identity id = writer.identity(payload);
      Path template = templates.resolve(id.filename()).normalize();
      if (!template.getParent().equals(templates)) throw new IllegalArgumentException("Invalid template path.");
      copy = Files.createTempFile("solin-transfer-", ".mdb");
      writer.write(payload, template, copy);
      byte[] result = Files.readAllBytes(copy);
      // Gate download on true binary Jet signature, rather than trusting the suffix.
      if (!new String(result, 0, Math.min(result.length, 32), StandardCharsets.ISO_8859_1)
            .contains("Standard Jet DB")) throw new IOException("MDB signature check failed.");
      var headers = exchange.getResponseHeaders();
      headers.set("Content-Type", "application/vnd.ms-access");
      headers.set("Content-Disposition", "attachment; filename=\"" +
          "Transf_" + id.pos + "_" + id.lesn + "_" + id.year + "_Field.mdb\"");
      exchange.sendResponseHeaders(200, result.length);
      try (var response = exchange.getResponseBody()) { response.write(result); }
    } catch (IllegalArgumentException badRequest) {
      sendJson(exchange, 422, badRequest.getMessage());
    } catch (Exception failed) {
      // Do not log or return customer data. Only a short error description.
      System.err.println("MDB export failed: " + failed.getClass().getSimpleName() + " - " + failed.getMessage());
      sendJson(exchange, 500, "Не удалось создать MDB. Проверьте формат исходного шаблона и таблиц.");
    } finally {
      if (copy != null) Files.deleteIfExists(copy);
      SLOTS.release();
      exchange.close();
    }
  }

  private void sendJson(HttpExchange exchange, int code, String message) throws IOException {
    byte[] data = JSON.writeValueAsBytes(java.util.Map.of("error", message));
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(code, data.length);
    try (var output = exchange.getResponseBody()) { output.write(data); }
  }
}
