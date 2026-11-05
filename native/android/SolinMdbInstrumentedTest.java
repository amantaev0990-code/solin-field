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
  @Test public void invalidNumbersCannotOverflowOrDisappearInMdb() throws Exception {
    File copy=blankCopy();
    try(Database db=DatabaseBuilder.open(copy)) {
      Table probe=new com.healthmarketscience.jackcess.TableBuilder("RangeProbe")
        .addColumn(new com.healthmarketscience.jackcess.ColumnBuilder("F",com.healthmarketscience.jackcess.DataType.FLOAT))
        .addColumn(new com.healthmarketscience.jackcess.ColumnBuilder("D",com.healthmarketscience.jackcess.DataType.DOUBLE))
        .addColumn(new com.healthmarketscience.jackcess.ColumnBuilder("B",com.healthmarketscience.jackcess.DataType.BYTE)).toTable(db);
      Method convert=SolinMdbPlugin.class.getDeclaredMethod("convert",Object.class,com.healthmarketscience.jackcess.Column.class);
      convert.setAccessible(true);
      for(String[] item:new String[][]{{"F","1e40"},{"F","1e-60"},{"F","NaN"},{"D","1e400"},{"D","1e-500"},{"B","256"},{"B","-1"}}) {
        try { convert.invoke(null,item[1],probe.getColumn(item[0]));fail("Invalid MDB number accepted: "+item[0]); }
        catch(java.lang.reflect.InvocationTargetException e) { assertTrue(e.getCause() instanceof IllegalArgumentException); }
      }
      assertEquals(0f,convert.invoke(null,"0",probe.getColumn("F")));
      assertEquals(1.25f,convert.invoke(null,"1.25",probe.getColumn("F")));
      assertNull(convert.invoke(null,JSONObject.NULL,probe.getColumn("F")));
    } finally { copy.delete(); }
  }
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
      for(String name:new String[]{"Лесничество","Квартал","Выдел","Макет10","Макет16"}){
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
        .put("VD","001").put("KU",2).put("PLV",1.5)));
    tables.put("Макет10",new JSONArray().put(
      address(OWNER,FOREST,1,24)
        .put("VD","001").put("IAR",1).put("POR","В").put("ZAP",40)));
    tables.put("Макет16",new JSONArray().put(
      address(OWNER,FOREST,1,24).put("VD","001").put("Por16","К")
        .put("Koef16",1).put("Voz16",202).put("H16","КЕР  ")
        .put("Ediz",0.30000001192092896).put("Ur16",123.1234567890123)
        .put("Neds",1).put("Sbor",1)));
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
        assertEquals(1,db.getTable("Макет16").getRowCount());
        Row stand=db.getTable("Выдел").iterator().next();
        assertEquals(OWNER,((Number)stand.get("POS")).intValue());
        assertEquals(FOREST,((Number)stand.get("LESN")).intValue());
        assertEquals("001",String.valueOf(stand.get("VD")));
        assertEquals("001",String.valueOf(db.getTable("Макет10").iterator().next().get("VD")));
        assertEquals(1.5,((Number)stand.get("PLV")).doubleValue(),0.001);
        Row tree=db.getTable("Макет10").iterator().next();
        assertEquals("В",tree.get("POR"));
        assertEquals(40,((Number)tree.get("ZAP")).intValue());
        Row material=db.getTable("Макет16").iterator().next();
        assertEquals("001",material.get("VD"));assertEquals("КЕР  ",material.get("H16"));
        assertEquals(0.30000001192092896,((Number)material.get("Ediz")).doubleValue(),0.0);
        assertEquals(123.1234567890123,((Number)material.get("Ur16")).doubleValue(),0.0);
      }
      JSONObject zeroAndNull=transfer(copy,false);
      JSONObject row=zeroAndNull.getJSONObject("tables").getJSONArray("Макет16").getJSONObject(0);
      row.put("H16",JSONObject.NULL).put("Ediz",0).put("Ur16",JSONObject.NULL);
      writeWithRealPlugin(zeroAndNull,copy);
      try(Database db=DatabaseBuilder.open(copy)){
        Row material=db.getTable("Макет16").iterator().next();
        assertNull(material.get("H16"));assertNull(material.get("Ur16"));
        assertEquals(0.0,((Number)material.get("Ediz")).doubleValue(),0.0);
      }
      assertArrayEquals(untouched,Files.readAllBytes(original.toPath()));
    }finally{original.delete();copy.delete();}
  }

  @Test public void androidDocumentSaveReopensSameMdbWithStand() throws Exception {
    File prepared=blankCopy();
    File destination=File.createTempFile("solin-saf-output-", ".mdb", context.getCacheDir());
    try {
      // Mirrors ACTION_CREATE_DOCUMENT: the destination exists with size 0 first.
      assertEquals(0, destination.length());
      writeWithRealPlugin(transfer(prepared,false),prepared);
      long written=SolinMdbPlugin.writeVerifiedDocument(context,prepared,
        android.net.Uri.fromFile(destination));
      assertTrue("Save must not leave a 0-byte MDB",written>2048);
      assertEquals(prepared.length(),written);
      assertArrayEquals(Files.readAllBytes(prepared.toPath()),
        Files.readAllBytes(destination.toPath()));
      try (Database db=DatabaseBuilder.open(destination)) {
        assertEquals(1,db.getTable("Лесничество").getRowCount());
        assertEquals(1,db.getTable("Квартал").getRowCount());
        assertEquals(1,db.getTable("Выдел").getRowCount());
        assertEquals("001",String.valueOf(db.getTable("Выдел").iterator().next().get("VD")));
      }
    } finally { prepared.delete(); destination.delete(); }
  }

  @Test public void androidDownloadsPublishesOnlyVerifiedMdb() throws Exception {
    if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return;
    File prepared=blankCopy();
    String fileName="Transf_213_2_2098.mdb";
    android.net.Uri published=null;
    try {
      writeWithRealPlugin(transfer(prepared,false),prepared);
      com.getcapacitor.JSObject result=SolinMdbPlugin.saveVerifiedToDownloads(
        context,prepared,fileName);
      assertTrue(result.getBoolean("saved"));
      assertTrue(result.getBoolean("verified"));
      assertEquals(prepared.length(),result.getLong("bytes"));
      assertEquals("Загрузки/SOLI-N Field",result.getString("folder"));
      android.content.ContentResolver resolver=context.getContentResolver();
      try (android.database.Cursor rows=resolver.query(
          android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
          new String[]{android.provider.MediaStore.MediaColumns._ID,
            android.provider.MediaStore.MediaColumns.SIZE,
            android.provider.MediaStore.MediaColumns.IS_PENDING},
          android.provider.MediaStore.MediaColumns.DISPLAY_NAME+"=?",
          new String[]{fileName},null)) {
        assertNotNull("Downloads provider did not return the saved MDB",rows);
        assertTrue("MDB should be visible in Downloads after publishing",rows.moveToFirst());
        assertEquals(prepared.length(),rows.getLong(1));
        assertEquals("Finished MDB must not remain pending",0,rows.getInt(2));
        published=android.content.ContentUris.withAppendedId(
          android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,rows.getLong(0));
      }
      try (InputStream in=resolver.openInputStream(published)) {
        assertNotNull(in);
        assertEquals(prepared.length(),in.readAllBytes().length);
      }
    } finally {
      if (published != null) context.getContentResolver().delete(published,null,null);
      prepared.delete();
    }
  }

  @Test public void androidDocumentSaveRejectsEmptyPreparedMdb() throws Exception {
    File empty=File.createTempFile("solin-saf-invalid-", ".mdb",context.getCacheDir());
    File destination=File.createTempFile("solin-saf-untouched-", ".mdb",context.getCacheDir());
    try {
      assertEquals(0,destination.length());
      try {
        SolinMdbPlugin.writeVerifiedDocument(context,empty,android.net.Uri.fromFile(destination));
        fail("Must reject zero-byte MDB before writing a destination");
      } catch (IllegalStateException expected) {
        assertTrue(expected.getMessage().contains("пустой"));
      }
      assertEquals(0,destination.length());
    } finally { empty.delete(); destination.delete(); }
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
