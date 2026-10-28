package kz.solin.mdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Local-only browser entrypoint. CheerpJ provides the /str/ input mount and /files/
 * writable mount; this class never connects to a server or sends user data away.
 * All files passed as args are fixed application-controlled VFS locations.
 *
 * Execution is a trial, not production proof. See IPHONE_MDB_EXPERIMENT.md.
 */
public final class BrowserMDBRunner {
  private static final ObjectMapper JSON = new ObjectMapper();

  public static void main(String[] args) {
    if (args.length != 3) {
      System.err.println("Usage: BrowserMDBRunner input.json template.mdb output.mdb");
      System.exit(2);
    }
    try {
      Path sourceJson = Path.of(args[0]);
      Path sourceMDB = Path.of(args[1]);
      Path outputMDB = Path.of(args[2]);
      // Only the expected virtual paths are accepted. No hidden traversal.
      if (!sourceJson.toString().startsWith("/str/solin-") ||
          !sourceMDB.toString().startsWith("/str/solin-") ||
          !outputMDB.toString().startsWith("/files/solin-") ||
          !outputMDB.toString().endsWith(".mdb")) {
        throw new IllegalArgumentException("Invalid browser virtual paths.");
      }
      JsonNode transfer = JSON.readTree(Files.readAllBytes(sourceJson));
      if (!"SOLIN-MDB-Bridge-v1".equals(transfer.path("format").asText())) {
        throw new IllegalArgumentException("Unexpected transfer format.");
      }
      Path tempSource = Path.of("/files/solin-jet-original-private.mdb");
      // All writing happens to a COPY of the original source file. Remove
      // any copy from prior failed runs before starting another.
      try {
        Files.copy(sourceMDB, tempSource, StandardCopyOption.REPLACE_EXISTING);
        Files.deleteIfExists(outputMDB);
        new TransferWriter().write(transfer, tempSource, outputMDB);
        System.out.println("SOLIN_MDB_OK " + Files.size(outputMDB));
      } finally {
        Files.deleteIfExists(tempSource);
      }
    } catch (Throwable error) {
      System.err.println("SOLIN_MDB_FAILED " + error.getClass().getSimpleName() + ": " + error.getMessage());
      System.exit(1);
    }
  }
}
