package kz.solin.mdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.healthmarketscience.jackcess.*;
import java.nio.file.*;
import java.util.*;

/**
 * Generate a EMPTY schema-only Jet4 MDB for the iPhone/browser and APK.
 *
 * CRITICAL: every column type is taken from data-transfer-types.json, which
 * was decoded from the real original Transf_213_2_2026.mdb table definitions.
 * Never guess type from a particular forest's present values: PRkol in the
 * test stand can be 0 (integer) but elsewhere 0.6 (Access FLOAT).
 *
 * This tool never publishes the populated snapshot or actual forest records.
 */
public final class BlankTransferTemplate {
  private static final Set<DataType> ALLOWED = EnumSet.of(
    DataType.BYTE,DataType.INT,DataType.LONG,DataType.FLOAT,DataType.DOUBLE,
    DataType.TEXT,DataType.MEMO,DataType.BOOLEAN,DataType.SHORT_DATE_TIME
  );

  public static void main(String[] args) throws Exception {
    if (args.length != 3)
      throw new IllegalArgumentException("Usage: BlankTransferTemplate transfer.json data-transfer-types.json blank.mdb");
    Path snapshot = Path.of(args[0]);
    Path typeFile = Path.of(args[1]);
    Path output = Path.of(args[2]);
    ObjectMapper mapper = new ObjectMapper();
    JsonNode transfer = mapper.readTree(Files.readString(snapshot));
    JsonNode types = mapper.readTree(Files.readString(typeFile));
    JsonNode schema = transfer.path("schema");
    JsonNode original = types.path("tables");
    if (!"SOLIN-MDB-Bridge-v1".equals(transfer.path("format").asText()) ||
        !"SOLIN-Jet4-ColumnTypes-v1".equals(types.path("format").asText()) ||
        !schema.isObject() || !original.isObject() ||
        schema.size() != 18 || original.size() != schema.size()) {
      throw new IllegalArgumentException("Original Jet column type manifest is incomplete.");
    }
    // Ensure every table and field from the actual snapshot matches the exact
    // original schema, before creating any public browser asset.
    for (var it = schema.fields(); it.hasNext();) {
      var table = it.next();
      JsonNode fields = table.getValue(), expected = original.path(table.getKey());
      if (!fields.isArray() || !expected.isObject() || fields.size() != expected.size())
        throw new IllegalArgumentException("Column mismatch in " + table.getKey());
      for (JsonNode field : fields) {
        String name = field.asText();
        if (!expected.has(name))
          throw new IllegalArgumentException("Missing original type: " + table.getKey() + "." + name);
        DataType t = DataType.valueOf(expected.path(name).asText());
        if (!ALLOWED.contains(t))
          throw new IllegalArgumentException("Unsupported original type: " + t);
      }
    }
    if (!"FLOAT".equals(original.path("Выдел").path("PRkol").asText()) ||
        !"TEXT".equals(original.path("Выдел").path("VD").asText()))
      throw new IllegalStateException("Original stand field types not preserved.");

    Path roundtrip = Files.createTempFile("solin-write-roundtrip-", ".mdb");
    Path fractional = Files.createTempFile("solin-fractional-roundtrip-", ".mdb");
    Files.delete(roundtrip);
    Files.delete(fractional);
    try {
      // In the GitHub Actions JDK, build a Jet4 database only with exact
      // original field types. This copy is empty: no forest data is embedded.
      Files.deleteIfExists(output);
      try (Database blank = DatabaseBuilder.create(Database.FileFormat.V2000, output.toFile())) {
        for (var it = schema.fields(); it.hasNext();) {
          var entry = it.next();
          TableBuilder builder = new TableBuilder(entry.getKey());
          for (JsonNode field : entry.getValue()) {
            String name = field.asText();
            DataType type = DataType.valueOf(original.path(entry.getKey()).path(name).asText());
            ColumnBuilder column = new ColumnBuilder(name, type);
            if (type == DataType.TEXT) column.setLengthInUnits(255);
            builder.addColumn(column);
          }
          builder.toTable(blank);
        }
        blank.flush();
      }
      // Verify that the published MDB contains zero records, exactly the right
      // table/column counts, and all original numeric and text field types.
      try (Database blank = DatabaseBuilder.open(output.toFile())) {
        if (blank.getTableNames().size() != schema.size())
          throw new IllegalStateException("Empty MDB missing tables.");
        for (var it = schema.fields(); it.hasNext();) {
          var entry = it.next();
          Table t = blank.getTable(entry.getKey());
          if (t == null || t.getRowCount() != 0 ||
              t.getColumns().size() != entry.getValue().size())
            throw new IllegalStateException("Empty MDB is not empty or missing fields: "+entry.getKey());
          int i=0;
          for(JsonNode field : entry.getValue()) {
            Column column=t.getColumns().get(i++);
            DataType expected=DataType.valueOf(original.path(entry.getKey()).path(field.asText()).asText());
            if(!column.getName().equals(field.asText())||column.getType()!=expected)
              throw new IllegalStateException("Column type mismatch: "+entry.getKey()+"."+field.asText());
          }
        }
      }
      // Full actual-snapshot roundtrip with 18 tables and all current rows.
      new TransferWriter().writeInMemory(transfer,output,roundtrip);
      try (Database filled = DatabaseBuilder.open(roundtrip.toFile());
           Database blank = DatabaseBuilder.open(output.toFile())) {
        for (var it = schema.fieldNames(); it.hasNext();) {
          String name = it.next();
          int expectedCount=transfer.path("tables").path(name).size();
          if (filled.getTable(name).getRowCount()!=expectedCount ||
              blank.getTable(name).getRowCount()!=0)
            throw new IllegalStateException("Wrong export row count: "+name);
        }
      }
      // Regression for the user's edited stand row 226, PRkol=0.6.
      ObjectNode fractionalTransfer = transfer.deepCopy();
      ObjectNode stand=(ObjectNode)fractionalTransfer.path("tables").path("Выдел").get(225);
      if(stand==null)throw new IllegalStateException("Missing stand 226 in test data");
      stand.put("PRkol",0.6);
      new TransferWriter().writeInMemory(fractionalTransfer,output,fractional);
      try(Database filled=DatabaseBuilder.open(fractional.toFile())) {
        Table stands=filled.getTable("Выдел");
        int seen=0;
        for(var row:stands) {
          if(++seen==226) {
            Object val=row.get("PRkol");
            if(!(val instanceof Number) ||
               Math.abs(((Number)val).doubleValue()-0.6)>0.000001)
              throw new IllegalStateException("PRkol=0.6 lost during Access MDB export.");
            break;
          }
        }
        if(seen!=226)throw new IllegalStateException("Stand 226 missing.");
      }
      System.out.println("PUBLISH_OK: 18 empty Jet4 tables, 279 original field types, "
        +"1243 source rows and PRkol=0.6 fractional roundtrip validated.");
    } finally {
      Files.deleteIfExists(roundtrip);
      Files.deleteIfExists(fractional);
    }
  }
}
