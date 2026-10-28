package kz.solin.mdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthmarketscience.jackcess.Column;
import com.healthmarketscience.jackcess.Cursor;
import com.healthmarketscience.jackcess.DataType;
import com.healthmarketscience.jackcess.Database;
import com.healthmarketscience.jackcess.DatabaseBuilder;
import com.healthmarketscience.jackcess.Row;
import com.healthmarketscience.jackcess.Table;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Convert a SOLI-N Field export into an actual Jet MDB, always working on a copy of
 * the exact original transfer file. Never writes to the template. Fail closed when
 * the source database contains unrepresented district-specific data or a schema mismatch.
 *
 * Jackcess does not provide transactions. On any failure the caller discards the
 * temporary copy, leaving the template intact.
 */
public final class TransferWriter {
  private static final int MAX_ROWS = 500_000;
  private static final List<String> PARENTS = List.of("Лесничество", "Квартал", "Выдел");

  public static final class Identity {
    public final int pos, lesn, year;
    Identity(int pos, int lesn, int year) { this.pos = pos; this.lesn = lesn; this.year = year; }
    public String filename() { return "Transf_" + pos + "_" + lesn + "_" + year + ".mdb"; }
  }

  public Identity identity(JsonNode root) {
    if (root == null || !root.isObject() ||
        !"SOLIN-MDB-Bridge-v1".equals(root.path("format").asText())) {
      throw new IllegalArgumentException("Неверный формат передачи SOLI-N.");
    }
    JsonNode ident = root.path("identity");
    int pos = positive(ident.path("POS"), "POS");
    int lesn = positive(ident.path("LESN"), "LESN");
    int year = positive(ident.path("GodT"), "GodT");
    if (year < 1900 || year > 2200) throw new IllegalArgumentException("Недопустимый год таксации.");
    return new Identity(pos, lesn, year);
  }

  private static int positive(JsonNode n, String field) {
    if (n == null || !n.canConvertToInt() || !n.isIntegralNumber() || n.asInt() < 1) {
      throw new IllegalArgumentException("Некорректное поле " + field + ".");
    }
    return n.asInt();
  }

  private static Map<String, JsonNode> validatePayload(JsonNode root, Identity identity) {
    JsonNode schema = root.path("schema");
    JsonNode tables = root.path("tables");
    if (!schema.isObject() || !tables.isObject() || tables.size() > 100) {
      throw new IllegalArgumentException("Нет корректной схемы таблиц Transfer.");
    }
    Map<String, JsonNode> data = new LinkedHashMap<>();
    int total = 0;
    for (var entries = tables.fields(); entries.hasNext();) {
      var entry = entries.next();
      String name = entry.getKey();
      JsonNode rows = entry.getValue();
      JsonNode fields = schema.path(name);
      if (name.length() > 64 || !name.matches("[\\p{L}\\p{N}_\\-]+") ||
          !rows.isArray() || !fields.isArray() || fields.isEmpty() || fields.size() > 250) {
        throw new IllegalArgumentException("Неверный раздел таблиц: " + name);
      }
      Set<String> keys = new HashSet<>();
      for (JsonNode field : fields) {
        if (!field.isTextual() || field.asText().isBlank() ||
            !keys.add(field.asText()) || field.asText().length() > 64) {
          throw new IllegalArgumentException("Недопустимые поля в " + name + ".");
        }
      }
      total += rows.size();
      if (total > MAX_ROWS) throw new IllegalArgumentException("Слишком много строк Transfer.");
      for (JsonNode row : rows) {
        if (!row.isObject()) throw new IllegalArgumentException("Некорректная строка " + name + ".");
        for (var it = row.fields(); it.hasNext();) {
          var cell = it.next();
          if (!keys.contains(cell.getKey()) || cell.getValue().isContainerNode()) {
            throw new IllegalArgumentException("Недопустимое поле " + name + "." + cell.getKey() + ".");
          }
        }
        if (row.hasNonNull("POS") && positive(row.get("POS"), "POS") != identity.pos) {
          throw new IllegalArgumentException("Данные другого лесовладельца в " + name + ".");
        }
        if (row.hasNonNull("LESN") && positive(row.get("LESN"), "LESN") != identity.lesn) {
          throw new IllegalArgumentException("Данные другого лесничества в " + name + ".");
        }
      }
      data.put(name, rows);
    }
    if (!data.keySet().containsAll(PARENTS) || data.get("Лесничество").size() != 1) {
      throw new IllegalArgumentException("Требуются таблицы Лесничество, Квартал, Выдел и одно лесничество.");
    }
    if (schema.size() != tables.size()) throw new IllegalArgumentException("Схемы и таблицы не совпадают.");
    return data;
  }

  public void write(JsonNode payload, Path template, Path destination) throws IOException {
    Identity id = identity(payload);
    Map<String, JsonNode> data = validatePayload(payload, id);
    if (!Files.isRegularFile(template) || !Files.isReadable(template)) {
      throw new IllegalArgumentException("Оригинальный MDB-шаблон для лесничества ещё не установлен на сервере.");
    }
    byte[] header;
    try (var input = Files.newInputStream(template)) { header = input.readNBytes(32); }
    if (!new String(header, StandardCharsets.ISO_8859_1).contains("Standard Jet DB")) {
      throw new IllegalArgumentException("Шаблон не является базой Access Jet MDB.");
    }
    if (Files.exists(destination) && Files.isSameFile(template, destination)) {
      throw new IllegalArgumentException("Нельзя заменять исходную базу.");
    }
    Files.copy(template, destination, StandardCopyOption.REPLACE_EXISTING);
    try (Database db = DatabaseBuilder.open(destination.toFile())) {
      // Validate all data and relationships before writing.
      for (var entry : data.entrySet()) {
        Table t = db.getTable(entry.getKey());
        if (t == null) throw new IllegalArgumentException("В оригинальном MDB нет таблицы «" + entry.getKey() + "».");
        Set<String> columns = new HashSet<>();
        for (Column c : t.getColumns()) columns.add(c.getName());
        for (JsonNode field : payload.path("schema").path(entry.getKey())) {
          if (!columns.contains(field.asText())) throw new IllegalArgumentException(
            "В оригинальном MDB нет поля «" + entry.getKey() + "." + field.asText() + "».");
        }
        for (JsonNode row : entry.getValue()) {
          for (var it = row.fields(); it.hasNext();) {
            var cell = it.next();
            Column column = t.getColumn(cell.getKey());
            if (column == null) throw new IllegalArgumentException("Отсутствует поле " + entry.getKey() + "." + cell.getKey());
            convert(cell.getValue(), column.getType());
          }
        }
      }
      Table forest = db.getTable("Лесничество");
      if (forest == null) throw new IllegalArgumentException("MDB-шаблон не содержит лесничества.");
      for (Row row : forest) {
        if (asInt(row.get("POS")) != id.pos || asInt(row.get("LESN")) != id.lesn) {
          throw new IllegalArgumentException("MDB-шаблон принадлежит другому лесничеству.");
        }
      }
      // The original transfer may have more tables than the mobile editor knows.
      // Preserve all such tables byte-for-byte in the copied database. Before
      // writing, ensure each surviving related row still points at a quarter/
      // compartment in the new export. Never silently preserve orphan records.
      Set<String> exportedQuarterKeys = new HashSet<>();
      Set<String> exportedStandKeys = new HashSet<>();
      Set<String> exportedStandFullKeys = new HashSet<>();
      for (JsonNode row : data.get("Квартал")) {
        exportedQuarterKeys.add(address(row.path("POS"), row.path("LESN"), row.path("KV")));
      }
      for (JsonNode row : data.get("Выдел")) {
        exportedStandKeys.add(address(row.path("POS"), row.path("LESN"), row.path("KV"), row.path("VD")));
        exportedStandFullKeys.add(address(row.path("POS"), row.path("LESN"), row.path("KV"),
            row.path("KGLF"), row.path("VD")));
      }
      for (String name : db.getTableNames()) {
        if (data.containsKey(name)) continue;
        Table other = db.getTable(name);
        if (other == null || other.getRowCount() == 0) continue;
        Set<String> columns = new HashSet<>();
        for (Column c : other.getColumns()) columns.add(c.getName());
        if (!columns.contains("POS") || !columns.contains("LESN")) continue;
        for (Row original : other) {
          if (asInt(original.get("POS")) != id.pos || asInt(original.get("LESN")) != id.lesn) {
            throw new IllegalArgumentException("Дополнительная таблица «" + name +
                "» содержит строки другого лесничества. Автоматическая замена запрещена.");
          }
          if (columns.contains("KV") && original.get("KV") != null) {
            String q = address(original.get("POS"), original.get("LESN"), original.get("KV"));
            if (!exportedQuarterKeys.contains(q)) {
              throw new IllegalArgumentException("Дополнительная таблица «" + name +
                  "» содержит ссылку на отсутствующий квартал. Проверьте удалённые кварталы.");
            }
            if (columns.contains("VD") && original.get("VD") != null) {
              String k = address(original.get("POS"), original.get("LESN"), original.get("KV"), original.get("VD"));
              if (!exportedStandKeys.contains(k)) {
                throw new IllegalArgumentException("Дополнительная таблица «" + name +
                    "» содержит ссылку на удалённый выдел. Нужно сначала обновить исходный Transfer.");
              }
              if (columns.contains("KGLF") && original.get("KGLF") != null &&
                  !exportedStandFullKeys.contains(address(original.get("POS"), original.get("LESN"),
                      original.get("KV"), original.get("KGLF"), original.get("VD")))) {
                throw new IllegalArgumentException("Дополнительная таблица «" + name +
                    "» ссылается на выдел с другой категорией лесного фонда.");
              }
            }
          }
        }
      }
      List<String> children = new ArrayList<>(data.keySet());
      children.removeAll(PARENTS);
      List<String> deleteOrder = new ArrayList<>(children);
      deleteOrder.add("Выдел");
      deleteOrder.add("Квартал");
      deleteOrder.add("Лесничество");
      for (String name : deleteOrder) {
        Cursor cursor = db.getTable(name).getDefaultCursor();
        cursor.beforeFirst();
        while (cursor.moveToNextRow()) cursor.deleteCurrentRow();
      }
      List<String> insertOrder = new ArrayList<>(PARENTS);
      insertOrder.addAll(children);
      for (String name : insertOrder) {
        Table t = db.getTable(name);
        for (JsonNode record : data.get(name)) {
          Map<String,Object> values = new LinkedHashMap<>();
          for (var it = record.fields(); it.hasNext();) {
            var field = it.next();
            values.put(field.getKey(), convert(field.getValue(), t.getColumn(field.getKey()).getType()));
          }
          t.addRowFromMap(values);
        }
      }
      db.flush();
      // Verify persisted row counts before releasing the download.
      for (var entry : data.entrySet()) {
        if (db.getTable(entry.getKey()).getRowCount() != entry.getValue().size()) {
          throw new IOException("Не совпало количество записей в " + entry.getKey() + ".");
        }
      }
    }
    // Reopen to confirm the output is a readable MDB, not merely a renamed blob.
    try (Database verify = DatabaseBuilder.open(destination.toFile())) {
      for (var entry : data.entrySet()) {
        if (verify.getTable(entry.getKey()) == null ||
            verify.getTable(entry.getKey()).getRowCount() != entry.getValue().size()) {
          throw new IOException("MDB не прошёл повторную проверку таблиц.");
        }
      }
    }
  }


  private static String address(Object... fields) {
    StringBuilder result = new StringBuilder();
    for (Object field : fields) {
      Object value = field instanceof JsonNode ? ((JsonNode)field).asText() : field;
      if (result.length() > 0) result.append("::");
      if (value instanceof Number) {
        result.append(new BigDecimal(value.toString()).stripTrailingZeros().toPlainString());
      } else if (value != null) {
        result.append(String.valueOf(value));
      }
    }
    return result.toString();
  }

  private static int asInt(Object value) {
    return value instanceof Number ? ((Number)value).intValue() : Integer.parseInt(String.valueOf(value));
  }

  static Object convert(JsonNode node, DataType type) {
    if (node == null || node.isNull()) return null;
    if (node.isContainerNode()) throw new IllegalArgumentException("Сложные значения не поддерживаются.");
    String v = node.asText();
    if (v.isEmpty() && type != DataType.TEXT && type != DataType.MEMO) return null;
    try {
      return switch (type) {
        case BOOLEAN -> {
          if (!node.isBoolean() && !v.equals("1") && !v.equals("0") &&
              !v.equalsIgnoreCase("true") && !v.equalsIgnoreCase("false")) {
            throw new IllegalArgumentException("Недопустимое логическое значение.");
          }
          yield node.isBoolean() ? node.asBoolean() : (v.equals("1") || v.equalsIgnoreCase("true"));
        }
        case BYTE -> Integer.parseInt(v);
        case INT -> Short.parseShort(v);
        case LONG -> Integer.parseInt(v);
        case BIG_INT -> Long.parseLong(v);
        case FLOAT -> Float.parseFloat(v);
        case DOUBLE -> Double.parseDouble(v);
        case MONEY, NUMERIC -> new BigDecimal(v);
        case SHORT_DATE_TIME -> {
          if (v.matches("\\d{4}-\\d{2}-\\d{2}")) yield java.time.LocalDate.parse(v).atStartOfDay();
          if (v.endsWith("Z")) yield java.util.Date.from(Instant.parse(v));
          if (v.contains("+") && v.contains("T")) yield java.util.Date.from(OffsetDateTime.parse(v).toInstant());
          yield LocalDateTime.parse(v);
        }
        case TEXT, MEMO, GUID -> v;
        default -> throw new IllegalArgumentException("Неподдерживаемый тип MDB: " + type);
      };
    } catch (NumberFormatException | java.time.format.DateTimeParseException e) {
      throw new IllegalArgumentException("Значение не соответствует типу " + type + ".");
    }
  }
}
