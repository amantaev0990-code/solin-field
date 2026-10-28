package kz.solin.mdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Executes the existing checked Jet writer inside a browser JVM (CheerpJ).
 * Never uses a server: source and JSON are provided via /str/ in the browser,
 * and the resulting file is placed in /files/ for JavaScript to download.
 */
public final class BrowserMdbWriter {
  private BrowserMdbWriter() {}

  private static String withoutTrailingNul(String input) {
    int limit=input.length();
    while(limit>0 && input.charAt(limit-1)=='\u0000') limit--;
    return limit==input.length() ? input : input.substring(0,limit);
  }
  private static JsonNode cleanJson(JsonNode node) {
    if(node==null)return null;
    if(node.isObject()){
      var result=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
      node.fields().forEachRemaining(item->{
        String key=withoutTrailingNul(item.getKey());
        if(key.isBlank()||result.has(key))throw new IllegalArgumentException("Повторяющееся или пустое поле Transfer после декодирования.");
        result.set(key,cleanJson(item.getValue()));
      });
      return result;
    }
    if(node.isArray()){
      var result=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();
      for(JsonNode item:node)result.add(cleanJson(item));
      return result;
    }
    if(node.isTextual())return com.fasterxml.jackson.databind.node.TextNode.valueOf(withoutTrailingNul(node.textValue()));
    return node;
  }

  public static void main(String[] args) {
    // CheerpJ's virtual NIO differs from desktop JVM. Jackcess documents this
    // fallback for runtimes with incomplete ByteBuffer/FileChannel behavior.
    // Must be set BEFORE loading any of Jackcess's implementation classes.
    System.setProperty("com.healthmarketscience.jackcess.brokenNio", "true");
    Thread.currentThread().setContextClassLoader(BrowserMdbWriter.class.getClassLoader());
    // 2 arguments: new template-free direct MDB export (preferred on iPhone).
    // 3 arguments: legacy original-template export for controlled comparisons.
    if (args.length != 2 && args.length != 3) {
      System.err.println("Usage: BrowserMdbWriter [/str/template.mdb] /str/transfer.json /files/result.mdb");
      System.exit(2);
      return;
    }
    try {
      boolean fresh = args.length == 2;
      Path template = fresh ? null : Path.of(args[0]).normalize();
      Path transferFile = Path.of(args[fresh ? 0 : 1]).normalize();
      Path result = Path.of(args[fresh ? 1 : 2]).normalize();
      if ((!fresh && !template.startsWith(Path.of("/str/"))) ||
          !transferFile.startsWith(Path.of("/str/")) ||
          !result.startsWith(Path.of("/files/")) ||
          !result.getFileName().toString().matches("Transf_\\d+_\\d+_\\d+\\.mdb")) {
        throw new IllegalArgumentException("Недопустимые пути для обмена.");
      }
      JsonNode payload = cleanJson(new ObjectMapper().readTree(Files.readString(transferFile)));
      TransferWriter writer = new TransferWriter();
      TransferWriter.Identity id = writer.identity(payload);
      if (!id.filename()
              .equals(result.getFileName().toString())) {
        throw new IllegalArgumentException("Имя файла не совпадает с данными лесничества.");
      }
      Files.createDirectories(result.getParent());
      // Do not surface a previous attempt\u0027s MSysObjects stacktrace as a new error.
      Files.deleteIfExists(Path.of("/files/solin-browser-debug.txt"));
      // A second export of the same forestry workspace must replace the previous
      // temporary result, not fail because it exists in CheerpJ's virtual FS.
      if (fresh) Files.deleteIfExists(result);
      if (fresh) writer.writeNewInMemory(payload, result);
      else writer.writeInMemory(payload, template, result);
      if (!Files.isRegularFile(result) || Files.size(result) < 1024) {
        throw new IOException("MDB не был создан.");
      }
      // A sidecar receipt written only AFTER Jackcess readback has verified all
      // exported table rowcounts. JS compares its downloaded Blob SHA-256 with
      // the independently reopened Java file, preventing stale VFS files from
      // being mistaken for a valid export.
      Map<String, Object> receipt = new LinkedHashMap<>();
      receipt.put("format", "SOLIN-JET-RECEIPT-v1");
      receipt.put("filename", result.getFileName().toString());
      receipt.put("size", Files.size(result));
      receipt.put("pos", id.pos);
      receipt.put("lesn", id.lesn);
      receipt.put("year", id.year);
      Map<String,Integer> counts = new LinkedHashMap<>();
      payload.path("tables").fields().forEachRemaining(e -> counts.put(e.getKey(),e.getValue().size()));
      receipt.put("counts", counts);
      MessageDigest hash = MessageDigest.getInstance("SHA-256");
      try (var input = Files.newInputStream(result)) {
        byte[] buffer = new byte[65536];
        int read;
        while ((read=input.read(buffer))!=-1) hash.update(buffer,0,read);
      }
      receipt.put("sha256", HexFormat.of().formatHex(hash.digest()));
      Files.writeString(result.resolveSibling(result.getFileName()+".verified.json"),
        new ObjectMapper().writeValueAsString(receipt));
      System.out.println("SOLIN_MDB_OK:" + result.getFileName() + ":" + Files.size(result));
    } catch (Throwable error) {
      try {
        java.io.StringWriter details = new java.io.StringWriter();
        error.printStackTrace(new java.io.PrintWriter(details));
        Files.writeString(Path.of("/files/solin-browser-debug.txt"), details.toString());
      } catch (Exception ignored) {}
      System.err.println("SOLIN_MDB_ERROR:" + error);
      System.exit(1);
    }
  }
}
