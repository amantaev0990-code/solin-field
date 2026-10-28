# SOLI-N Field: safely build a REAL Jet MDB on Windows from the mobile transfer archive.
# Requires an installed Microsoft Access DAO engine. Never overwrites C:\Soli\Transfer.
param(
  [string] $TemplateMDB = "",
  [string] $TransferJSON = (Join-Path $PSScriptRoot "Transfer.json")
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
function Stop-Bridge([string] $Reason) { throw "SOLI-N MDB: $Reason" }
if (-not (Test-Path -LiteralPath $TransferJSON -PathType Leaf)) { Stop-Bridge "Не найден Transfer.json. Распакуйте ZIP полностью." }
$data = Get-Content -LiteralPath $TransferJSON -Raw -Encoding UTF8 | ConvertFrom-Json
if ($data.format -ne "SOLIN-MDB-Bridge-v1") { Stop-Bridge "Неверный формат Transfer.json." }
if (-not $data.tables -or -not $data.schema -or -not $data.identity) { Stop-Bridge "Не хватает таблиц, схемы или адреса лесничества." }
$pos = [int]$data.identity.POS; $lesn = [int]$data.identity.LESN; $year = [int]$data.identity.GodT
if ($pos -le 0 -or $lesn -le 0 -or $year -lt 1900 -or $year -gt 2200) { Stop-Bridge "Неверный адрес или год таксации." }
$names = @($data.tables.PSObject.Properties.Name)
foreach ($required in @("Лесничество","Квартал","Выдел")) {
  if ($names -notcontains $required) { Stop-Bridge "Нет таблицы $required." }
}
if (-not $TemplateMDB) {
  $candidates = @(
    (Join-Path $PSScriptRoot ("Transf_{0}_{1}_{2}.mdb" -f $pos,$lesn,$year)),
    ("C:\Soli\Transfer\Transf_{0}_{1}_{2}.mdb" -f $pos,$lesn,$year),
    "C:\Soli\Transfer\Transf.mdb"
  )
  $TemplateMDB = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $TemplateMDB -or -not (Test-Path -LiteralPath $TemplateMDB -PathType Leaf)) {
  Stop-Bridge "Нужен оригинальный MDB-шаблон Transfer. Укажите: .\Build-SOLIN-Transfer-MDB.ps1 -TemplateMDB 'C:\путь\Transf_213_2_2026.mdb'"
}
$TemplateMDB = (Resolve-Path -LiteralPath $TemplateMDB).Path
$header = [byte[]]::new(32)
$stream = [IO.File]::OpenRead($TemplateMDB)
try { $null = $stream.Read($header,0,32) } finally { $stream.Dispose() }
if (-not ([Text.Encoding]::ASCII.GetString($header) -match "Standard Jet DB")) { Stop-Bridge "Шаблон не является подлинным MDB Jet." }
$engine = $null
foreach ($progId in @("DAO.DBEngine.120","DAO.DBEngine.36")) {
  try { $engine = New-Object -ComObject $progId; break } catch {}
}
if (-not $engine) { Stop-Bridge "Не найден Microsoft Access DAO. Установите Access или Access Database Engine совместимой разрядности." }
$out = Join-Path $PSScriptRoot ("Transf_{0}_{1}_{2}_Field.mdb" -f $pos,$lesn,$year)
if (Test-Path -LiteralPath $out) { Stop-Bridge "Выходной MDB уже существует: $out. Сначала переименуйте/перенесите предыдущий результат." }
# The original template is NEVER opened for writing.
Copy-Item -LiteralPath $TemplateMDB -Destination $out -ErrorAction Stop
$db = $null
$workspace = $null
$inTransaction = $false
try {
  $db = $engine.OpenDatabase($out)
  $workspace = $engine.Workspaces.Item(0)
  # Check schema before modifying a single record.
  foreach ($name in $names) {
    try { $tableDef = $db.TableDefs.Item([string]$name) } catch { Stop-Bridge "В оригинальном MDB отсутствует таблица: $name" }
    $columns = @()
    for ($columnIndex = 0; $columnIndex -lt $tableDef.Fields.Count; $columnIndex++) { $columns += [string]$tableDef.Fields.Item($columnIndex).Name }
    foreach ($key in @($data.schema.$name)) {
      if ($columns -notcontains [string]$key) { Stop-Bridge "В $name отсутствует исходное поле: $key" }
    }
    foreach ($row in @($data.tables.$name)) {
      foreach ($field in @($row.PSObject.Properties.Name)) {
        if ($columns -notcontains $field) { Stop-Bridge "В $name нет поля $field. Экспорт остановлен без потери исходных файлов." }
      }
      if ($row.PSObject.Properties["POS"] -and $null -ne $row.POS -and [int]$row.POS -ne $pos) { Stop-Bridge "Строка $name другого лесовладельца." }
      if ($row.PSObject.Properties["LESN"] -and $null -ne $row.LESN -and [int]$row.LESN -ne $lesn) { Stop-Bridge "Строка $name другого лесничества." }
    }
  }
  # Prevent cross-district mixing when using an existing populated MDB template.
  $originalForest = $db.OpenRecordset("Лесничество", 2)
  try {
    if (-not $originalForest.EOF) {
      $originalForest.MoveFirst()
      do {
        if ([int]$originalForest.Fields.Item("POS").Value -ne $pos -or
            [int]$originalForest.Fields.Item("LESN").Value -ne $lesn) {
          Stop-Bridge "MDB-шаблон принадлежит другому лесничеству. Требуется соответствующий Transfer."
        }
        $originalForest.MoveNext()
      } until ($originalForest.EOF)
    }
  } finally { $originalForest.Close() }
  $workspace.BeginTrans(); $inTransaction = $true
  # Delete children first; leave *unrepresented* native Transfer tables untouched, with warning.
  $children = @($names | Where-Object { $_ -notin @("Лесничество","Квартал","Выдел") })
  $deletionOrder = @($children) + @("Выдел","Квартал","Лесничество")
  foreach ($name in $deletionOrder) {
    $safeName = ([string]$name).Replace("]", "]]")
    $db.Execute("DELETE FROM [" + $safeName + "]", 128) # dbFailOnError
  }
  $insertOrder = @("Лесничество","Квартал","Выдел") + $children
  $culture = [Globalization.CultureInfo]::InvariantCulture
  foreach ($name in $insertOrder) {
    $recordset = $db.OpenRecordset([string]$name, 2) # dbOpenDynaset
    try {
      foreach ($row in @($data.tables.$name)) {
        $recordset.AddNew()
        foreach ($property in $row.PSObject.Properties) {
          $value = $property.Value
          if ($null -eq $value -or $value -is [DBNull]) { continue }
          if ($value -is [System.Array] -or $value -is [pscustomobject]) { Stop-Bridge "Сложное значение $name.$($property.Name) нельзя записать в MDB." }
          $field = $recordset.Fields.Item([string]$property.Name)
          $fieldType = [int]$field.Type
          if ($value -is [string] -and $value.Length -eq 0 -and $fieldType -notin @(10,12)) { continue }
          switch ($fieldType) {
            1 { $cast = [bool]([int]$value); break }
            { $_ -in @(2,3,4,16,17) } { $cast = [int64]::Parse([Convert]::ToString($value,$culture),$culture); break }
            { $_ -in @(5,6,7,20,21,23) } { $cast = [decimal]::Parse([Convert]::ToString($value,$culture),$culture); break }
            8 { $cast = [datetime]::Parse([string]$value,$culture); break }
            default { $cast = [string]$value }
          }
          $field.Value = $cast
        }
        $recordset.Update()
      }
    } finally { $recordset.Close() }
  }
  $workspace.CommitTrans(); $inTransaction = $false
  # Read back row counts to catch incomplete writes.
  foreach ($name in $names) {
    $rs = $db.OpenRecordset([string]$name, 2)
    try {
      $rs.MoveLast()
      $actual = if ($rs.EOF -and $rs.BOF) { 0 } else { [int]$rs.RecordCount }
      $expected = @($data.tables.$name).Count
      if ($actual -ne $expected) { Stop-Bridge "Контроль строк $name: ожидалось $expected, получено $actual." }
    } catch {
      # Empty DAO recordsets can throw on MoveLast.
      if (@($data.tables.$name).Count -ne 0) { throw }
    } finally { $rs.Close() }
  }
} catch {
  if ($inTransaction) { try { $workspace.Rollback() } catch {} }
  if ($db) { try { $db.Close() } catch {} }
  Remove-Item -LiteralPath $out -Force -ErrorAction SilentlyContinue
  throw
} finally {
  if ($db) { try { $db.Close() } catch {} }
}
Write-Host ""
Write-Host "Успешно создан настоящий MDB: $out" -ForegroundColor Green
Write-Host "Исходный MDB-шаблон не изменён."
Write-Host "Перенесите готовый файл на компьютер с SOLI-N и проверьте приём данных штатной кнопкой."
