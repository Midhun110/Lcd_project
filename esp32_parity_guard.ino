/*
 ==============================================================================
  PARITY GUARD — 4-Bit XOR Parity Error Detection System
  ESP32 Firmware with Wi-Fi AP & REST API Server
 ==============================================================================

  Hardware Setup:
  - Switch 1 (D1): GPIO 18 (Input)
  - Switch 2 (D2): GPIO 19 (Input)
  - Switch 3 (D3): GPIO 21 (Input)
  - Switch 4 (D4): GPIO 22 (Input)
  - Switch 5 (Received Parity P_RX): GPIO 25 (Input)
  - Error LED: GPIO 26 (Output, Active HIGH via 330 ohm resistor)
  - 7486 Quad 2-Input XOR IC (Optional hardware XOR co-processor or verification)

  Operation:
  - Spawns Wi-Fi SoftAP: "PARITY_GUARD_AP" (Pass: "12345678", IP: 192.168.4.1)
  - Serves HTTP REST endpoint "/api/status" (JSON with CORS enabled)
  - Serves complete web dashboard directly on http://192.168.4.1/
 ==============================================================================
*/

#include <WiFi.h>
#include <WebServer.h>

// ----------------------------------------------------------------------------
// PIN ASSIGNMENTS
// ----------------------------------------------------------------------------
#define PIN_D1           18  // Switch 1: Data bit 1
#define PIN_D2           19  // Switch 2: Data bit 2
#define PIN_D3           21  // Switch 3: Data bit 3
#define PIN_D4           22  // Switch 4: Data bit 4
#define PIN_PRX          25  // Switch 5: Received parity bit
#define PIN_LED_ERROR    26  // ESP32 Error indicator LED

// Set to true if physical switches pull pins HIGH (3.3V) when ON (with pull-down resistors)
// Set to false if physical switches pull pins LOW (GND) when ON (with internal pull-up resistors)
#define SWITCHES_ACTIVE_HIGH true

// ----------------------------------------------------------------------------
// WI-FI & WEB SERVER CONFIGURATION
// ----------------------------------------------------------------------------
const char* AP_SSID = "PARITY_GUARD_AP";
const char* AP_PASS = "12345678"; // Min 8 chars, or set to "" for open network

WebServer server(80);

// Global State
volatile int d1 = 0;
volatile int d2 = 0;
volatile int d3 = 0;
volatile int d4 = 0;
volatile int received_parity = 0;
volatile int calculated_parity = 0;
volatile bool has_error = false;

// ----------------------------------------------------------------------------
// HARDWARE READ & LOGIC COMPUTATION
// ----------------------------------------------------------------------------
void updateSensorsAndLogic() {
  // Read inputs from physical DIP switches
  #if SWITCHES_ACTIVE_HIGH
    d1 = digitalRead(PIN_D1) == HIGH ? 1 : 0;
    d2 = digitalRead(PIN_D2) == HIGH ? 1 : 0;
    d3 = digitalRead(PIN_D3) == HIGH ? 1 : 0;
    d4 = digitalRead(PIN_D4) == HIGH ? 1 : 0;
    received_parity = digitalRead(PIN_PRX) == HIGH ? 1 : 0;
  #else
    // Active low (using internal pullups)
    d1 = digitalRead(PIN_D1) == LOW ? 1 : 0;
    d2 = digitalRead(PIN_D2) == LOW ? 1 : 0;
    d3 = digitalRead(PIN_D3) == LOW ? 1 : 0;
    d4 = digitalRead(PIN_D4) == LOW ? 1 : 0;
    received_parity = digitalRead(PIN_PRX) == LOW ? 1 : 0;
  #endif

  // Parity computation: P_calc = D1 ^ D2 ^ D3 ^ D4 (Even Parity Generator)
  int x1 = d1 ^ d2;
  int x2 = d3 ^ d4;
  calculated_parity = x1 ^ x2;

  // Comparator check: Error if calculated parity does not match received parity
  has_error = (calculated_parity != received_parity);

  // Drive Hardware Error LED (GPIO 26)
  digitalWrite(PIN_LED_ERROR, has_error ? HIGH : LOW);
}

// ----------------------------------------------------------------------------
// HTTP HANDLERS
// ----------------------------------------------------------------------------

// Enable Cross-Origin Resource Sharing (CORS) for external browser testing
void setCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// /api/status -> Returns JSON telemetry
void handleApiStatus() {
  setCorsHeaders();
  updateSensorsAndLogic();

  String json = "{";
  json += "\"d1\":" + String(d1) + ",";
  json += "\"d2\":" + String(d2) + ",";
  json += "\"d3\":" + String(d3) + ",";
  json += "\"d4\":" + String(d4) + ",";
  json += "\"received_parity\":" + String(received_parity) + ",";
  json += "\"calculated_parity\":" + String(calculated_parity) + ",";
  json += "\"error\":" + String(has_error ? "true" : "false") + ",";
  json += "\"error_led\":" + String(has_error ? "true" : "false") + ",";
  json += "\"uptime_ms\":" + String(millis());
  json += "}";

  server.send(200, "application/json", json);
}

// Handle CORS OPTIONS pre-flight
void handleOptions() {
  setCorsHeaders();
  server.send(204);
}

// Minimal embedded fallback page if files are not in SPIFFS
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PARITY GUARD - ESP32 Access Point</title>
  <style>
    body { font-family: sans-serif; background: #080c16; color: #fff; text-align: center; padding: 40px; }
    h1 { color: #38bdf8; }
    .box { background: #0f172a; padding: 20px; border-radius: 12px; display: inline-block; max-width: 500px; border: 1px solid #334155; }
    a { color: #06b6d4; text-decoration: none; font-weight: bold; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="box">
    <h1>🛡️ PARITY GUARD ONLINE</h1>
    <p>ESP32 hardware server is running.</p>
    <p>API Endpoint: <a href="/api/status"><code>/api/status</code></a></p>
    <p>Upload <code>index.html</code>, <code>styles.css</code>, and <code>app.js</code> via LittleFS / SPIFFS, or open your local dashboard and point the endpoint to <code>http://192.168.4.1/api/status</code>.</p>
  </div>
</body>
</html>
)rawliteral";

void handleRoot() {
  server.send(200, "text/html", INDEX_HTML);
}

// ----------------------------------------------------------------------------
// ARDUINO SETUP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n==================================================");
  Serial.println("  PARITY GUARD — 4-Bit XOR Parity Error Detection");
  Serial.println("==================================================");

  // Configure switch inputs
  #if SWITCHES_ACTIVE_HIGH
    pinMode(PIN_D1, INPUT_PULLDOWN);
    pinMode(PIN_D2, INPUT_PULLDOWN);
    pinMode(PIN_D3, INPUT_PULLDOWN);
    pinMode(PIN_D4, INPUT_PULLDOWN);
    pinMode(PIN_PRX, INPUT_PULLDOWN);
  #else
    pinMode(PIN_D1, INPUT_PULLUP);
    pinMode(PIN_D2, INPUT_PULLUP);
    pinMode(PIN_D3, INPUT_PULLUP);
    pinMode(PIN_D4, INPUT_PULLUP);
    pinMode(PIN_PRX, INPUT_PULLUP);
  #endif

  // Configure Error LED Output
  pinMode(PIN_LED_ERROR, OUTPUT);
  digitalWrite(PIN_LED_ERROR, LOW);

  // Initialize Wi-Fi SoftAP
  Serial.print("Starting Wi-Fi Access Point: ");
  Serial.println(AP_SSID);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  IPAddress myIP = WiFi.softAPIP();
  Serial.print("Access Point IP Address: ");
  Serial.println(myIP);

  // Register WebServer routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);

  server.begin();
  Serial.println("HTTP Web Server ready on port 80.");
  Serial.println("Ready to monitor physical switches!\n");
}

// ----------------------------------------------------------------------------
// ARDUINO MAIN LOOP
// ----------------------------------------------------------------------------
void loop() {
  server.handleClient();
  updateSensorsAndLogic();
  delay(10); // Yield to keep Wi-Fi stack responsive
}
