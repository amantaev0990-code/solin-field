// Isolated experiment: no customer forest data is shipped or committed.
// Run against the public, empty 18-table Jet MDB in vendor/.
using System.Globalization;
using UCanAccess.File;

string root = args.Length > 0 ? args[0] : ".";
string source = Path.Combine(root, "vendor/solin-empty-transfer-v20261028-27.mdb");
if (!System.IO.File.Exists(source)) throw new Exception("Missing sanitized empty Access template.");
string work = Path.Combine(Path.GetTempPath(), "solin-dotnet-probe-" + Guid.NewGuid().ToString("N") + ".mdb");
System.IO.File.Copy(source, work, false);
try {
  using (var db = Database.Open(work, readOnly: false)) {
    var forest = db.GetTable("Лесничество") ?? throw new Exception("Missing forest table.");
    var stand = db.GetTable("Выдел") ?? throw new Exception("Missing stand table.");
    if (forest.RowCount != 0 || stand.RowCount != 0)
      throw new Exception("Unsafe nonempty input template.");
    object?[] Forest() {
      var row = new object?[forest.Columns.Count];
      for (int i=0;i<row.Length;i++) {
        row[i] = forest.Columns[i].Name switch {
          "POS" => (short)213,
          "LESN" => (short)2,
          "GodT" => (int)2026,
          _ => null
        };
      }
      return row;
    }
    object?[] Stand() {
      var row = new object?[stand.Columns.Count];
      for (int i=0;i<row.Length;i++) {
        row[i] = stand.Columns[i].Name switch {
          "POS" => (short)213,
          "LESN" => (short)2,
          "KV" => (short)1,
          "KGLF" => (short)1,
          "VD" => "1",
          "PLV" => 1.25f,
          "PRkol" => 0.6f,
          _ => null
        };
      }
      return row;
    }
    forest.AddRow(Forest());
    stand.AddRow(Stand());
    Console.WriteLine("WRITE: created test forest and stand, PRkol=0.6");
  }
  using (var db = Database.Open(work, readOnly: true)) {
    var f=db.GetTable("Лесничество") ?? throw new Exception("Forest lost.");
    var t=db.GetTable("Выдел") ?? throw new Exception("Stand lost.");
    if (f.Rows().Count()!=1 || t.Rows().Count()!=1) throw new Exception("Incorrect row count.");
    var value=t.Rows().Single()["PRkol"];
    double x=Convert.ToDouble(value,CultureInfo.InvariantCulture);
    if (Math.Abs(x-0.6)>0.000001)
      throw new Exception("PRkol changed: " + x.ToString(CultureInfo.InvariantCulture));
    Console.WriteLine("DOTNET_MDB_OK: real Jet MDB reopened, forest row=1, stand row=1, PRkol=" + x);
  }
  // Independent browser-compatible check runs in the Actions job, not in this program.
  Console.WriteLine("PROOF_FILE=" + work);
} finally {
  System.IO.File.Delete(work);
}
