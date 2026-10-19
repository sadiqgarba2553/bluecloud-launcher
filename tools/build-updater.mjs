import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.platform==='win32'){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'build');
  await mkdir(output,{recursive:true});
  const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version.split('-')[0];
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid updater build version');
  const attributes=path.join(output,'updater-version.cs');
  await writeFile(attributes,`using System.Reflection;\n[assembly: AssemblyTitle("BlueCloud Update")]\n[assembly: AssemblyProduct("BlueCloud Launcher")]\n[assembly: AssemblyVersion("${version}.0")]\n[assembly: AssemblyFileVersion("${version}.0")]\n`);
  const compiler=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  const built=spawnSync(compiler,['/nologo','/target:winexe','/optimize+','/reference:System.Runtime.Serialization.dll','/out:'+path.join(output,'BlueCloudUpdate.exe'),path.join(root,'updater/Program.cs'),attributes],{encoding:'utf8',windowsHide:true});
  if(built.status!==0)throw Error('Native updater compilation failed: '+(built.stdout||built.stderr||built.error?.message));
  console.log('Built native Windows updater.');
}
