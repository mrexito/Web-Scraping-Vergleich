import XLSX from 'xlsx';

// Funktion zum Lesen des Sheets "Liste" aus der Excel-Datei
export function readSpecificSheetAsJson(filePath) {
    // Lese die Excel-Datei
    const workbook = XLSX.readFile(filePath);

    // Überprüfe, ob das Sheet "Liste" existiert
    const sheetName = "Liste";
    if (!workbook.Sheets[sheetName]) {
        throw new Error(`Sheet "${sheetName}" not found`);
    }

    // Greife auf das "Liste"-Sheet zu
    const worksheet = workbook.Sheets[sheetName];

    // Konvertiere das Sheet in JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData;
}

// Beispiel-Aufruf
const filePath = './Konkurrenzanlayse_Gymiteam.xlsx'; // Pfad zur Excel-Datei
const jsonData = readSpecificSheetAsJson(filePath);
console.log(jsonData);
