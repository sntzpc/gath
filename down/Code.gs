// Konfigurasi
const SPREADSHEET_ID = '1GOqDTBaRZb6PjX1kHKIZnebNJ4QIENr7cVnoMjZZHqE';
const SHEET_NAME = 'attendance';

// ===== PATCH START: JSONP-friendly doGet/doPost =====
function doGet(e) {
  e = e || {};
  var params = (e.parameter || {});
  var action = params.action || "";
  var callback = params.callback; // untuk JSONP

  var result;
  try {
    switch (action) {
      case 'getRegions':
        result = getRegions();
        break;
      case 'getUnits':
        result = getUnits(params.region);
        break;
      case 'getParticipants':
        result = getParticipants(params.region, params.unit);
        break;
      case 'getAllData':
        result = getAllData();
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
  } catch (err) {
    result = { success: false, error: String(err && err.stack ? err.stack : err) };
  }

  var json = JSON.stringify(result);

  // === JSONP mode (paling aman terhadap CORS, cocok untuk Chrome mobile) ===
  if (callback) {
    // sanitasi callback (hindari karakter aneh)
    callback = String(callback).replace(/[^\w.$]/g, '');
    var js = callback + "(" + json + ");";
    return ContentService
      .createTextOutput(js)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // === Normal JSON mode (untuk akses langsung, bukan dari browser beda domain) ===
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // untuk kompatibilitas: POST diarahkan ke GET logic
  return doGet(e);
}
// ===== PATCH END =====

// Mendapatkan daftar region unik
function getRegions() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var regionIndex = headers.indexOf('region');
  var unitIndex = headers.indexOf('unit');
  
  var regions = {};
  
  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var region = row[regionIndex];
    var unit = row[unitIndex];
    
    if (!regions[region]) {
      regions[region] = {
        name: region,
        units: {},
        totalParticipants: 0
      };
    }
    
    if (!regions[region].units[unit]) {
      regions[region].units[unit] = 0;
    }
    
    // Parse family_json untuk menghitung total anggota keluarga
    try {
      var family = JSON.parse(row[headers.indexOf('family_json')]);
      var familyCount = family.length;
      regions[region].units[unit] += familyCount;
      regions[region].totalParticipants += familyCount;
    } catch(e) {
      regions[region].units[unit] += 1;
      regions[region].totalParticipants += 1;
    }
  }
  
  return {
    success: true,
    data: Object.values(regions)
  };
}

// Mendapatkan daftar unit berdasarkan region
function getUnits(region) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var regionIndex = headers.indexOf('region');
  var unitIndex = headers.indexOf('unit');
  
  var units = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[regionIndex] === region) {
      var unit = row[unitIndex];
      if (!units[unit]) {
        units[unit] = {
          name: unit,
          totalParticipants: 0
        };
      }
      
      try {
        var family = JSON.parse(row[headers.indexOf('family_json')]);
        units[unit].totalParticipants += family.length;
      } catch(e) {
        units[unit].totalParticipants += 1;
      }
    }
  }
  
  return {
    success: true,
    data: Object.values(units)
  };
}

// Mendapatkan daftar peserta berdasarkan region dan unit
function getParticipants(region, unit) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var regionIndex = headers.indexOf('region');
  var unitIndex = headers.indexOf('unit');
  var idIndex = headers.indexOf('id');
  var eventIdIndex = headers.indexOf('event_id');
  var nikIndex = headers.indexOf('nik');
  var nameIndex = headers.indexOf('name');
  var familyJsonIndex = headers.indexOf('family_json');
  var timestampIndex = headers.indexOf('timestamp');
  
  var participants = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[regionIndex] === region && row[unitIndex] === unit) {
      try {
        var family = JSON.parse(row[familyJsonIndex]);
      } catch(e) {
        var family = [];
      }
      
      participants.push({
        id: row[idIndex],
        eventId: row[eventIdIndex],
        nik: row[nikIndex],
        name: row[nameIndex],
        region: row[regionIndex],
        unit: row[unitIndex],
        family: family,
        timestamp: row[timestampIndex]
      });
    }
  }
  
  return {
    success: true,
    data: participants
  };
}

// Mendapatkan semua data untuk tabel
function getAllData() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var allData = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowData = {};
    
    for (var j = 0; j < headers.length; j++) {
      if (headers[j] === 'family_json') {
        try {
          var family = JSON.parse(row[j]);
          rowData['family_members'] = family.join(', ');
          rowData['total_family'] = family.length;
        } catch(e) {
          rowData['family_members'] = row[j];
          rowData['total_family'] = 1;
        }
      } else {
        rowData[headers[j]] = row[j];
      }
    }
    
    allData.push(rowData);
  }
  
  return {
    success: true,
    data: allData,
    headers: headers
  };
}