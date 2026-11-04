#!/usr/bin/env python3
"""Package private references locally and sign with a durable private key.

No references, APK, password or signing key are uploaded to GitHub. An APK
with V14's package name is refused unless its original certificate matches.
"""
import argparse, gzip, hashlib, json, os, pathlib, re, secrets, shutil, subprocess, tempfile, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]

def run(args,env=None):
    result=subprocess.run([str(a) for a in args],env=env,capture_output=True,text=True)
    if result.returncode:
        raise RuntimeError('Packaging tool failed: '+pathlib.Path(str(args[0])).name+'\n'+(result.stderr or result.stdout)[-1200:])
    return result.stdout+result.stderr

def private_path(value):
    p=pathlib.Path(value).resolve()
    if p.is_relative_to(ROOT):raise ValueError('Private APK inputs and outputs must stay outside public git')
    return p

def signing_key(directory):
    directory=private_path(directory);directory.mkdir(parents=True,exist_ok=True);os.chmod(directory,0o700)
    metadata=directory/'signing-private.json';keystore=directory/'solin-cloud-lab.p12'
    if metadata.exists():
        data=json.loads(metadata.read_text());assert keystore.is_file(),'Signing key is missing; do not generate a replacement'
    else:
        if keystore.exists():raise ValueError('Existing key without metadata; refusing to overwrite it')
        data={'alias':'solin-cloud-lab','password':secrets.token_urlsafe(32)}
        env={**os.environ,'SOLIN_LAB_KEY_PASSWORD':data['password']}
        run(['keytool','-genkeypair','-storetype','PKCS12','-keystore',keystore,'-alias',data['alias'],'-keyalg','RSA','-keysize','3072','-validity','10950','-dname','CN=SOLI-N Field Cloud Lab,O=SOLI-N Field,C=KZ','-storepass:env','SOLIN_LAB_KEY_PASSWORD','-keypass:env','SOLIN_LAB_KEY_PASSWORD','-noprompt'],env)
        metadata.write_text(json.dumps(data,indent=2));os.chmod(metadata,0o600);os.chmod(keystore,0o600)
    return keystore,data

def backup_key(directory,output):
    keystore,data=signing_key(directory);out=private_path(output);out.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        z.write(keystore,keystore.name);z.write(keystore.parent/'signing-private.json','signing-private.json')
        z.writestr('README.txt','Private Cloud Lab signing key and password. Keep this archive private. It is NOT the original V14 key. Reuse both files for future Cloud Lab updates; never generate a replacement for an installed app.\n')
    os.chmod(out,0o600)
    return out

def package(base,reference,tools,keydir,original,output,allow_upgrade=False):
    base,reference,tools,original,output=map(private_path,[base,reference,tools,original,output])
    if output.exists():raise ValueError('Refusing to overwrite a previously packaged APK')
    if output in [base,original]:raise ValueError('Original APK cannot be an output')
    ref=json.loads(gzip.decompress(reference.read_bytes()))
    if ref.get('format')!='SOLIN-private-reference-supplement-v1' or ref.get('sourceSha256')!='f49dbcc449294e89632bbc6d6935dc2dcda8fa1732cd9b1f8e9378ca4bc42dcf':raise ValueError('Unknown original reference source')
    for t in ['PIAP','Кл_Рай']:
        if not isinstance(ref.get('tables',{}).get(t),list):raise ValueError('Incomplete private references')
    signer=tools/'apksigner.jar';align=tools/'zipalign';aapt=tools/'aapt'
    for p in [signer,align,aapt]:
        if not p.is_file():raise ValueError('Signing utility missing: '+p.name)
    os.chmod(align,0o755);os.chmod(aapt,0o755)
    keystore,key=signing_key(keydir);env={**os.environ,'SOLIN_LAB_KEY_PASSWORD':key['password']}
    def certificate(apk):
        log=run(['java','-jar',signer,'verify','--print-certs',apk])
        fingerprints={v.lower() for v in re.findall(r'certificate SHA-256 digest:\s*([0-9a-fA-F]{64})',log)}
        if len(fingerprints)!=1:raise ValueError('Expected one verified APK signing certificate')
        return fingerprints.pop()
    def app_id(apk):
        m=re.search(r"package: name='([^']+)'",run([aapt,'dump','badging',apk]))
        if not m:raise ValueError('Cannot read Android package identity')
        return m.group(1)
    original_id=app_id(original);base_id=app_id(base)
    info=run(['keytool','-list','-v','-keystore',keystore,'-storepass:env','SOLIN_LAB_KEY_PASSWORD','-alias',key['alias']],env)
    m=re.search(r'SHA256:\s*([0-9A-Fa-f:]+)',info)
    if not m:raise ValueError('Cannot read private signing certificate')
    key_fp=m.group(1).replace(':','').lower();original_fp=certificate(original)
    if base_id==original_id and (not allow_upgrade or key_fp!=original_fp):raise ValueError('V14 update refused: original signing key is required; keep V14 and its data')
    if base_id!=original_id and base_id!='kz.solin.field.cloudlab':raise ValueError('Unknown parallel application identity')
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='solin-private-apk-',dir=output.parent) as td:
        raw=pathlib.Path(td)/'refs.apk';aligned=pathlib.Path(td)/'aligned.apk';shutil.copyfile(base,raw)
        with zipfile.ZipFile(raw,'a',compression=zipfile.ZIP_DEFLATED) as z:
            name='assets/public/solin-private-refs.packed.bin'
            if name in z.namelist():raise ValueError('Base already contains private references')
            z.writestr(name,reference.read_bytes())
        run([align,'-f','-P','16','4',raw,aligned])
        checked=pathlib.Path(td)/'signed.apk'
        run(['java','-jar',signer,'sign','--ks',keystore,'--ks-key-alias',key['alias'],'--ks-pass','env:SOLIN_LAB_KEY_PASSWORD','--key-pass','env:SOLIN_LAB_KEY_PASSWORD','--v4-signing-enabled','false','--out',checked,aligned],env)
        run([align,'-c','-P','16','4',checked]);signed_fp=certificate(checked)
        if signed_fp!=key_fp:raise ValueError('Output certificate differs from the durable key')
        with zipfile.ZipFile(checked) as signed,zipfile.ZipFile(base) as src:
            if signed.testzip():raise ValueError('Corrupted output APK')
            if signed.read('assets/public/solin-private-refs.packed.bin')!=reference.read_bytes():raise ValueError('Private references changed')
            for name in src.namelist():
                if name.startswith('assets/public/') and not name.endswith('/'):
                    if signed.read(name)!=src.read(name):raise ValueError('Changed tested application asset: '+name)
        os.link(checked,output) # atomically publish only verified bytes, never overwrite
    result={'format':'SOLIN-private-apk-check-v1','package':base_id,'originalPackage':original_id,'parallelInstall':base_id!=original_id,'v14InPlaceUpdateAllowed':base_id==original_id and key_fp==original_fp,'originalCertificateSha256':original_fp,'certificateSha256':signed_fp,'apkSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'referencesSha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'referenceTables':{k:len(v) for k,v in ref['tables'].items()},'baseAssetsPreserved':True,'signatureVerified':True,'zipAlignmentVerified':True,'privateApkEmulatorExecuted':False}
    output.with_suffix('.verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--base');p.add_argument('--references');p.add_argument('--tools');p.add_argument('--keydir',required=True);p.add_argument('--original-v14');p.add_argument('--output');p.add_argument('--backup-key');p.add_argument('--allow-v14-upgrade',action='store_true');a=p.parse_args()
    if a.backup_key:print(json.dumps({'signingBackupCreated':str(backup_key(a.keydir,a.backup_key))}))
    if a.output:
        for n in ['base','references','tools','original_v14']:
            if not getattr(a,n):p.error('Missing --'+n.replace('_','-'))
        print(json.dumps(package(a.base,a.references,a.tools,a.keydir,a.original_v14,a.output,a.allow_v14_upgrade),ensure_ascii=False))
