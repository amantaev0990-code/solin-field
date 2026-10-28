package kz.solin.mdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthmarketscience.jackcess.*;
import java.nio.file.*;
import java.util.*;

/** Build a schema-only, user-data-free Jet MDB at PUBLISH TIME, not on Safari.
 *  The generated MDB is blank. No original customer MDB is ever embedded.
 */
public final class BlankTransferTemplate {
  public static void main(String[] args) throws Exception {
    if (args.length!=2) throw new IllegalArgumentException("Usage: BlankTransferTemplate snapshot.json blank.mdb");
    Path snapshot=Path.of(args[0]), output=Path.of(args[1]);
    JsonNode transfer = new ObjectMapper().readTree(Files.readString(snapshot));
    if (!"SOLIN-MDB-Bridge-v1".equals(transfer.path("format").asText()) ||
        transfer.path("schema").size()!=18) throw new IllegalArgumentException("Unsupported Transfer schema");
    Path intermediate=Files.createTempFile("solin-build-only-", ".mdb");
    try {
      // Infer numeric/text Jet types from the already-public field dataset.
      new TransferWriter().writeNewInMemory(transfer,intermediate);
      try (Database filled=DatabaseBuilder.open(intermediate.toFile());
           Database blank=DatabaseBuilder.create(Database.FileFormat.V2000,output.toFile())) {
        Set<String> expected=new HashSet<>();
        transfer.path("schema").fieldNames().forEachRemaining(expected::add);
        if (!expected.equals(filled.getTableNames())) throw new IllegalStateException("Inferred schema does not match.");
        for (String name:expected) {
          Table source=filled.getTable(name);
          TableBuilder builder=new TableBuilder(name);
          for(Column field:source.getColumns()) {
            ColumnBuilder col=new ColumnBuilder(field.getName(),field.getType());
            if(field.getType()==DataType.TEXT) col.setLengthInUnits(255);
            builder.addColumn(col);
          }
          builder.toTable(blank);
        }
        blank.flush();
      }
      // A separate reopened file must have ALL expected tables, same column
      // names/types, and zero records. Fail build before publishing otherwise.
      try (Database filled=DatabaseBuilder.open(intermediate.toFile());
           Database blank=DatabaseBuilder.open(output.toFile())) {
        if(blank.getTableNames().size()!=18)throw new IllegalStateException("Template missing tables.");
        for(String name:filled.getTableNames()){
          Table a=filled.getTable(name), b=blank.getTable(name);
          if(b==null||b.getRowCount()!=0||a.getColumns().size()!=b.getColumns().size())
            throw new IllegalStateException("Template not blank: "+name);
          for(int i=0;i<a.getColumns().size();i++){
            Column ac=a.getColumns().get(i), bc=b.getColumns().get(i);
            if(!ac.getName().equals(bc.getName())||ac.getType()!=bc.getType())
              throw new IllegalStateException("Template field mismatch: "+name+"."+ac.getName());
          }
        }
      }
      System.out.println("PUBLISH_OK blank MDB "+Files.size(output)+" bytes; 18 empty tables, zero forest rows.");
    } finally { Files.deleteIfExists(intermediate); }
  }
}
