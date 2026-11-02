package kz.solin.field;

import static androidx.test.platform.app.InstrumentationRegistry.getInstrumentation;
import static org.junit.Assert.*;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Table;
import com.healthmarketscience.jackcess.Row;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.util.Arrays;

/**
 * Executes the REAL Android Jackcess writer used by the Capacitor plugin.
 * Uses only the project's verified empty Jet transfer template, never a user's MDB.
 * A successful Gradle compilation alone cannot replace this on-emulator round trip.
 */
@RunWith(AndroidJUnit4.class)
public class SolinMdbInstrumentedTest {
  private static final String ASSET="public/vendor/solin-empty-transfer-v20261028-27.mdb";
  private static final int OWNER=213,FOREST=2;
  private final Context context=getInstrumentation().getTargetContext();

  private File blankCopy() throws Exception {
    File out=File.createTempFile("solin-instrumented-", ".mdb",context.getCacheDir());
    try(InputStream src=context.getAssets().open(ASSET); FileOutputStream dest=new FileOutputStream(out)){
      byte[] buffer=new byte[32768];int n;
      while((n=src.read(buffer))!=-1)dest.write(buffer,0,n);
    }
    return out;
  }

  private static JSONArray schema(Database db,String table) throws Exception {
    JSONArray cols=new JSONArray();
    for(com.healthmarketscience.jackcess.Column c:db.getTable(table).getColumns())
      cols.put(c.getName());
    return cols;
  }

  private static JSONObject address(int owner,int forest,int quarter,int glf) throws Exception {
    return new JSONObject().put("POS",owner).put("LESN",forest).put("KV",quarter).put("KGLF",glf);
  }

  private static JSONObject transfer(File template,boolean crossOwner) throws Exception {
    JSONObject schema=new JSONObject(),tables=new JSONObject();
    try(Database db=DatabaseBuilder.open(template)){
      for(String name:new String[]{"Лесничество","Квартал","Выдел","Макет10"}){
        assertNotNull("Missing template table: "+name,db.getTable(name));
        schema.put(name,schema(db,name));
      }
    }
    tables.put("Лесничество",new JSONArray().put(
      new JSONObject().put("POS",OWNER).put("LESN",FOREST).put("GodT",2026)));
    tables.put("Квартал",new JSONArray().put(
      address(OWNER,FOREST,1,24)));
    tables.put("Выдел",new JSONArray().put(
      address(crossOwner?OWNER+1:OWNER,FOREST,1,24)
        .put("VD",1).put("KU",2).put("PLV",1.5)));
    tables.put("Макет10",new JSONArray().put(
      address(OWNER,FOREST,1,24)
        .put("VD",1).put("IAR",1).put("POR","В").put("ZAP",40)));
    return new JSONObject().put("schema",schema).put("tables",tables);
  }

  private static void writeWithRealPlugin(JSONObject transfer,File copy) throws Exception {
    Method method=SolinMdbPlugin.class.getDeclaredMethod("replaceTables",
      JSONObject.class,int.class,int.class,File.class);
    method.setAccessible(true);
    try{method.invoke(null,transfer,OWNER,FOREST,copy);}
    catch(java.lang.reflect.InvocationTargetException ex){
      Throwable cause=ex.getCause();
      if(cause instanceof Exception)throw (Exception)cause;
      throw ex;
    }
  }

  @Test public void offlineMdbExportAndReopenPreservesRows() throws Exception {
    File original=blankCopy(),copy=blankCopy();
    try{
      byte[] untouched=Files.readAllBytes(original.toPath());
      writeWithRealPlugin(transfer(copy,false),copy);
      assertArrayEquals("Original blank template changed",untouched,
        Files.readAllBytes(original.toPath()));
      try(Database db=DatabaseBuilder.open(copy)){
        assertEquals(1,db.getTable("Лесничество").getRowCount());
        assertEquals(1,db.getTable("Квартал").getRowCount());
        assertEquals(1,db.getTable("Выдел").getRowCount());
        assertEquals(1,db.getTable("Макет10").getRowCount());
        Row stand=db.getTable("Выдел").iterator().next();
        assertEquals(OWNER,((Number)stand.get("POS")).intValue());
        assertEquals(FOREST,((Number)stand.get("LESN")).intValue());
        assertEquals(1,((Number)stand.get("VD")).intValue());
        assertEquals(1.5,((Number)stand.get("PLV")).doubleValue(),0.001);
        Row tree=db.getTable("Макет10").iterator().next();
        assertEquals("В",tree.get("POR"));
        assertEquals(40,((Number)tree.get("ZAP")).intValue());
      }
    }finally{original.delete();copy.delete();}
  }

  @Test public void wrongForestPreflightLeavesCopyUnmodified() throws Exception {
    File copy=blankCopy();
    try{
      byte[] original=Files.readAllBytes(copy.toPath());
      try{
        writeWithRealPlugin(transfer(copy,true),copy);
        fail("Writer must reject cross-forest row");
      }catch(IllegalArgumentException expected){
        assertTrue(expected.getMessage().contains("другого лесничества"));
      }
      assertArrayEquals("Preflight modified the output after rejection",
        original,Files.readAllBytes(copy.toPath()));
    }finally{copy.delete();}
  }
}
