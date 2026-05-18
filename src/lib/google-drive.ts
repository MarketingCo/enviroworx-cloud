import { google } from 'googleapis'

export async function logCashToDrive(data: {
  date: string,
  ticketNumber: string,
  customerName: string,
  address: string,
  amountPaid: number,
  costGross: number,
  paymentMethod: string
}) {
  if (data.paymentMethod !== 'Cash') return;

  try {
    const credsStr = process.env.GOOGLE_DRIVE_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_DRIVE_SHEET_ID;
    
    if (!credsStr || !spreadsheetId) {
      console.warn('Google Drive credentials or Sheet ID missing. Skipping cash log sync.');
      return;
    }

    const credentials = JSON.parse(credsStr);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const values = [
      [
        data.date,
        data.ticketNumber,
        data.customerName,
        data.address,
        data.amountPaid.toFixed(2),
        data.costGross.toFixed(2)
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    console.log(`Successfully logged cash payment for ${data.customerName} to Google Drive.`);
  } catch (error) {
    console.error('Failed to log cash to Google Drive:', error);
  }
}
