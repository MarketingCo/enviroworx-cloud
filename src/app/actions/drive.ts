'use server'

import { google } from 'googleapis'

export async function logToDrive(data: {
  date: string,
  ticketNumber: string,
  customerName: string,
  address: string,
  amountPaid: number,
  costGross: number,
  paymentMethod: string,
  sheetName?: string
}) {
  const isSepa = data.sheetName === 'SEPA';
  if (data.paymentMethod !== 'Cash' && !isSepa) return { success: true };

  try {
    const credsStr = process.env.GOOGLE_DRIVE_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_DRIVE_SHEET_ID;
    
    if (!credsStr || !spreadsheetId) {
      console.warn('Google Drive credentials or Sheet ID missing. Skipping log sync.');
      return { success: true, message: 'Missing credentials' };
    }

    const credentials = JSON.parse(credsStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    let targetSheet = data.sheetName || 'Sheet1';

    // 1. Ensure the monthly sheet exists (if it's SEPA)
    if (isSepa) {
      const today = new Date();
      // SEPA report usually runs for the PREVIOUS month
      const reportDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthName = reportDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const monthlyTabName = `SEPA - ${monthName}`;
      
      try {
        // Check if tab exists
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === monthlyTabName);
        
        if (!sheetExists) {
          // Create new tab for this month
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                addSheet: { properties: { title: monthlyTabName } }
              }]
            }
          });
          // Add Headers to new sheet
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${monthlyTabName}!A1:G1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [['Date', 'Ticket #', 'Customer', 'Address', 'Amount Paid', 'Total Cost', 'Method']]
            }
          });
        }
        targetSheet = monthlyTabName;
      } catch (e) {
        console.warn('Could not create monthly SEPA sheet, falling back to SEPA tab');
      }
    }

    const values = [
      [
        data.date,
        data.ticketNumber,
        data.customerName,
        data.address,
        data.amountPaid.toFixed(2),
        data.costGross.toFixed(2),
        data.paymentMethod
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${targetSheet}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    console.log(`Successfully logged to ${targetSheet} on Google Drive.`);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to log to Drive (${data.sheetName}):`, error);
    return { success: false, error: error.message };
  }
}
