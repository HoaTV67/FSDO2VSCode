// Import các module cần thiết
import * as vscode from 'vscode';        // Dùng để tương tác với VS Code (hiển thị thông báo)
import * as fs from 'fs';                // Đọc file hệ thống
import * as path from 'path';            // Xử lý đường dẫn file
import * as xml2js from 'xml2js';        // Parse XML thành object JavaScript
import { exec, spawn } from 'child_process'; // Chạy command hệ thống (mở SSMS, AutoHotkey)
import * as os from 'os';                // Lấy thư mục tạm hệ điều hành

/**
 * Phân tích file web.config từ một file bất kỳ (ví dụ file XML trong dự án),
 * truy ngược lên thư mục App_Data → tìm web.config → trích connection string hệ thống,
 * rồi chuyển sang DB ứng dụng (_A) từ DB hệ thống (_S).
 */
export async function getAppConnectionInfo(filePath: string) {
  // Dò ngược lên thư mục cha đến khi gặp App_Data hoặc đến thư mục gốc
  let current = path.dirname(filePath);
  while (!current.endsWith('App_Data') && current !== path.dirname(current)) {
    current = path.dirname(current);
  }

  // Nếu không tìm được App_Data thì trả về null
  if (!current.endsWith('App_Data')) return null;

  // Xác định thư mục gốc chứa web.config
  const rootDir = path.dirname(current);
  const configPath = path.join(rootDir, 'web.config');

  // Nếu không tồn tại file web.config thì trả về null
  if (!fs.existsSync(configPath)) return null;

  // Đọc nội dung file web.config
  const content = fs.readFileSync(configPath, 'utf8');

  // Parse XML sang object JS
  const parser = new xml2js.Parser({ explicitArray: false });
  const xml = await parser.parseStringPromise(content);

  // Lấy danh sách các chuỗi kết nối từ <connectionStrings><add ... />
  const list = xml?.configuration?.connectionStrings?.add;
  if (!list) return null;

  // Hàm phụ: lấy connection string theo tên (name)
  const getConn = (name: string) =>
    Array.isArray(list)
      ? list.find((x) => x.$.name === name)
      : list.$.name === name
        ? list
        : null;

  // Lấy chuỗi kết nối hệ thống
  const sysRaw = getConn('sysConnectionString')?.$.connectionString;
  if (!sysRaw) return null;

  // Hàm tách thông tin từ chuỗi kết nối theo từng khóa
  const extract = (key: string) =>
    sysRaw.match(new RegExp(key + '=([^;]+)', 'i'))?.[1] || '';

  // Tách các thông tin cần thiết từ chuỗi
  const dataSource = extract('Data Source');
  const uid = extract('Uid');
  const pwd = extract('Pwd');
  const sysDb = extract('Initial Catalog');

  // Đổi tên DB hệ thống (_S) thành DB ứng dụng (_A)
  const appDb = sysDb.replace(/_S$/i, '_A');

  // Trả về thông tin kết nối DB ứng dụng
  return {
    dataSource,
    uid,
    pwd,
    db: appDb
  };
}

/**
 * Kiểm tra xem SSMS (SQL Server Management Studio) có đang chạy không
 */
function isSSMSRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('tasklist', (err, stdout) => {
      resolve(stdout.toLowerCase().includes('ssms.exe'));
    });
  });
}

/**
 * Mở SSMS với thông tin DB ứng dụng, và gọi AutoHotkey script để tự động nhập thông tin đăng nhập
 */
export async function connectToSSMSAppDB(info: { dataSource: string; db: string; uid: string; pwd: string }) {
  // Kiểm tra trạng thái SSMS (có thể dùng để xử lý nâng cao)
  const running = await isSSMSRunning();

  // Hiển thị thông tin đang kết nối để người dùng biết
  const msg = `Server: ${info.dataSource} | DB: ${info.db} | UID: ${info.uid} | PWD: ${info.pwd}`;
  vscode.window.showInformationMessage(msg);

  // Đường dẫn mặc định của SSMS 18
  const ssmsPath = 'C:\\Program Files (x86)\\Microsoft SQL Server Management Studio 18\\Common7\\IDE\\Ssms.exe';

  // Ghi file tạm để AutoHotkey có thể đọc nếu cần
  const tempFile = path.join(os.tmpdir(), 'sql-connect-info.txt');
  fs.writeFileSync(tempFile, `Server=${info.dataSource}\nDatabase=${info.db}\nUid=${info.uid}\nPwd=${info.pwd}`);

  // Mở SSMS và kết nối vào DB chỉ định
  spawn(ssmsPath, ['-S', info.dataSource, '-d', info.db], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  // Gọi AutoHotkey script để tự động nhập thông tin và connect
  const ahkScriptPath = path.join(__dirname, 'AutoConnectSSMS.ahk');
  spawn('AutoHotkey.exe', [ahkScriptPath], { detached: true }).unref();
}
