package kz.solin.mdb;

import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import java.io.File;

/** Verify a synthetic in-browser MDB and its updated field values. */
public final class BrowserSmokeVerifier {
  public static void main(String[] args) {
    try {
      if(args.length!=1 || !args[0].startsWith("/files/"))throw new IllegalArgumentException("Output path required");
      try(Database db=DatabaseBuilder.open(new File(args[0]))) {
        if(db.getTable("Выдел").getRowCount()!=1 || db.getTable("Квартал").getRowCount()!=1)
          throw new IllegalStateException("Row counts differ");
        Object area=db.getTable("Выдел").iterator().next().get("PLV");
        if(!(area instanceof Number) || Math.abs(((Number)area).doubleValue()-5.75)>0.00001)
          throw new IllegalStateException("Edited stand PLV did not round-trip: "+area);
        Object forest=db.getTable("Лесничество").iterator().next().get("NOS");
        if(forest==null || !String.valueOf(forest).startsWith("Тестовое"))
          throw new IllegalStateException("Cyrillic forest name lost");
        System.out.println("SOLIN_MDB_READBACK_OK:PLV=5.75");
      }
    }catch(Throwable e) {
      e.printStackTrace();
      System.exit(1);
    }
  }
}
