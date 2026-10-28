package kz.solin.field;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.healthmarketscience.jackcess.Column;
import com.healthmarketscience.jackcess.Cursor;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Row;
import com.healthmarketscience.jackcess.Table;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Offline MDB writer. Never edits source file. Uses Android's save-file picker. */
@CapacitorPlugin(name = "SolinMdb")
public class SolinMdbPlugin extends Plugin {
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final AtomicBoolean busy = new AtomicBoolean(false);
  private File pendingFile;

  @PluginMethod
  public void export(PluginCall call) {
    if (!busy.compareAndSet(false, true)) { call.reject("Уже выполняется экспорт."); return; }
    final String base64 = call.getString("templateBase64");
    final String json = call.getString("transferJson");
    if (base64 == null || json == null || base64.length() > 18_000_000 ||
        json.length() > 35_000_000) {
      busy.set(false); call.reject("Нет исходного MDB или данные слишком большие."); return;
    }
    executor.execute(() -> {
      File source = null, output = null;
      try {
        byte[] bytes = Base64.getDecoder().decode(base64);
        if (bytes.length < 1024 || bytes.length > 12_000_000 || !isJet(bytes)) {
          throw new IllegalArgumentException("Выберите настоящий исходный Jet MDB, не JSON.");
        }
        JSONObject transfer = new JSONObject(json);
        JSONObject identity = transfer.getJSONObject("identity");
        int pos = positive(identity, "POS"), lesn = positive(identity,"LESN");
        int year = positive(identity, "GodT");
        if (!"SOLIN-MDB-Bridge-v1".equals(transfer.optString("format")) ||
            year < 1900 || year > 2200) throw new IllegalArgumentException("Неверный формат Transfer.");
        source = File.createTempFile("solin-template-", ".mdb", getContext().getCacheDir());
        output = File.createTempFile("solin-export-", ".mdb", getContext().getCacheDir());
        try (FileOutputStream out = new FileOutputStream(source)) { out.write(bytes); }
        try (FileOutputStream out = new FileOutputStream(output)) { out.write(bytes); }
        configureJackcess();
        replaceTables(transfer, pos, lesn, output);
        if (!isJet(readFirst32(output))) throw new IllegalStateException("Полученный файл не MDB.");
        File safe = output; output = null;
        String filename = "Transf_" + pos + "_" + lesn + "_" + year + "_Field.mdb";
        getActivity().runOnUiThread(() -> {
          pendingFile = safe;
          Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
          intent.addCategory(Intent.CATEGORY_OPENABLE);
          intent.setType("application/vnd.ms-access");
          intent.putExtra(Intent.EXTRA_TITLE, filename);
          startActivityForResult(call, intent, "saveComplete");
        });
      } catch (Exception e) {
        call.reject("MDB не создан: " + e.getMessage());
        busy.set(false);
      } finally {
        if (source != null) source.delete();
        if (output != null) output.delete();
      }
    });
  }

  @ActivityCallback
  private void saveComplete(PluginCall call, ActivityResult result) {
    File ready = pendingFile; pendingFile = null;
    if (call == null || ready == null) {
      if (ready != null) ready.delete();
      busy.set(false);
      return;
    }
    if (result.getResultCode() != Activity.RESULT_OK ||
        result.getData() == null || result.getData().getData() == null) {
      ready.delete(); busy.set(false); call.reject("Сохранение MDB отменено."); return;
    }
    Uri uri = result.getData().getData();
    executor.execute(() -> {
      try (InputStream in = new FileInputStream(ready);
           OutputStream out = getContext().getContentResolver().openOutputStream(uri, "w")) {
        if (out == null) throw new IllegalStateException("Нет доступа для сохранения файла.");
        byte[] buffer = new byte[16384];
        int n;
        while ((n = in.read(buffer)) != -1) out.write(buffer,0,n);
        out.flush();
        JSObject resultData = new JSObject();
        resultData.put("saved", true);
        call.resolve(resultData);
      } catch (Exception e) { call.reject("Ошибка сохранения: " + e.getMessage()); }
      finally { ready.delete(); busy.set(false); }
    });
  }

  private static void configureJackcess() {
    System.setProperty("com.healthmarketscience.jackcess.brokenNio", "true");
    Thread.currentThread().setContextClassLoader(Database.class.getClassLoader());
  }
  private static boolean isJet(byte[] bytes) {
    byte[] signature = "Standard Jet DB".getBytes(StandardCharsets.ISO_8859_1);
    if (bytes.length < 4 + signature.length) return false;
    for (int i=0; i<signature.length; i++) if (bytes[4+i] != signature[i]) return false;
    return true;
  }
  private static byte[] readFirst32(File file) throws Exception {
    byte[] buf = new byte[32];
    try (InputStream in = new FileInputStream(file)) {
      if (in.read(buf) < 32) throw new IllegalStateException("Слишком короткий MDB.");
    }
    return buf;
  }
  private static int positive(JSONObject object, String name) throws Exception {
    int value = object.getInt(name);
    if (value <= 0) throw new IllegalArgumentException("Некорректное поле " + name);
    return value;
  }
  private static String key(Object... fields) {
    StringBuilder result = new StringBuilder();
    for (Object item : fields) {
      if (result.length() > 0) result.append("::");
      if (item instanceof Number) result.append(new BigDecimal(item.toString()).stripTrailingZeros().toPlainString());
      else result.append(item == null || item == JSONObject.NULL ? "" : String.valueOf(item));
    }
    return result.toString();
  }
  private static void replaceTables(JSONObject export, int pos, int lesn, File output) throws Exception {
    JSONObject schema = export.getJSONObject("schema");
    JSONObject records = export.getJSONObject("tables");
    String[] parents = {"Лесничество","Квартал","Выдел"};
    Set<String> names = new HashSet<>();
    Iterator<String> keys = records.keys();
    int total = 0;
    while (keys.hasNext()) {
      String name = keys.next();
      if (!name.matches("[\\p{L}\\p{N}_\\-]+") || !schema.has(name)) {
        throw new IllegalArgumentException("Неполная схема таблицы " + name);
      }
      names.add(name);
      total += records.getJSONArray(name).length();
      if (names.size() > 100 || total > 500000) throw new IllegalArgumentException("Слишком большой Transfer.");
    }
    for(String name : parents) if (!names.contains(name))
      throw new IllegalArgumentException("В Transfer отсутствует " + name);
    if (records.getJSONArray("Лесничество").length() != 1)
      throw new IllegalArgumentException("Экспорт должен содержать одно лесничество.");
    Set<String> quarters = new HashSet<>(), stands = new HashSet<>(), standsWithKglf = new HashSet<>();
    JSONArray qrows = records.getJSONArray("Квартал"), vrows = records.getJSONArray("Выдел");
    for(int i=0;i<qrows.length();i++){ JSONObject row=qrows.getJSONObject(i);
      quarters.add(key(row.opt("POS"),row.opt("LESN"),row.opt("KV"))); }
    for(int i=0;i<vrows.length();i++){ JSONObject row=vrows.getJSONObject(i);
      stands.add(key(row.opt("POS"),row.opt("LESN"),row.opt("KV"),row.opt("VD")));
      standsWithKglf.add(key(row.opt("POS"),row.opt("LESN"),row.opt("KV"),row.opt("KGLF"),row.opt("VD"))); }

    try (Database db=DatabaseBuilder.open(output)) {
      // Preflight: reject mismatched owner, missing columns and unrepresentable values
      // before changing a byte of the output copy.
      for(String name : names) {
        Table table=db.getTable(name);
        if(table==null)throw new IllegalArgumentException("В MDB нет таблицы «"+name+"»");
        Set<String> valid=new HashSet<>();
        for(Column column:table.getColumns())valid.add(column.getName());
        JSONArray cols=schema.getJSONArray(name);
        for(int c=0;c<cols.length();c++)if(!valid.contains(cols.getString(c)))
          throw new IllegalArgumentException("В MDB нет поля «"+name+"."+cols.getString(c)+"»");
        JSONArray rows=records.getJSONArray(name);
        for(int i=0;i<rows.length();i++){
          JSONObject row=rows.getJSONObject(i);
          if(row.has("POS") && row.getInt("POS")!=pos ||
             row.has("LESN") && row.getInt("LESN")!=lesn)
            throw new IllegalArgumentException("Строка другого лесничества: "+name);
          Iterator<String> fields=row.keys();
          while(fields.hasNext()){
            String field=fields.next();
            if(!valid.contains(field)) throw new IllegalArgumentException("Неизвестное поле "+name+"."+field);
            convert(row.opt(field), table.getColumn(field));
          }
        }
      }
      for(Row row:db.getTable("Лесничество")) {
        if(Integer.parseInt(String.valueOf(row.get("POS")))!=pos ||
           Integer.parseInt(String.valueOf(row.get("LESN")))!=lesn)
          throw new IllegalArgumentException("Выбран MDB другого лесничества.");
      }
      // Never lose related records in operational tables absent from the snapshot.
      for(String name:db.getTableNames()) {
        if(names.contains(name))continue;
        Table table=db.getTable(name);
        Set<String> columns=new HashSet<>();
        for(Column c:table.getColumns())columns.add(c.getName());
        if(!columns.contains("POS")||!columns.contains("LESN"))continue;
        for(Row row:table) {
          if(!key(row.get("POS"),row.get("LESN")).equals(key(pos,lesn)))
            throw new IllegalArgumentException("Чужое лесничество в дополнительной таблице "+name);
          if(!columns.contains("KV")||row.get("KV")==null)continue;
          if(!quarters.contains(key(row.get("POS"),row.get("LESN"),row.get("KV"))))
            throw new IllegalArgumentException("Дополнительная таблица "+name+" содержит удалённый квартал.");
          if(columns.contains("VD")&&row.get("VD")!=null) {
            if(!stands.contains(key(row.get("POS"),row.get("LESN"),row.get("KV"),row.get("VD"))))
              throw new IllegalArgumentException("В "+name+" есть ссылки на отсутствующий выдел.");
            if(columns.contains("KGLF")&&row.get("KGLF")!=null &&
                !standsWithKglf.contains(key(row.get("POS"),row.get("LESN"),row.get("KV"),row.get("KGLF"),row.get("VD"))))
              throw new IllegalArgumentException("В "+name+" есть выдел с другой категорией лесного фонда.");
          }
        }
      }
      List<String> child=new ArrayList<>(names);
      child.removeAll(Arrays.asList(parents));
      List<String> deletion=new ArrayList<>(child);
      deletion.add("Выдел");deletion.add("Квартал");deletion.add("Лесничество");
      for(String name:deletion) {
        Cursor cursor=db.getTable(name).getDefaultCursor();
        cursor.beforeFirst();
        while(cursor.moveToNextRow())cursor.deleteCurrentRow();
      }
      List<String> insertion=new ArrayList<>(Arrays.asList(parents));
      insertion.addAll(child);
      for(String name:insertion) {
        Table table=db.getTable(name);
        JSONArray rows=records.getJSONArray(name);
        for(int i=0;i<rows.length();i++) {
          JSONObject row=rows.getJSONObject(i);
          Map<String,Object> values=new LinkedHashMap<>();
          Iterator<String> fields=row.keys();
          while(fields.hasNext()){
            String field=fields.next();
            values.put(field,convert(row.opt(field),table.getColumn(field)));
          }
          table.addRowFromMap(values);
        }
      }
      db.flush();
    }
    // Verify persisted rows using a fresh file handle.
    try(Database verify=DatabaseBuilder.open(output)){
      for(String name:names){
        if(verify.getTable(name).getRowCount()!=records.getJSONArray(name).length())
          throw new IllegalStateException("Проверка MDB не пройдена: "+name);
      }
    }
  }
  private static Object convert(Object v, Column column) {
    if(v==null||v==JSONObject.NULL)return null;
    String value=String.valueOf(v), type=column.getType().name();
    if(value.isEmpty()&&!type.equals("TEXT")&&!type.equals("MEMO"))return null;
    try{
      switch(type){
        case "BOOLEAN":
          if(!(value.equals("0")||value.equals("1")||value.equalsIgnoreCase("true")||value.equalsIgnoreCase("false")))
            throw new IllegalArgumentException("Неверный логический тип.");
          return value.equals("1")||value.equalsIgnoreCase("true");
        case "BYTE":return Integer.parseInt(value);
        case "INT":return Short.parseShort(value);
        case "LONG":return Integer.parseInt(value);
        case "BIG_INT":return Long.parseLong(value);
        case "FLOAT":return Float.parseFloat(value);
        case "DOUBLE":return Double.parseDouble(value);
        case "MONEY": case "NUMERIC":return new BigDecimal(value);
        case "SHORT_DATE_TIME":
          if(value.matches("\\d{4}-\\d{2}-\\d{2}"))return java.util.Date.from(LocalDate.parse(value).atStartOfDay(ZoneId.systemDefault()).toInstant());
          if(value.endsWith("Z"))return java.util.Date.from(Instant.parse(value));
          return java.util.Date.from(LocalDateTime.parse(value).atZone(ZoneId.systemDefault()).toInstant());
        case "TEXT": case "MEMO": case "GUID":return value;
        default:throw new IllegalArgumentException("Тип MDB пока не поддерживается: "+type+" ("+column.getName()+")");
      }
    }catch(NumberFormatException|java.time.format.DateTimeParseException ex){
      throw new IllegalArgumentException("Некорректное значение "+column.getName()+" для "+type);
    }
  }
}
