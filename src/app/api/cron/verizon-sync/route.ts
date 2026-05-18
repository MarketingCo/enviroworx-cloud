export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyCronSecret } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const appId = process.env.VERIZON_APP_ID;
    const apiKey = process.env.VERIZON_API_KEY;

    if (!appId || !apiKey) {
      return NextResponse.json({ error: 'Verizon credentials missing.' }, { status: 400 })
    }

    // 1. Get Access Token (EU Fleetmatics endpoint)
    const authHeader = Buffer.from(`${appId}:${apiKey}`).toString('base64');
    const tokenRes = await fetch('https://fim.api.eu.fleetmatics.com/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Verizon Token Error:', err);
      return NextResponse.json({ error: 'Failed to authenticate with Verizon' }, { status: 500 });
    }

    const { access_token } = await tokenRes.json();

    // 2. Fetch Vehicle Locations
    const locRes = await fetch('https://fim.api.eu.fleetmatics.com/rad/v1/vehicles/locations', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!locRes.ok) {
      console.error('Verizon Location Error:', await locRes.text());
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    const vehiclesData = await locRes.json();
    const telemetryInserts = []

    // Adjusting based on standard Fleetmatics JSON response
    const vehicles = Array.isArray(vehiclesData) ? vehiclesData : vehiclesData.vehicles || [];

    for (const v of vehicles) {
      const reg = v.registration || v.vehicleNumber || v.name;
      const lat = v.latitude;
      const lng = v.longitude;
      const speed = v.speed || 0;
      const heading = v.heading || 0;

      if (!reg || !lat || !lng) continue;

      const { error: updateError } = await supabaseAdmin.from('vehicles')
        .update({
          latitude: lat,
          longitude: lng,
          speed: speed,
          heading: heading,
          last_updated: new Date().toISOString()
        })
        .or(`reg.eq.${reg},verizon_vehicle_number.eq.${reg}`);

      if (!updateError) {
        telemetryInserts.push({
          vehicle_reg: reg,
          latitude: lat,
          longitude: lng,
          speed: speed,
          heading: heading
        })
      }
    }

    if (telemetryInserts.length > 0) {
      try {
        await supabaseAdmin.from('vehicle_telemetry').insert(telemetryInserts)
      } catch (e) {
        console.error('Vehicle telemetry insert error:', e)
      }
    }

    return NextResponse.json({ success: true, updated: telemetryInserts.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Verizon Sync Cron Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
