package kz.solin.mdb;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.healthmarketscience.jackcess.ColumnBuilder;
import com.healthmarketscience.jackcess.DataType;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.TableBuilder;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

import static org.junit.jupiter.api.Assertions.*;

class TransferWriterTest {
  @TempDir Path temp;
  private final ObjectMapper json = new ObjectMapper();
  private final TransferWriter writer = new TransferWriter();

  private Path template() throws Exception {
    Path t = temp.resolve("Transf_213_2_2026.mdb");
    try (Database db = DatabaseBuilder.create(Database.FileFormat.V2000, t.toFile())) {
      new TableBuilder("Лесничество")
        .addColumn(new ColumnBuilder("POS", DataType.LONG))
        .addColumn(new ColumnBuilder("LESN", DataType.LONG))
        .addColumn(new ColumnBuilder("GodT", DataType.LONG))
        .addColumn(new ColumnBuilder("NOS", DataType.TEXT))
        .toTable(db).addRow(213, 2, 2026, "Бугетсайское");
      new TableBuilder("Квартал")
        .addColumn(new ColumnBuilder("POS", DataType.LONG))
        .addColumn(new ColumnBuilder("LESN", DataType.LONG))
        .addColumn(new ColumnBuilder("KV", DataType.LONG))
        .addColumn(new ColumnBuilder("KGLF", DataType.LONG))
        .toTable(db).addRow(213, 2, 1, 3);
      new TableBuilder("Выдел")
        .addColumn(new ColumnBuilder("POS", DataType.LONG))
        .addColumn(new ColumnBuilder("LESN", DataType.LONG))
        .addColumn(new ColumnBuilder("KV", DataType.LONG))
        .addColumn(new ColumnBuilder("KGLF", DataType.LONG))
        .addColumn(new ColumnBuilder("VD", DataType.LONG))
        .addColumn(new ColumnBuilder("PLV", DataType.DOUBLE))
        .toTable(db).addRow(213, 2, 1, 3, 1, 1.0d);
      new TableBuilder("НеизменённаяТаблица")
        .addColumn(new ColumnBuilder("POS", DataType.LONG))
        .addColumn(new ColumnBuilder("LESN", DataType.LONG))
        .addColumn(new ColumnBuilder("KV", DataType.LONG))
        .addColumn(new ColumnBuilder("KGLF", DataType.LONG))
        .addColumn(new ColumnBuilder("VD", DataType.LONG))
        .addColumn(new ColumnBuilder("Note", DataType.TEXT))
        .toTable(db).addRow(213, 2, 1, 3, 1, "Сохранять без изменений");
      new TableBuilder("Макет10")
        .addColumn(new ColumnBuilder("POS", DataType.LONG))
        .addColumn(new ColumnBuilder("LESN", DataType.LONG))
        .addColumn(new ColumnBuilder("KV", DataType.LONG))
        .addColumn(new ColumnBuilder("KGLF", DataType.LONG))
        .addColumn(new ColumnBuilder("VD", DataType.LONG))
        .addColumn(new ColumnBuilder("POR", DataType.LONG))
        .toTable(db).addRow(213, 2, 1, 3, 1, 15);
    }
    return t;
  }

  private JsonNode transfer() throws Exception {
    return json.readTree("""
      {
        "format":"SOLIN-MDB-Bridge-v1","identity":{"POS":213,"LESN":2,"GodT":2026},
        "schema":{
          "Лесничество":["POS","LESN","GodT","NOS"],
          "Квартал":["POS","LESN","KV","KGLF"],
          "Выдел":["POS","LESN","KV","KGLF","VD","PLV"],
          "Макет10":["POS","LESN","KV","KGLF","VD","POR"]
        },
        "tables":{
          "Лесничество":[{"POS":213,"LESN":2,"GodT":2026,"NOS":"Бугетсайское"}],
          "Квартал":[{"POS":213,"LESN":2,"KV":1,"KGLF":3}],
          "Выдел":[{"POS":213,"LESN":2,"KV":1,"KGLF":3,"VD":1,"PLV":17.25}],
          "Макет10":[{"POS":213,"LESN":2,"KV":1,"KGLF":3,"VD":1,"POR":12}]
        }
      }
      """);
  }

  @Test void createsRealMDBAndLeavesSourceUntouched() throws Exception {
    Path source = template();
    byte[] before = Files.readAllBytes(source);
    Path output = temp.resolve("Field.mdb");
    writer.write(transfer(), source, output);
    assertArrayEquals(before, Files.readAllBytes(source));
    assertFalse(java.util.Arrays.equals(before, Files.readAllBytes(output)));
    assertTrue(new String(Files.readAllBytes(output), 0, 32,
      java.nio.charset.StandardCharsets.ISO_8859_1).contains("Standard Jet DB"));
    try (Database db = DatabaseBuilder.open(output.toFile())) {
      assertEquals(1, db.getTable("Лесничество").getRowCount());
      assertEquals(1, db.getTable("Выдел").getRowCount());
      assertEquals("Сохранять без изменений", db.getTable("НеизменённаяТаблица").iterator().next().get("Note"));
      var row = db.getTable("Выдел").iterator().next();
      assertEquals(17.25d, ((Number) row.get("PLV")).doubleValue(), 0.0001);
      assertEquals(12, ((Number) db.getTable("Макет10").iterator().next().get("POR")).intValue());
    }
  }

  @Test void rejectsDifferentForestBeforeWritingSource() throws Exception {
    Path source = template();
    byte[] before = Files.readAllBytes(source);
    var transfer = (com.fasterxml.jackson.databind.node.ObjectNode)transfer();
    ((com.fasterxml.jackson.databind.node.ObjectNode)transfer.get("identity")).put("LESN", 3);
    assertThrows(IllegalArgumentException.class,
      () -> writer.write(transfer, source, temp.resolve("wrong.mdb")));
    assertArrayEquals(before, Files.readAllBytes(source));
  }

  @Test void rejectsMissingColumn() throws Exception {
    Path source = template();
    var transfer = (com.fasterxml.jackson.databind.node.ObjectNode)transfer();
    ((com.fasterxml.jackson.databind.node.ArrayNode)transfer.path("schema").path("Выдел")).add("NotARealColumn");
    assertThrows(IllegalArgumentException.class,
      () -> writer.write(transfer, source, temp.resolve("wrong2.mdb")));
  }

  @Test void rejectsOrphanReferenceInUnrepresentedTable() throws Exception {
    Path source = template();
    byte[] original = Files.readAllBytes(source);
    var transfer = (com.fasterxml.jackson.databind.node.ObjectNode)transfer();
    ((com.fasterxml.jackson.databind.node.ArrayNode)transfer.path("tables").path("Выдел")).removeAll();
    assertThrows(IllegalArgumentException.class,
        () -> writer.write(transfer, source, temp.resolve("orphan.mdb")));
    assertArrayEquals(original, Files.readAllBytes(source));
  }

  @Test void createsRealMDBInMemoryWithEditedValues() throws Exception {
    Path source = template();
    byte[] before = Files.readAllBytes(source);
    Path output = temp.resolve("MemoryField.mdb");
    writer.writeInMemory(transfer(), source, output);
    assertArrayEquals(before, Files.readAllBytes(source));
    try (Database db = DatabaseBuilder.open(output.toFile())) {
      assertEquals(1, db.getTable("Выдел").getRowCount());
      var stand = db.getTable("Выдел").iterator().next();
      assertEquals(17.25d, ((Number)stand.get("PLV")).doubleValue(), 0.0001);
      assertEquals("Сохранять без изменений", db.getTable("НеизменённаяТаблица").iterator().next().get("Note"));
    }
  }
}
