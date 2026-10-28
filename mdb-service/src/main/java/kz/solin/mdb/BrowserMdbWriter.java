package kz.solin.mdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

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
    if (args.length != 3) {
      System.err.println("Usage: BrowserMdbWriter /str/template.mdb /str/transfer.json /files/result.mdb");
      System.exit(2);
      return;
    }
    try {
      Path template = Path.of(args[0]).normalize();
      Path transferFile = Path.of(args[1]).normalize();
      Path result = Path.of(args[2]).normalize();
      if (!template.startsWith(Path.of("/str/")) ||
          !transferFile.startsWith(Path.of("/str/")) ||
          !result.startsWith(Path.of("/files/")) ||
          !result.getFileName().toString().matches("Transf_\\d+_\\d+_\\d+_Field\\.mdb")) {
        throw new IllegalArgumentException("Недопустимые пути для обмена.");
      }
      // CheerpJ 4.3 Java17 sometimes pads decoded non-ASCII strings with U+0000.
      // Normalize JSON *only at the browser boundary*, never modify an MDB template.
      JsonNode payload = cleanJson(new ObjectMapper().readTree(Files.readString(transferFile)));
      TransferWriter writer = new TransferWriter();
      TransferWriter.Identity id = writer.identity(payload);
      String desired = id.filename().replace(".mdb", "_Field.mdb");
      if (!desired.equals(result.getFileName().toString())) {
        throw new IllegalArgumentException("Имя файла не совпадает с данными лесничества.");
      }
      Files.createDirectories(result.getParent());
      writer.write(payload, template, result);
      if (!Files.isRegularFile(result) || Files.size(result) < 1024) {
        throw new IOException("MDB не был создан.");
      }
      System.out.println("SOLIN_MDB_OK:" + result.getFileName() + ":" + Files.size(result));
    } catch (Throwable error) {
      try {
        java.io.StringWriter text = new java.io.StringWriter();
        error.printStackTrace(new java.io.PrintWriter(text));
        Files.writeString(Path.of("/files/solin-browser-debug.txt"), text.toString());
      } catch (Exception ignored) {}
      System.err.println("SOLIN_MDB_ERROR:" + error);
      System.exit(1);
    }
  }
}
