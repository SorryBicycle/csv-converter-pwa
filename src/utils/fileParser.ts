import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function parseFileToJSON(file: File, rawRows: boolean = false): Promise<any[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: !rawRows,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err)
      });
    });
  } else if (extension === 'xlsx' || extension === 'xls') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          if (rawRows) {
            // Return array of arrays (rows)
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
            resolve(rows);
          } else {
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            resolve(json);
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }
  
  throw new Error("Unsupported file type. Please upload a CSV or Excel file.");
}
