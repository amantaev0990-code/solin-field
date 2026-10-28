package kz.solin.mdb;

import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.TableBuilder;
import com.healthmarketscience.jackcess.ColumnBuilder;
import com.healthmarketscience.jackcess.DataType;
import java.nio.file.Files;
import java.nio.file.Path;

/** Create public, synthetic Jet MDB files for automated CheerpJ smoke tests only. */
public final class BrowserSmokeFixture {
  public static void main(String[] args) throws Exception {
    if (args.length != 1) throw new IllegalArgumentException("Pass output folder");
    Path dir=Path.of(args[0]);
    Files.createDirectories(dir);
    Path template=dir.resolve("template.mdb");
    try (Database db=DatabaseBuilder.create(Database.FileFormat.V2000, template.toFile())) {
      new TableBuilder("Лесничество")
        .addColumn(new ColumnBuilder("POS",DataType.LONG))
        .addColumn(new ColumnBuilder("LESN",DataType.LONG))
        .addColumn(new ColumnBuilder("GodT",DataType.LONG))
        .addColumn(new ColumnBuilder("NOS",DataType.TEXT))
        .toTable(db).addRow(213,2,2026,"Тестовое");
      new TableBuilder("Квартал")
        .addColumn(new ColumnBuilder("POS",DataType.LONG))
        .addColumn(new ColumnBuilder("LESN",DataType.LONG))
        .addColumn(new ColumnBuilder("KV",DataType.LONG))
        .addColumn(new ColumnBuilder("KGLF",DataType.LONG))
        .toTable(db).addRow(213,2,1,1);
      new TableBuilder("Выдел")
        .addColumn(new ColumnBuilder("POS",DataType.LONG))
        .addColumn(new ColumnBuilder("LESN",DataType.LONG))
        .addColumn(new ColumnBuilder("KV",DataType.LONG))
        .addColumn(new ColumnBuilder("KGLF",DataType.LONG))
        .addColumn(new ColumnBuilder("VD",DataType.LONG))
        .addColumn(new ColumnBuilder("PLV",DataType.DOUBLE))
        .toTable(db).addRow(213,2,1,1,1,1.5d);
      db.flush();
    }
    Files.writeString(dir.resolve("transfer.json"),"""
      {"format":"SOLIN-MDB-Bridge-v1","identity":{"POS":213,"LESN":2,"GodT":2026},
       "schema":{"Лесничество":["POS","LESN","GodT","NOS"],"Квартал":["POS","LESN","KV","KGLF"],"Выдел":["POS","LESN","KV","KGLF","VD","PLV"]},
       "tables":{"Лесничество":[{"POS":213,"LESN":2,"GodT":2026,"NOS":"Тестовое"}],
                 "Квартал":[{"POS":213,"LESN":2,"KV":1,"KGLF":1}],
                 "Выдел":[{"POS":213,"LESN":2,"KV":1,"KGLF":1,"VD":1,"PLV":5.75}]}}
      """);
    System.out.println("Generated synthetic MDB browser fixture; no customer records.");
  }
}
