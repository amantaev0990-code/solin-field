#!/usr/bin/env python3
"""Inventory recovered VBA without executing it or emitting source code."""
import argparse, hashlib, importlib, json, pathlib, re, sys, tempfile, zipfile

def active_directory(source, parser_archive, event_inventory, previous):
    """Reuse the private recovery tools; emit hashes/counts, never VBA source."""
    source=pathlib.Path(source);before=hashlib.sha256(source.read_bytes()).hexdigest()
    if before!=previous['original_Solim_sha256_verified']:
        raise ValueError('Source does not match the original active-directory evidence')
    reference=json.loads(pathlib.Path(event_inventory).read_text(encoding='utf-8'))
    expected={m['module']:m for m in reference['modules']}
    with tempfile.TemporaryDirectory(prefix='solin-active-vba-') as td:
        tmp=pathlib.Path(td)
        with zipfile.ZipFile(parser_archive) as z:
            for name in ['solin_cfb.py','solin_vba_extract.py']:(tmp/name).write_bytes(z.read(name))
        sys.path.insert(0,td)
        try:
            cfb_module=importlib.import_module('solin_cfb');extractor=importlib.import_module('solin_vba_extract')
            cfb=tmp/'active.cfb';cfb_module.jet_to_cfb(str(source),str(cfb),875,5780)
            container=cfb_module.CFB(str(cfb));entries=extractor.parse_dir(cfb_module.vba_decompress(container.stream('/VBA/VBAProject/VBA/dir')))
            if len({m['name'] for m in entries})!=len(entries) or {m['name'] for m in entries}!=set(expected):
                raise ValueError('Active module directory differs from the saved reference')
            modules=[]
            for entry in entries:
                raw=container.stream('/VBA/VBAProject/VBA/'+entry['stream'])
                code=cfb_module.vba_decompress(raw[entry['offset']:]).decode('cp1251','replace')
                digest=hashlib.sha256(code.encode('utf-8')).hexdigest()
                procedures=re.findall(r'^\s*(?:(?:Public|Private|Friend|Static)\s+)*(?:Sub|Function|Property\s+(?:Get|Let|Set))\s+([^\s(]+)',code,re.M|re.I)
                if digest!=expected[entry['name']]['sha256']:raise ValueError('Active module hash mismatch: '+entry['name'])
                if set(procedures)!={e['procedure'] for e in expected[entry['name']]['events']}:raise ValueError('Procedure inventory mismatch: '+entry['name'])
                modules.append({'module':entry['name'],'sha256':digest,'procedures':procedures,'savedHashMatches':True})
        finally:
            sys.path.remove(td)
            for name in ['solin_cfb','solin_vba_extract']:sys.modules.pop(name,None)
    if hashlib.sha256(source.read_bytes()).hexdigest()!=before:raise ValueError('Original MDB changed')
    return {'sourceSha256':before,'originalUnchanged':True,'parserArchiveSha256':hashlib.sha256(pathlib.Path(parser_archive).read_bytes()).hexdigest(),
            'eventInventorySha256':hashlib.sha256(pathlib.Path(event_inventory).read_bytes()).hexdigest(),
            'modules':modules,'moduleCount':len(modules),'procedureCount':sum(len(m['procedures']) for m in modules),'sourceHashesMatched':len(modules)}

def audit(archive, crosscheck):
    previous=json.loads(pathlib.Path(crosscheck).read_text(encoding='utf-8'))
    excluded={r['module'] for r in previous['older_catalog_comparison']['missing_module_details']}
    modules=[]
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if not name.startswith('Solim/') or not name.endswith('.bas'):
                continue
            raw=z.read(name)
            try: text=raw.decode('utf-8-sig')
            except UnicodeDecodeError: text=raw.decode('cp1251')
            module=re.sub(r'^\d+_', '',pathlib.PurePosixPath(name).stem)
            procedures=re.findall(r'^\s*(?:(?:Public|Private|Friend|Static)\s+)*(?:Sub|Function|Property\s+(?:Get|Let|Set))\s+([^\s(]+)', text, re.M|re.I)
            modules.append({'module':module,'sha256':hashlib.sha256(raw).hexdigest(),'procedures':procedures,
                            'previouslyAbsentFromActiveDir':module in excluded})
    active=[m for m in modules if not m['previouslyAbsentFromActiveDir']]
    return {'archiveSha256':hashlib.sha256(pathlib.Path(archive).read_bytes()).hexdigest(),
            'archiveModules':len(modules),'archiveProcedures':sum(len(m['procedures']) for m in modules),
            'activeCandidateModules':len(active),'activeCandidateProcedures':sum(len(m['procedures']) for m in active),
            'previousActiveDir':previous['active_project'],
            'activeDirReextractedThisRun':False,
            'limitation':'Active candidates follow the saved 2026-10-29 exclusion list; current Access binding and active source hashes were not independently re-extracted.',
            'modules':modules}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('crosscheck');p.add_argument('output')
    p.add_argument('--source-mdb');p.add_argument('--parser-archive');p.add_argument('--event-inventory');a=p.parse_args()
    result=audit(a.archive,a.crosscheck);out=pathlib.Path(a.output).resolve()
    root=pathlib.Path(__file__).resolve().parents[1]
    if out.is_relative_to(root):raise ValueError('Keep the private VBA inventory outside public git')
    supplied=[a.source_mdb,a.parser_archive,a.event_inventory]
    if any(supplied):
        if not all(supplied):p.error('Source MDB, parser archive and event inventory must be supplied together')
        result['activeDirectory']=active_directory(*supplied,json.loads(pathlib.Path(a.crosscheck).read_text(encoding='utf-8')))
        result['activeDirReextractedThisRun']=True
        result['limitation']='Active source hashes and procedures were re-extracted read-only. Live Access event bindings and macro execution remain unverified.'
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:result[k] for k in ['archiveModules','archiveProcedures','activeCandidateModules','activeCandidateProcedures','activeDirReextractedThisRun']}))
