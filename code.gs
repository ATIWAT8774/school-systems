/*************************************************
 * CONFIG พื้นฐาน
 *************************************************/

// ถ้าเป็น Web App ที่ผูกกับไฟล์ชีตนี้อยู่แล้ว ใช้แบบนี้ได้เลย
const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();

// ตั้งชื่อแผ่นงาน (ต้องมีอยู่จริงในไฟล์ Google Sheet)
const SHEET_USERS         = 'Users';
const SHEET_TASKS         = 'Tasks';
const SHEET_ANNOUNCEMENTS = 'Announcements';
const SHEET_PROBLEMS      = 'Problems';

// กำหนดคอลัมน์ (หัวตาราง แถวที่ 1) ของแต่ละแผ่นงาน
const USER_HEADERS = [
  'id',
  'username',
  'password',
  'fullName',
  'role',
  'department',
  'createdAt'
];

const TASK_HEADERS = [
  'id',
  'title',
  'description',
  'deadline',
  'priority',
  'assignedTo',
  'assignedBy',
  'status',
  'createdAt',
  'completedAt' // ถ้ายังไม่เสร็จให้เว้นว่าง
];

const ANNOUNCEMENT_HEADERS = [
  'id',
  'title',
  'message',
  'assignedBy',
  'createdAt'
];

const PROBLEM_HEADERS = [
  'id',
  'category',
  'message',
  'assignedBy',
  'createdAt'
];

/*************************************************
 * helper function สำหรับ response JSON
 *************************************************/

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/*************************************************
 * doGet – เอาไว้เช็คว่า web app ยังทำงานอยู่
 *************************************************/

function doGet(e) {
  return jsonResponse({
    success: true,
    message: 'Web App Online'
  });
}

/*************************************************
 * doPost – endpoint หลักที่ frontend เรียก
 * body ที่คาดหวัง (JSON):
 * {
 *   "action": "list" | "create" | "update" | "delete",
 *   "entity": "user" | "task" | "announcement" | "problem",
 *   "item":   { ... }              // สำหรับ create / update / delete
 * }
 *************************************************/

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('no postData');
    }

    const data   = JSON.parse(e.postData.contents);
    const action = data.action;
    const entity = data.entity;
    const item   = data.item || {};

    if (!action) throw new Error('missing action');
    if (!entity) throw new Error('missing entity');

    let result;

    switch (action) {
      case 'list':
        result = handleList(entity);
        break;

      case 'create':
        result = handleCreate(entity, item);
        break;

      case 'update':
        result = handleUpdate(entity, item);
        break;

      case 'delete':
        result = handleDelete(entity, item);
        break;

      default:
        throw new Error('Unknown action: ' + action);
    }

    return jsonResponse({
      success: true,
      data: result || null
    });

  } catch (err) {
    Logger.log(err);
    return jsonResponse({
      success: false,
      message: err.toString()
    });
  }
}

/*************************************************
 * ฟังก์ชันรวมสำหรับ list / create / update / delete
 *************************************************/

function handleList(entity) {
  const { sheet, headers } = getSheetAndHeaders(entity);
  ensureHeaders(sheet, headers);

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return []; // มีแต่หัวตาราง

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx];
    });
    rows.push(obj);
  }
  return rows;
}

function handleCreate(entity, item) {
  const { sheet, headers } = getSheetAndHeaders(entity);
  ensureHeaders(sheet, headers);

  // map object -> row ตามลำดับ header
  const row = headers.map(h => item[h] !== undefined ? item[h] : '');
  sheet.appendRow(row);

  return { id: item.id || null };
}

function handleUpdate(entity, item) {
  if (!item.id) {
    throw new Error('update requires item.id');
  }

  const { sheet, headers } = getSheetAndHeaders(entity);
  ensureHeaders(sheet, headers);

  const values = sheet.getDataRange().getValues();
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) {
    throw new Error('no "id" column in headers');
  }

  let foundRowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idColIndex] == item.id) {
      foundRowIndex = i + 1; // index sheet เริ่ม 1
      break;
    }
  }

  if (foundRowIndex === -1) {
    throw new Error('id not found: ' + item.id);
  }

  const rowValues = headers.map(h => item[h] !== undefined ? item[h] : '');
  sheet.getRange(foundRowIndex, 1, 1, headers.length).setValues([rowValues]);

  return { id: item.id };
}

function handleDelete(entity, item) {
  if (!item.id) {
    throw new Error('delete requires item.id');
  }

  const { sheet, headers } = getSheetAndHeaders(entity);
  ensureHeaders(sheet, headers);

  const values = sheet.getDataRange().getValues();
  const idColIndex = headers.indexOf('id');
  if (idColIndex === -1) {
    throw new Error('no "id" column in headers');
  }

  let foundRowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idColIndex] == item.id) {
      foundRowIndex = i + 1;
      break;
    }
  }

  if (foundRowIndex === -1) {
    throw new Error('id not found: ' + item.id);
  }

  sheet.deleteRow(foundRowIndex);
  return { id: item.id };
}

/*************************************************
 * mapping entity -> sheet + headers
 *************************************************/

function getSheetAndHeaders(entity) {
  let sheetName, headers;

  switch (entity) {
    case 'user':
    case 'users':
      sheetName = SHEET_USERS;
      headers   = USER_HEADERS;
      break;

    case 'task':
    case 'tasks':
      sheetName = SHEET_TASKS;
      headers   = TASK_HEADERS;
      break;

    case 'announcement':
    case 'announcements':
      sheetName = SHEET_ANNOUNCEMENTS;
      headers   = ANNOUNCEMENT_HEADERS;
      break;

    case 'problem':
    case 'problems':
      sheetName = SHEET_PROBLEMS;
      headers   = PROBLEM_HEADERS;
      break;

    default:
      throw new Error('Unknown entity: ' + entity);
  }

  const sheet = SPREADSHEET.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  return { sheet, headers };
}

/*************************************************
 * ตรวจและตั้งหัวตารางให้ตรงกับที่กำหนด
 *************************************************/

function ensureHeaders(sheet, headers) {
  const range = sheet.getDataRange();
  const values = range.getValues();

  if (values.length === 0) {
    // ไม่มีข้อมูลเลย → ใส่หัวแถวใหม่
    sheet.appendRow(headers);
    return;
  }

  const firstRow = values[0];

  // ถ้าจำนวนคอลัมน์ไม่ตรง หรือ header ไม่ตรง → เขียนทับใหม่
  const needReset =
    firstRow.length !== headers.length ||
    headers.some((h, i) => firstRow[i] !== h);

  if (needReset) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

/*************************************************
 * ฟังก์ชันทดสอบ (รันจากเมนู Run ใน Script Editor)
 * ‼️ ห้ามกด Run ที่ doPost โดยตรง จะ error postData undefined
 *************************************************/

function test_doPost_createUser() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'create',
        entity: 'user',
        item: {
          id: 'U1',
          username: 'admin',
          password: 'admin123',
          fullName: 'ผู้ดูแลระบบ',
          role: 'admin',
          department: 'all',
          createdAt: new Date().toISOString()
        }
      }),
      type: 'application/json'
    }
  };

  const res = doPost(fakeEvent);
  Logger.log(res.getContent());
}

function test_doPost_listUsers() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'list',
        entity: 'user'
      }),
      type: 'application/json'
    }
  };

  const res = doPost(fakeEvent);
  Logger.log(res.getContent());
}
