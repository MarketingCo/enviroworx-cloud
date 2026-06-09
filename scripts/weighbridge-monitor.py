"""
Enviroworx Weighbridge Monitor
===============================
Reads weight from the Dini Argeo weighbridge via TCP socket.

- Streams live readings to the EnviroWorx Cloud app (/api/scale) while a
  truck is on the bridge, so the office "capture from scale" buttons work.
- Logs the peak weight to Google Sheets when the truck leaves (legacy).

Replaces the old direct-to-Supabase version: that one wrote to the wrong
table (weight_logs instead of weighbridge_readings) with a key RLS
rejected, so the app never saw a reading. This machine now only needs the
app URL and a shared secret — no database key.

.env on this machine:
    BRIDGE_IP=192.168.10.100
    BRIDGE_PORT=23
    WEIGHT_THRESHOLD=1000
    SCALE_API_URL=https://<your-app-domain>/api/scale
    SCALE_API_SECRET=<same value as SCALE_INGEST_SECRET in Vercel>
    GOOGLE_CREDS=envi3.json
    GOOGLE_SHEET_ID=1NQIPDNaW4zi7Uzzm38c0RzNI5-wctCPMrXfMDEnv2Yw
"""

import json
import logging
import os
import re
import socket
import sys
import time
import urllib.request
from datetime import datetime

# --- Google Sheets ---
try:
    from google.oauth2.service_account import Credentials
    import gspread
    HAS_GSPREAD = True
except ImportError:
    HAS_GSPREAD = False

# --- Dotenv ---
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ============================================================================
# CONFIGURATION
# ============================================================================

IP_ADDRESS = os.getenv('BRIDGE_IP', '192.168.10.100')
PORT = int(os.getenv('BRIDGE_PORT', '23'))
WEIGHT_THRESHOLD = int(os.getenv('WEIGHT_THRESHOLD', '1000'))  # kg

# EnviroWorx Cloud live-scale ingest
SCALE_API_URL = os.getenv('SCALE_API_URL', '')
SCALE_API_SECRET = os.getenv('SCALE_API_SECRET', '')
LIVE_POST_INTERVAL = float(os.getenv('LIVE_POST_INTERVAL', '3'))  # seconds between live posts
LIVE_POST_DELTA = float(os.getenv('LIVE_POST_DELTA', '50'))       # or post sooner if weight moves this many kg

# Google Sheets (legacy peak log)
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_CREDS', 'envi3.json')
SPREADSHEET_ID = os.getenv('GOOGLE_SHEET_ID', '1NQIPDNaW4zi7Uzzm38c0RzNI5-wctCPMrXfMDEnv2Yw')
WORKSHEET_NAME = os.getenv('WORKSHEET_NAME', 'Weightbridge logs')
WORKSHEET_NAME_TRANSFER = os.getenv('WORKSHEET_TRANSFER', 'Weight transfer')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('weighbridge.log', encoding='utf-8')
    ]
)
log = logging.getLogger('weighbridge')


# ============================================================================
# APP INGEST
# ============================================================================

def post_reading(weight_kg: float, description: str = 'live') -> bool:
    """POST one reading to the app's /api/scale endpoint."""
    if not SCALE_API_URL or not SCALE_API_SECRET:
        return False
    try:
        req = urllib.request.Request(
            SCALE_API_URL,
            data=json.dumps({'weight_kg': float(weight_kg), 'description': description}).encode(),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {SCALE_API_SECRET}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status == 200
    except Exception as e:
        log.error(f"   ❌ App ingest failed: {e}")
        return False


# ============================================================================
# GOOGLE SHEETS (legacy peak log)
# ============================================================================

def init_google_sheets():
    """Connect to Google Sheets. Returns (sheet, sheet_transfer, has_transfer)."""
    if not HAS_GSPREAD:
        log.warning("  ⚠️  gspread or google-auth not installed — Sheets logging disabled")
        return None, None, False

    log.info("Connecting to Google Sheets...")
    try:
        creds = Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE,
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
        client = gspread.authorize(creds)

        sheet = client.open_by_key(SPREADSHEET_ID).worksheet(WORKSHEET_NAME)
        log.info(f"  ✅ Connected to '{WORKSHEET_NAME}'")

        sheet_transfer = None
        has_transfer = False
        try:
            sheet_transfer = client.open_by_key(SPREADSHEET_ID).worksheet(WORKSHEET_NAME_TRANSFER)
            has_transfer = True
            log.info(f"  ✅ Connected to '{WORKSHEET_NAME_TRANSFER}'")
        except gspread.exceptions.WorksheetNotFound:
            log.info(f"  ⚠️  '{WORKSHEET_NAME_TRANSFER}' tab not found — legacy updates skipped")

        return sheet, sheet_transfer, has_transfer
    except Exception as e:
        log.error(f"  ❌ Google Sheets connection failed: {e}")
        return None, None, False


# ============================================================================
# WEIGHBRIDGE
# ============================================================================

def init_weighbridge():
    """Connect to the Dini Argeo via TCP. Returns socket."""
    log.info(f"Connecting to weighbridge at {IP_ADDRESS}:{PORT}...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(20)
    sock.connect((IP_ADDRESS, PORT))
    log.info("  ✅ Weighbridge connected")
    return sock


def reconnect_weighbridge(sock):
    """Close and reconnect to the weighbridge."""
    try:
        sock.close()
    except Exception:
        pass
    time.sleep(5)
    new_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    new_sock.settimeout(20)
    new_sock.connect((IP_ADDRESS, PORT))
    log.info("  ✅ Reconnected to weighbridge")
    return new_sock


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 50)
    print("  ENVIROWORX WEIGHBRIDGE MONITOR")
    print("  Dini Argeo → EnviroWorx Cloud + Google Sheets")
    print("=" * 50)

    if not SCALE_API_URL or not SCALE_API_SECRET:
        log.warning("⚠️  SCALE_API_URL / SCALE_API_SECRET not set — the office app")
        log.warning("    will NOT get live weights. Set both in .env.")

    sheet, sheet_transfer, has_transfer = init_google_sheets()

    try:
        sock = init_weighbridge()
    except Exception as e:
        log.error(f"❌ Weighbridge connection failed: {e}")
        log.error(f"   Check that {IP_ADDRESS}:{PORT} is reachable on this network.")
        sys.exit(1)

    print("-" * 50)
    log.info("📡 Monitoring for trucks...")

    # --- State ---
    max_weight = 0.0
    truck_on_bridge = False
    last_post_time = 0.0
    last_post_weight = 0.0

    while True:
        try:
            raw_data = sock.recv(1024)

            if not raw_data:
                log.warning("Connection lost. Reconnecting...")
                sock = reconnect_weighbridge(sock)
                continue

            decoded_data = raw_data.decode('ascii', errors='ignore').strip()
            match = re.search(r'[\d.]+', decoded_data)
            if not match:
                continue

            current_weight = float(match.group(0))

            # 1. Truck just arrived
            if current_weight > WEIGHT_THRESHOLD and not truck_on_bridge:
                truck_on_bridge = True
                max_weight = current_weight
                log.info(f"\U0001F69B Truck detected! Weight: {current_weight} kg")
                if post_reading(current_weight):
                    log.info("   📤 Live weight sent to app")
                    last_post_time = time.time()
                    last_post_weight = current_weight

            # 2. Truck still on bridge — stream live weight, track peak
            elif truck_on_bridge:
                if current_weight > max_weight:
                    max_weight = current_weight

                if current_weight > WEIGHT_THRESHOLD:
                    now = time.time()
                    if (now - last_post_time >= LIVE_POST_INTERVAL
                            or abs(current_weight - last_post_weight) >= LIVE_POST_DELTA):
                        if post_reading(current_weight):
                            last_post_time = now
                            last_post_weight = current_weight

                # 3. Truck has left — log the peak
                if current_weight < WEIGHT_THRESHOLD:
                    log.info("-" * 40)
                    log.info(f"✅ Peak weight captured: {max_weight} kg")

                    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

                    if post_reading(max_weight, description='peak'):
                        log.info("   📤 Peak sent to app")

                    if sheet:
                        try:
                            sheet.append_row([timestamp, max_weight])
                            log.info(f"   📋 Logged to '{WORKSHEET_NAME}'")
                        except Exception as e:
                            log.error(f"   ❌ Google Sheets write failed: {e}")

                    if max_weight > 8500 and has_transfer:
                        try:
                            sheet_transfer.update_cell(2, 6, max_weight)
                            log.info(f"   📋 High weight logged to '{WORKSHEET_NAME_TRANSFER}'")
                        except Exception as e:
                            log.error(f"   ❌ Transfer sheet write failed: {e}")

                    truck_on_bridge = False
                    max_weight = 0.0
                    log.info("-" * 40)
                    log.info("📡 Monitoring for new trucks...")

        except KeyboardInterrupt:
            log.info("\nStopped by user.")
            break
        except socket.timeout:
            log.warning("Socket timeout. Reconnecting...")
            try:
                sock = reconnect_weighbridge(sock)
            except Exception:
                log.error("Reconnection failed. Retrying in 10s...")
                time.sleep(10)
        except Exception as e:
            log.error(f"Loop error: {e}")
            time.sleep(5)

    try:
        sock.close()
    except Exception:
        pass
    log.info("Socket closed. Done.")


if __name__ == '__main__':
    main()
