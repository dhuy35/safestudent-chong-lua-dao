const LOG_SHEET_NAME = "Chatbot Logs";
const HEADERS = [
  "STT",
  "Ngày tháng",
  "User",
  "Session ID",
  "Input",
  "Phản hồi của Bot",
  "Thời gian phản hồi của Bot (ms)",
  "Nguồn trả lời",
  "Case nhận diện",
  "Model",
  "Trạng thái"
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty("LOG_WEBHOOK_SECRET");
    const spreadsheetId = properties.getProperty("SHEET_ID");

    if (!expectedSecret || data.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }
    if (!spreadsheetId) {
      return jsonResponse({ ok: false, error: "Missing SHEET_ID" });
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME) || spreadsheet.insertSheet(LOG_SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#dbeafe");
      sheet.setFrozenRows(1);
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const stt = Math.max(1, sheet.getLastRow());
      sheet.appendRow([
        stt,
        data.timestamp || new Date().toISOString(),
        data.user || "ANONYMOUS",
        data.sessionId || "",
        data.input || "",
        data.answer || "",
        Number(data.responseTimeMs) || 0,
        data.source || "unknown",
        data.caseTitle || "",
        data.model || "",
        data.status || "success"
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
