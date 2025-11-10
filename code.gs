// ================== CONFIG ==================
const SPREADSHEET_ID = '1-Ora8jkyiG6RJVN4G0rRGOhyhyATVaYf9uTA5lotMjw'; // TODO: แก้เป็น ID ของ Google Sheet

const SHEET_USERS = 'Users';
const SHEET_TASKS = 'Tasks';
const SHEET_ANN = 'Announcements';
const SHEET_PROB = 'Problems';

// ================== UTIL ==================
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

// คืนค่า JSON (เอา setHeader ออก เพราะใช้ไม่ได้กับ TextOutput)
function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ดึง payload ที่ส่งมาแบบ x-www-form-urlencoded หรือ raw JSON
function parsePayload(e) {
  try {
    // เคสที่เราส่งมาแบบ payload=<json>
    if (e && e.parameter && e.parameter.payload) {
      return JSON.parse(e.parameter.payload);
    }
    // เผื่อกรณีส่ง JSON ตรง ๆ
    if (e && e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch (err) {
    Logger.log('parsePayload error: ' + err);
  }
  return {};
}

// อ่านทุกแผ่นแล้วรวมเป็น array เดียว
function getAllData() {
  const all = [];

  // Users
  const shU = getSheet(SHEET_USERS);
  if (shU) {
    const values = shU.getDataRange().getValues();
    const headers = values[0];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue; // ไม่มี id
      const obj = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        obj[h] = row[idx];
      });
      obj.type = 'user';
      all.push(obj);
    }
  }

  // Tasks
  const shT = getSheet(SHEET_TASKS);
  if (shT) {
    const values = shT.getDataRange().getValues();
    const headers = values[0];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        obj[h] = row[idx];
      });
      obj.type = 'task';
      all.push(obj);
    }
  }

  // Announcements
  const shA = getSheet(SHEET_ANN);
  if (shA) {
    const values = shA.getDataRange().getValues();
    const headers = values[0];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        obj[h] = row[idx];
      });
      obj.type = 'announcement';
      all.push(obj);
    }
  }

  // Problems
  const shP = getSheet(SHEET_PROB);
  if (shP) {
    const values = shP.getDataRange().getValues();
    const headers = values[0];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        obj[h] = row[idx];
      });
      obj.type = 'problem';
      all.push(obj);
    }
  }

  return all;
}

// ================== CRUD DISPATCH ==================
function createItem(entity, item) {
  switch (entity) {
    case 'user':         return createUser(item);
    case 'task':         return createTask(item);
    case 'announcement': return createAnnouncement(item);
    case 'problem':      return createProblem(item);
    default:
      throw new Error('Unknown entity: ' + entity);
  }
}

function updateItem(entity, item) {
  switch (entity) {
    case 'user':         return updateRowById(SHEET_USERS, item.id, item);
    case 'task':         return updateRowById(SHEET_TASKS, item.id, item);
    case 'announcement': return updateRowById(SHEET_ANN, item.id, item);
    case 'problem':      return updateRowById(SHEET_PROB, item.id, item);
    default:
      throw new Error('Unknown entity: ' + entity);
  }
}

function deleteItem(entity, item) {
  switch (entity) {
    case 'user':         return deleteRowById(SHEET_USERS, item.id);
    case 'task':         return deleteRowById(SHEET_TASKS, item.id);
    case 'announcement': return deleteRowById(SHEET_ANN, item.id);
    case 'problem':      return deleteRowById(SHEET_PROB, item.id);
    default:
      throw new Error('Unknown entity: ' + entity);
  }
}

// ================== CREATE FUNCTIONS ==================

// Users sheet columns:
// A:id B:username C:password D:fullName E:role F:department G:createdAt
function createUser(user) {
  const sh = getSheet(SHEET_USERS);
  const row = [
    user.id,
    user.username,
    user.password,
    user.fullName,
    user.role,
    user.department,
    user.createdAt,
  ];
  sh.appendRow(row);
  return user;
}

// Tasks sheet columns:
// A:id B:title C:description D:deadline E:priority F:assignedTo G:assignedBy H:status I:createdAt J:completedAt
function createTask(task) {
  const sh = getSheet(SHEET_TASKS);
  const row = [
    task.id,
    task.title,
    task.description,
    task.deadline,
    task.priority,
    task.assignedTo,
    task.assignedBy,
    task.status,
    task.createdAt,
    task.completedAt || '',
  ];
  sh.appendRow(row);
  return task;
}

// Announcements sheet columns:
// A:id B:title C:message D:assignedBy E:createdAt
function createAnnouncement(a) {
  const sh = getSheet(SHEET_ANN);
  const row = [
    a.id,
    a.title,
    a.message,
    a.assignedBy,
    a.createdAt,
  ];
  sh.appendRow(row);
  return a;
}

// Problems sheet columns:
// A:id B:category C:message D:assignedBy E:createdAt
function createProblem(p) {
  const sh = getSheet(SHEET_PROB);
  const row = [
    p.id,
    p.category,
    p.message,
    p.assignedBy,
    p.createdAt,
  ];
  sh.appendRow(row);
  return p;
}

// ================== UPDATE / DELETE BY ID ==================
function updateRowById(sheetName, id, item) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();
  const headers = values[0];

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }
  if (rowIndex === -1) {
    throw new Error('ไม่พบข้อมูล id: ' + id);
  }

  const rowValues = [];
  headers.forEach((h) => {
    if (!h) {
      rowValues.push('');
      return;
    }
    rowValues.push(item[h] !== undefined ? item[h] : '');
  });

  sh.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  return item;
}

function deleteRowById(sheetName, id) {
  const sh = getSheet(sheetName);
  const values = sh.getDataRange().getValues();

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex === -1) {
    throw new Error('ไม่พบข้อมูล id: ' + id);
  }

  sh.deleteRow(rowIndex);
  return { id: id };
}

// ================== HTTP HANDLERS ==================

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    if (action === 'getAll') {
      const data = getAllData();
      return jsonOutput({ ok: true, data: data });
    }
    return jsonOutput({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    Logger.log('doGet error: ' + err);
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const action = payload.action;
    if (!action) {
      throw new Error('No action in payload');
    }

    let result;
    if (action === 'create') {
      result = createItem(payload.entity, payload.item);
    } else if (action === 'update') {
      result = updateItem(payload.entity, payload.item);
    } else if (action === 'delete') {
      result = deleteItem(payload.entity, payload.item);
    } else {
      throw new Error('Unknown action: ' + action);
    }

    return jsonOutput({ ok: true, result: result });
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonOutput({ ok: false, error: String(err) });
  }
}
