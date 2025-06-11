import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';
import { exec, spawn } from 'child_process';
import * as os from 'os';

export async function getAppConnectionInfo(filePath: string) {
  let current = path.dirname(filePath);
  while (!current.endsWith('App_Data') && current !== path.dirname(current)) {
    current = path.dirname(current);
  }

  if (!current.endsWith('App_Data')) return null;
  const rootDir = path.dirname(current);
  const configPath = path.join(rootDir, 'web.config');
  if (!fs.existsSync(configPath)) return null;

  const content = fs.readFileSync(configPath, 'utf8');
  const parser = new xml2js.Parser({ explicitArray: false });
  const xml = await parser.parseStringPromise(content);
  const list = xml?.configuration?.connectionStrings?.add;
  if (!list) return null;

  const getConn = (name: string) =>
    Array.isArray(list)
      ? list.find((x) => x.$.name === name)
      : list.$.name === name
        ? list
        : null;

  const sysRaw = getConn('sysConnectionString')?.$.connectionString;
  if (!sysRaw) return null;

  const extract = (key: string) =>
    sysRaw.match(new RegExp(key + '=([^;]+)', 'i'))?.[1] || '';

  const dataSource = extract('Data Source');
  const uid = extract('Uid');
  const pwd = extract('Pwd');
  const sysDb = extract('Initial Catalog');
  const appDb = sysDb.replace(/_S$/i, '_A');

  return {
    dataSource,
    uid,
    pwd,
    db: appDb
  };
}

function isSSMSRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('tasklist', (err, stdout) => {
      resolve(stdout.toLowerCase().includes('ssms.exe'));
    });
  });
}

export async function connectToSSMSAppDB(info: { dataSource: string; db: string; uid: string; pwd: string }) {
  const running = await isSSMSRunning();

  const msg = `Server: ${info.dataSource} | DB: ${info.db} | UID: ${info.uid} | PWD: ${info.pwd}`;
  vscode.window.showInformationMessage(msg);

  const ssmsPath = 'C:\\Program Files (x86)\\Microsoft SQL Server Management Studio 18\\Common7\\IDE\\Ssms.exe';

  const tempFile = path.join(os.tmpdir(), 'sql-connect-info.txt');
  fs.writeFileSync(tempFile, `Server=${info.dataSource}\nDatabase=${info.db}\nUid=${info.uid}\nPwd=${info.pwd}`);

  spawn(ssmsPath, ['-S', info.dataSource, '-d', info.db], {
    detached: true,
    stdio: 'ignore'
  }).unref();

 // const ahkScriptPath = path.join(__dirname, '..', 'AutoConnectSSMS.ahk');
  const ahkScriptPath = path.join(__dirname, 'AutoConnectSSMS.ahk');

  spawn('AutoHotkey.exe', [ahkScriptPath], { detached: true }).unref();
}
