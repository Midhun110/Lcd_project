/*
 ==============================================================================
  PARITY GUARD — 4-Bit XOR Parity Error Detection System
  ESP32 Firmware with Wi-Fi AP & REST API Server (Offline LittleFS Serving)
 ==============================================================================

  Hardware Setup:
  - Switch 1 (D1): GPIO 18 (Input)
  - Switch 2 (D2): GPIO 19 (Input)
  - Switch 3 (D3): GPIO 21 (Input)
  - Switch 4 (D4): GPIO 22 (Input)
  - Switch 5 (Received Parity P_RX): GPIO 25 (Input)
  - Error LED: GPIO 26 (Output, Active HIGH via 330 ohm resistor)
  - 7486 Quad 2-Input XOR IC (Hardware XOR co-processor / verification)

  Operation:
  - Spawns Wi-Fi SoftAP: "ParityGuard" (Pass: "Parity123", IP: 192.168.4.1)
  - Captive Portal DNS server routes all browser requests to 192.168.4.1
  - Serves static dashboard files (index.html, styles.css, app.js) via LittleFS
  - Serves HTTP REST endpoint "/api/status" (JSON with CORS enabled)
 ==============================================================================
*/

#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <DNSServer.h>

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
const char* AP_SSID = "ParityGuard";
const char* AP_PASS = "Parity123"; // WPA2-PSK passphrase

const byte DNS_PORT = 53;
DNSServer dnsServer;
WebServer server(80);

bool littleFsMounted = false;

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

// /api/status -> Returns JSON telemetry with required schema
void handleApiStatus() {
  setCorsHeaders();
  updateSensorsAndLogic();

  String json = "{";
  json += "\"d1\":" + String(d1) + ",";
  json += "\"d2\":" + String(d2) + ",";
  json += "\"d3\":" + String(d3) + ",";
  json += "\"d4\":" + String(d4) + ",";
  json += "\"receivedParity\":" + String(received_parity) + ",";
  json += "\"calculatedParity\":" + String(calculated_parity) + ",";
  json += "\"errorDetected\":" + String(has_error ? "true" : "false") + ",";
  json += "\"errorLED\":" + String(has_error ? "true" : "false") + ",";
  // Backward-compatible aliases
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

// Minimal embedded fallback page if files have not yet been uploaded to LittleFS
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PARITY GUARD - ESP32 Access Point</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #080c16; color: #fff; text-align: center; padding: 40px; margin: 0; }
    h1 { color: #38bdf8; margin-bottom: 8px; }
    .box { background: #0f172a; padding: 28px; border-radius: 12px; display: inline-block; max-width: 540px; border: 1px solid #334155; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: left; }
    a { color: #06b6d4; text-decoration: none; font-weight: bold; }
    code { background: #1e293b; padding: 3px 8px; border-radius: 4px; color: #38bdf8; font-family: monospace; }
    ol { line-height: 1.6; padding-left: 20px; color: #cbd5e1; }
    .badge { display: inline-block; background: #0284c7; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="box">
    <span class="badge">ESP32 ACCESS POINT READY</span>
    <h1>🛡️ PARITY GUARD ONLINE</h1>
    <p style="color: #94a3b8;">ESP32 hardware server is running. Live API status is working at <a href="/api/status"><code>/api/status</code></a>.</p>
    <p><strong>To display the full dashboard directly from this ESP32:</strong></p>
    <ol>
      <li>Place <code>index.html</code>, <code>styles.css</code>, and <code>app.js</code> into a <code>data</code> folder inside the sketch directory.</li>
      <li>In Arduino IDE, run <strong>ESP32 LittleFS Data Upload</strong> (or use <code>arduino-littlefs-upload</code>).</li>
      <li>Refresh this page, and the full interactive laboratory dashboard will load offline!</li>
    </ol>
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

  // Initialize LittleFS filesystem
  if (LittleFS.begin(true)) {
    Serial.println("[FS] LittleFS mounted successfully.");
    littleFsMounted = true;
  } else {
    Serial.println("[FS] Warning: LittleFS mount failed.");
  }

  // Initialize Wi-Fi SoftAP
  Serial.print("Starting Wi-Fi Access Point: ");
  Serial.println(AP_SSID);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  IPAddress myIP = WiFi.softAPIP();
  Serial.print("Access Point IP Address: ");
  Serial.println(myIP);

  // Start Captive Portal DNS server (redirects queries to ESP32 IP)
  dnsServer.start(DNS_PORT, "*", myIP);
  Serial.println("Captive portal DNS server active.");

  // Register WebServer API routes
  server.on("/api/status", HTTP_GET, handleApiStatus);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);

  // LittleFS static web dashboard serving
  if (littleFsMounted && LittleFS.exists("/index.html")) {
    Serial.println("[HTTP] Serving dashboard files directly from LittleFS.");
    server.serveStatic("/", LittleFS, "/index.html");
    server.serveStatic("/index.html", LittleFS, "/index.html");
    server.serveStatic("/styles.css", LittleFS, "/styles.css");
    server.serveStatic("/app.js", LittleFS, "/app.js");
    server.serveStatic("/", LittleFS, "/");
  } else {
    Serial.println("[HTTP] Notice: /index.html not found in LittleFS. Serving fallback page.");
    server.on("/", HTTP_GET, handleRoot);
  }

  // Captive portal fallback / 404 handler
  server.onNotFound([]() {
    if (littleFsMounted && LittleFS.exists(server.uri())) {
      String uri = server.uri();
      String contentType = "text/plain";
      if (uri.endsWith(".html")) contentType = "text/html";
      else if (uri.endsWith(".css")) contentType = "text/css";
      else if (uri.endsWith(".js")) contentType = "application/javascript";
      else if (uri.endsWith(".json")) contentType = "application/json";
      File file = LittleFS.open(uri, "r");
      server.streamFile(file, contentType);
      file.close();
    } else {
      // Redirect unknown requests to root
      server.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/", true);
      server.send(302, "text/plain", "");
    }
  });

  server.begin();
  Serial.println("HTTP Web Server ready on port 80.");
  Serial.println("Ready to monitor physical switches!\n");
}

// ----------------------------------------------------------------------------
// ARDUINO MAIN LOOP
// ----------------------------------------------------------------------------
void loop() {
  dnsServer.processNextRequest();
  server.handleClient();
  updateSensorsAndLogic();
  delay(10); // Yield to keep Wi-Fi and server responsive
}

