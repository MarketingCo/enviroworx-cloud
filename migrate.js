require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

// Connect to Supabase using your admin key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

async function runMigration() {
  console.log("📂 Reading data.xlsx...");
  let workbook;
  try {
    workbook = xlsx.readFile('data.xlsx');
  } catch (e) {
    console.error("❌ Could not find data.xlsx. Make sure it is named exactly 'data.xlsx' and is in this folder.");
    return;
  }

  // --- MIGRATE CUSTOMERS ---
  if (workbook.Sheets['Customers']) {
    console.log("🔄 Processing Customers tab...");
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets['Customers'], { header: 1 });
    
    // Skip the header row (index 0) and map the rest
    const customersToInsert = rows.slice(1)
      .filter(row => row[0]) // Only grab rows with a name
      .map(row => ({
        name: String(row[0]).trim(),
        phone: row[1] ? String(row[1]).trim() : null,
        address: row[2] ? String(row[2]).trim() : null
      }));

    console.log(`📤 Uploading ${customersToInsert.length} Customers to Supabase...`);
    const { error } = await supabase.from('customers').insert(customersToInsert);
    
    if (error) console.error("❌ Customer Upload Error:", error.message);
    else console.log("✅ Customers successfully uploaded!");
  } else {
    console.log("⚠️ No tab named 'Customers' found in the Excel file.");
  }

  console.log("🎉 Script finished.");
}

runMigration();
