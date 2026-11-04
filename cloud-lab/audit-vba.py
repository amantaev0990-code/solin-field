#!/usr/bin/env python3
"""Inventory recovered VBA without executing it or emitting source code."""
import argparse, hashlib, json, pathlib, re, zipfile

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
    p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('crosscheck');p.add_argument('output');a=p.parse_args()
    result=audit(a.archive,a.crosscheck);out=pathlib.Path(a.output).resolve()
    root=pathlib.Path(__file__).resolve().parents[1]
    if out.is_relative_to(root):raise ValueError('Keep the private VBA inventory outside public git')
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:result[k] for k in ['archiveModules','archiveProcedures','activeCandidateModules','activeCandidateProcedures','activeDirReextractedThisRun']}))
