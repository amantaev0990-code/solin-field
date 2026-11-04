import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthmarketscience.jackcess.*;
import com.healthmarketscience.jackcess.query.Query;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Read-only fallback when the browser MDB parser cannot follow a page chain.
 * Run with the verified exporter JAR on the classpath using Java source mode.
 * Emits metadata and saved SQL privately; never opens a writable MDB channel.
 */
class ReadOnlyMdb {
  static Map<String,Object> properties(PropertyMap map) {
    var out=new LinkedHashMap<String,Object>();
    for(PropertyMap.Property p:map){Object v=p.getValue();out.put(p.getName(),v==null||v instanceof String||v instanceof Number||v instanceof Boolean?v:String.valueOf(v));}
    return out;
  }
  static String hash(Path p) throws Exception {
    MessageDigest digest=MessageDigest.getInstance("SHA-256");
    try(var in=Files.newInputStream(p)){byte[] buf=new byte[1024*1024];int n;while((n=in.read(buf))!=-1)digest.update(buf,0,n);}
    return HexFormat.of().formatHex(digest.digest());
  }
  public static void main(String[] args) throws Exception {
    if(args.length!=2)throw new IllegalArgumentException("Usage: java -cp VERIFIED_EXPORTER.jar cloud-lab/ReadOnlyMdb.java SOURCE.mdb PRIVATE_OUTPUT.json");
    Path source=Path.of(args[0]).toRealPath(),output=Path.of(args[1]).toAbsolutePath().normalize();
    if(source.equals(output)||!output.toString().endsWith(".json"))throw new IllegalArgumentException("Output must be a separate JSON file");
    for(Path p=Path.of("").toAbsolutePath();p!=null;p=p.getParent())if(Files.exists(p.resolve(".git"))){if(output.startsWith(p))throw new IllegalArgumentException("Detailed inventory must stay outside public git");break;}
    var report=new LinkedHashMap<String,Object>();var tables=new ArrayList<Object>();var queries=new ArrayList<Object>();var errors=new ArrayList<Object>();
    String before=hash(source);
    report.put("source",Map.of("name",source.getFileName().toString(),"sha256",before,"size",Files.size(source),"reader","Jackcess/read-only"));
    try(Database db=new DatabaseBuilder(source.toFile()).setReadOnly(true).setIgnoreBrokenSystemCatalogIndex(true).open()){
      for(String name:db.getTableNames())try{
        Table table=db.getTable(name);var columns=new ArrayList<Object>();var indexes=new ArrayList<Object>();
        for(Column c:table.getColumns())columns.add(Map.of("name",c.getName(),"type",c.getType().name(),"typeCode",c.getType().getValue(),"length",c.getLength(),"scale",c.getScale(),"precision",c.getPrecision(),"properties",properties(c.getProperties())));
        for(Index index:table.getIndexes())indexes.add(Map.of("name",index.getName(),"unique",index.isUnique(),"primary",index.isPrimaryKey(),"columns",index.getColumns().stream().map(c->c.getName()).toList()));
        tables.add(Map.of("name",name,"rowCount",table.getRowCount(),"columns",columns,"indexes",indexes,"properties",properties(table.getProperties())));
      }catch(Exception e){errors.add(Map.of("table",name,"error",e.toString()));}
      for(Query q:db.getQueries())try{queries.add(Map.of("name",q.getName(),"kind",q.getType().name(),"objectFlags",q.getObjectFlag(),"sql",q.toSQLString()));}
      catch(Exception e){errors.add(Map.of("query",q.getName(),"error",e.toString()));}
      var systemSchemas=new LinkedHashMap<String,Object>();
      for(String name:List.of("MSysAccessObjects","MSysAccessStorage"))try{
        Table table=db.getSystemTable(name);if(table!=null)systemSchemas.put(name,Map.of("rowCount",table.getRowCount(),"columns",table.getColumns().stream().map(c->Map.of("name",c.getName(),"type",c.getType().name())).toList()));
      }catch(Exception e){systemSchemas.put(name,Map.of("error",e.toString()));}
      report.put("systemSchemas",systemSchemas);
    }catch(Exception e){errors.add(Map.of("scope","database-open-or-catalog","error",e.toString()));
    }
    report.put("tables",tables);report.put("queries",queries);report.put("errors",errors);report.put("originalUnchanged",before.equals(hash(source)));
    Files.createDirectories(output.getParent());new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(output.toFile(),report);
    System.out.println("READ_ONLY_MDB_OK tables="+tables.size()+" queries="+queries.size()+" errors="+errors.size());
  }
}
