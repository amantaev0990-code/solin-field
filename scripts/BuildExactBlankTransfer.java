import com.healthmarketscience.jackcess.*;
import java.io.File;
import java.util.*;

/**
 * Private release helper. Copies ONLY the Jet table/column/index structure from
 * a user-provided original Transfer MDB into a fresh empty MDB. Does not copy
 * data pages, rows, macros, or production records. Do NOT commit either the
 * supplied original Transfer file or any populated output.
 *
 * Run with Jackcess 4.x on the classpath:
 * java -cp "<jackcess-with-dependencies.jar>:scripts" BuildExactBlankTransfer original.mdb empty.mdb
 */
public final class BuildExactBlankTransfer {
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("Usage: original.mdb fresh-empty.mdb");
    File input = new File(args[0]), output = new File(args[1]);
    if (!input.isFile() || output.exists()) throw new IllegalArgumentException("Original must exist; output must not exist.");
    int columnCount = 0;
    try (Database original = DatabaseBuilder.open(input)) {
      List<String> names = new ArrayList<>(original.getTableNames());
      Collections.sort(names);
      if (names.size() != 29) throw new IllegalStateException("Expected 29 source Transfer tables, got " + names.size());
      try (Database target = DatabaseBuilder.create(Database.FileFormat.V2000, output)) {
        for (String name : names) {
          Table src = original.getTable(name);
          TableBuilder tb = new TableBuilder(name);
          for (Column c : src.getColumns()) {
            ColumnBuilder cb = new ColumnBuilder(c.getName(), c.getType());
            if (c.getType() == DataType.TEXT) cb.setLengthInUnits(c.getLengthInUnits());
            if (c.isAutoNumber()) cb.setAutoNumber(true);
            if (c.isCompressedUnicode()) cb.setCompressedUnicode(true);
            tb.addColumn(cb); columnCount++;
          }
          for (Index ix : src.getIndexes()) {
            if (ix.isForeignKey()) throw new IllegalStateException("Unhandled source relationship " + name + "/" + ix.getName());
            IndexBuilder ib = new IndexBuilder(ix.getName());
            if (ix.isPrimaryKey()) ib.setPrimaryKey();
            else if (ix.isUnique()) ib.setUnique();
            if (ix.shouldIgnoreNulls()) ib.setIgnoreNulls();
            for (Index.Column c : ix.getColumns()) ib.addColumns(c.isAscending(), c.getName());
            tb.addIndex(ib);
          }
          tb.toTable(target);
        }
        target.flush();
      }
      try (Database check = DatabaseBuilder.open(output)) {
        List<String> actual = new ArrayList<>(check.getTableNames());
        Collections.sort(actual);
        if (!actual.equals(names) || columnCount != 383)
          throw new IllegalStateException("Missing original Transfer tables/fields");
        for (String name : names) {
          Table src = original.getTable(name), dest = check.getTable(name);
          if (dest.getRowCount() != 0 || dest.getColumnCount() != src.getColumnCount())
            throw new IllegalStateException("Non-empty or incomplete table: " + name);
          for (int i = 0; i < src.getColumns().size(); i++) {
            Column a = src.getColumns().get(i), b = dest.getColumns().get(i);
            if (!a.getName().equals(b.getName()) || a.getType() != b.getType() ||
                a.getLengthInUnits() != b.getLengthInUnits())
              throw new IllegalStateException("Different field: " + name + "." + a.getName());
          }
        }
      }
      System.out.println("TRANSFER_SCHEMA_OK: 29 empty Jet tables, 383 typed columns, no source rows copied");
    } catch (Exception e) {
      // A failed validation must never leave a release-eligible file behind.
      output.delete();
      throw e;
    }
  }
}
