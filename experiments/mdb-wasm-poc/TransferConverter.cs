using System.Globalization;
using System.Text;
using System.Text.Json;
using UCanAccess.File;

namespace MdbWasmPoc;

/// <summary>
/// Experimental Jet4 writer: builds a real .mdb from the Field Bridge snapshot.
/// No CheerpJ, external conversion service, upload, or user-file selection.
/// Writes into an isolated temporary Emscripten filesystem, verifies the output
/// with a DIFFERENT database instance, and then returns the bytes for download.
/// This only supports the 18 original transfer tables: extra tables are
/// rejected instead of silently discarded.
/// </summary>
public static class TransferConverter
{
    const string Format = "SOLIN-MDB-Bridge-v1";
    const int MaxRows = 500_000;
    static readonly string[] Required = ["Лесничество","Квартал","Выдел"];

    public sealed record Result(string FileName, byte[] Bytes, int Tables, int Rows);

    static int Positive(JsonElement parent, string name)
    {
        var cell = parent.GetProperty(name);
        if (cell.ValueKind != JsonValueKind.Number || !cell.TryGetInt32(out int value) || value <= 0)
            throw new InvalidDataException("Неверный идентификатор " + name);
        return value;
    }
    static string NumericText(JsonElement value)
    {
        string text = value.ValueKind switch {
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.String => value.GetString()?.Trim() ?? "",
            _ => throw new InvalidDataException("Значение не является числом")
        };
        if (text.Count(x=>x==',')>1 || (text.Contains(',')&&text.Contains('.')))
            throw new InvalidDataException("Неоднозначный десятичный разделитель");
        return text.Replace(',','.');
    }
    static decimal DecimalExact(JsonElement value) {
        string text=NumericText(value);
        if (!decimal.TryParse(text,NumberStyles.AllowLeadingSign|
                NumberStyles.AllowDecimalPoint|NumberStyles.AllowExponent,
                CultureInfo.InvariantCulture,out decimal number))
            throw new InvalidDataException("Неправильное число «"+text+"»");
        return number;
    }
    static object? ConvertField(JsonElement node, DataType type)
    {
        if(node.ValueKind == JsonValueKind.Null || node.ValueKind == JsonValueKind.Undefined)return null;
        if(node.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(node.GetString())
            && type != DataType.Text && type != DataType.Memo) return null;
        return type switch {
            DataType.Int => checked((short)decimal.ToInt32(RequireInteger(DecimalExact(node)))),
            DataType.Long => checked((int)RequireInteger(DecimalExact(node))),
            DataType.Byte => checked((byte)RequireInteger(DecimalExact(node))),
            DataType.BigInt => checked((long)RequireInteger(DecimalExact(node))),
            DataType.Float => float.Parse(NumericText(node),NumberStyles.Float,CultureInfo.InvariantCulture),
            DataType.Double => double.Parse(NumericText(node),NumberStyles.Float,CultureInfo.InvariantCulture),
            DataType.Text or DataType.Memo => node.ValueKind==JsonValueKind.String
                ? node.GetString() : node.ToString(),
            DataType.Boolean => node.ValueKind switch {
                JsonValueKind.True=>true, JsonValueKind.False=>false,
                JsonValueKind.Number when node.GetRawText()=="1"=>true,
                JsonValueKind.Number when node.GetRawText()=="0"=>false,
                JsonValueKind.String when node.GetString()=="1"=>true,
                JsonValueKind.String when node.GetString()=="0"=>false,
                _ => throw new InvalidDataException("Недопустимое логическое значение")
            },
            _ => throw new NotSupportedException("В шаблоне неподдерживаемый тип Access: "+type)
        };
    }
    static decimal RequireInteger(decimal n) {
        if(decimal.Truncate(n)!=n)throw new InvalidDataException("Дробь в целочисленном поле Access: "+n);
        return n;
    }
    static object?[] BuildRow(Table table, JsonElement record, string tableName, int rowIndex)
    {
        if(record.ValueKind!=JsonValueKind.Object)
            throw new InvalidDataException("Некорректная запись: "+tableName+" / "+(rowIndex+1));
        var output=new object?[table.Columns.Count];
        for(int i=0;i<output.Length;i++){
            var column=table.Columns[i];
            if(!record.TryGetProperty(column.Name,out var source))continue;
            try {output[i]=ConvertField(source,column.Type);}
            catch(Exception error) when(error is FormatException or OverflowException or InvalidDataException or NotSupportedException){
                throw new InvalidDataException($"Таблица «{tableName}», строка {rowIndex+1}, поле «{column.Name}» (тип {column.Type}): {error.Message}",error);
            }
        }
        foreach(var property in record.EnumerateObject()){
            if(!table.Columns.Any(c=>c.Name==property.Name))
                throw new InvalidDataException($"В Access отсутствует поле {tableName}.{property.Name}.");
        }
        return output;
    }
    static void EnsureAddress(JsonElement record, int pos, int lesn, string name, int n)
    {
        foreach(var key in new [] {"POS","LESN"}) {
            if(!record.TryGetProperty(key,out var cell) || cell.ValueKind==JsonValueKind.Null)continue;
            decimal expected=key=="POS"?pos:lesn;
            if(DecimalExact(cell)!=expected)
                throw new InvalidDataException($"Другое лесничество в {name}, строка {n+1}: {key}");
        }
    }
    static bool Same(object? a, object? b)
    {
        if(a==null||b==null)return a==null&&b==null;
        if(a is float or double || b is float or double){
            double x=System.Convert.ToDouble(a,CultureInfo.InvariantCulture);
            double y=System.Convert.ToDouble(b,CultureInfo.InvariantCulture);
            return double.IsFinite(x)&&double.IsFinite(y)&&Math.Abs(x-y)<=Math.Max(0.000001,Math.Abs(x)*0.000001);
        }
        if(a is IConvertible && b is IConvertible && !(a is string) && !(b is string)){
            try{return System.Convert.ToDecimal(a)==System.Convert.ToDecimal(b);}catch {}
        }
        return string.Equals(System.Convert.ToString(a,CultureInfo.InvariantCulture),
                             System.Convert.ToString(b,CultureInfo.InvariantCulture),StringComparison.Ordinal);
    }
    public static Result ConvertFromSnapshot(string json, byte[] template)
    {
        using JsonDocument doc=JsonDocument.Parse(json);
        JsonElement root=doc.RootElement;
        if(root.GetProperty("format").GetString()!=Format)
            throw new InvalidDataException("Это не пакет данных SOLI-N Field");
        var id=root.GetProperty("identity");
        int pos=Positive(id,"POS"), lesn=Positive(id,"LESN"), year=Positive(id,"GodT");
        if(year is <1900 or >2200)throw new InvalidDataException("Недопустимый год таксации");
        var tables=root.GetProperty("tables");
        var schema=root.GetProperty("schema");
        if(tables.ValueKind!=JsonValueKind.Object ||schema.ValueKind!=JsonValueKind.Object||
           tables.EnumerateObject().Count()!=18 ||schema.EnumerateObject().Count()!=18 ||
           Required.Any(n=>!tables.TryGetProperty(n,out _)))
            throw new InvalidDataException("Требуется исходная структура 18 таблиц Transfer");
        if(template.Length<2048 || Encoding.ASCII.GetString(template,4,15)!="Standard Jet DB")
            throw new InvalidDataException("Встроенный пустой MDB повреждён");
        string path=Path.Combine(Path.GetTempPath(),"solin-wasm-export-"+Guid.NewGuid().ToString("N")+".mdb");
        try{
            System.IO.File.WriteAllBytes(path,template);
            int count=0;
            using(var db=Database.Open(path,readOnly:false)){
                // Schema and safety checks BEFORE any row is written.
                foreach(var entry in tables.EnumerateObject()){
                    string name=entry.Name;
                    Table table=db.GetTable(name)??throw new InvalidDataException("Нет таблицы Access «"+name+"»");
                    var declared=schema.GetProperty(name);
                    if(declared.ValueKind!=JsonValueKind.Array ||
                       declared.GetArrayLength()!=table.Columns.Count)
                        throw new InvalidDataException("Неверная схема таблицы «"+name+"»");
                    var fields=declared.EnumerateArray().Select(v=>v.GetString()).ToHashSet();
                    if(table.Columns.Any(c=>!fields.Contains(c.Name)) || fields.Count!=table.Columns.Count)
                        throw new InvalidDataException("Названия полей не совпадают: "+name);
                    if(entry.Value.ValueKind!=JsonValueKind.Array || table.Rows().Any())
                        throw new InvalidDataException("Таблица не пуста или данные повреждены: "+name);
                    count+=entry.Value.GetArrayLength();
                    if(count>MaxRows)throw new InvalidDataException("Слишком много записей");
                }
                if(tables.GetProperty("Лесничество").GetArrayLength()!=1)
                    throw new InvalidDataException("Требуется одно лесничество");
                // Write parent tables first, followed by makets; avoid orphan rows.
                var names=Required.Concat(tables.EnumerateObject().Select(e=>e.Name).Except(Required)).ToArray();
                foreach(var name in names){
                    Table table=db.GetTable(name)!;
                    var rows=tables.GetProperty(name);
                    int rowIndex=0;
                    foreach(var record in rows.EnumerateArray()){
                        EnsureAddress(record,pos,lesn,name,rowIndex);
                        table.AddRow(BuildRow(table,record,name,rowIndex));
                        rowIndex++;
                    }
                }
            }
            // Reopen the actual output and compare EVERY row value, not only
            // a metadata rowcount. Errors abort download.
            using(var verify=Database.Open(path,readOnly:true)){
                foreach(var entry in tables.EnumerateObject()){
                    var name=entry.Name;
                    var table=verify.GetTable(name)??throw new InvalidDataException("Утеряна таблица "+name);
                    var actual=table.Rows().ToList();
                    var wanted=entry.Value.EnumerateArray().ToArray();
                    if(actual.Count!=wanted.Length)
                        throw new InvalidDataException($"MDB не прошёл проверку строк «{name}»: {actual.Count} вместо {wanted.Length}");
                    for(int n=0;n<wanted.Length;n++){
                        var expected=BuildRow(table,wanted[n],name,n);
                        for(int k=0;k<expected.Length;k++){
                            if(!Same(expected[k],actual[n][k]))
                                throw new InvalidDataException($"Проверка MDB: данные не совпали: {name}, строка {n+1}, поле {table.Columns[k].Name}");
                        }
                    }
                }
            }
            byte[] output=System.IO.File.ReadAllBytes(path);
            return new Result($"TEST_Transf_{pos}_{lesn}_{year}.mdb",output,18,count);
        }finally{try{System.IO.File.Delete(path);}catch{}}
    }
}
