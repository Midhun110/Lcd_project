# 🛡️ PARITY GUARD — 4-Bit XOR Parity Error Detection System

A modern, responsive, hardware-telemetry web dashboard and ESP32 firmware for a college digital electronics project implementing **4-Bit Even Parity Generation and Error Detection** using exclusive-OR (XOR) logic (7486 IC) and ESP32 microcontroller.

---

## 🌟 Key Highlights & Architecture

- **Hardware Telemetry Dashboard**: Dark navy laboratory aesthetic, glassmorphism cards, glowing status LEDs, and real-time responsiveness.
- **Dual Operational Modes**:
  - 🎮 **Demo & Simulation Mode**: Interactive testing where you can flip virtual DIP switches, inject bit errors, or run automated test vectors without any hardware connected.
  - ⚡ **ESP32 Live Hardware Mode**: Real-time polling (`GET /api/status` at 500ms intervals) where dashboard switches become read-only mirrors of the real physical DIP switches on your breadboard.
- **7486 XOR Gate Cascade Visualization**: Dynamic logic gate tree diagram showing intermediate values ($X_1 = D_1 \oplus D_2$, $X_2 = D_3 \oplus D_4$, $P_{calc} = X_1 \oplus X_2$) with illuminated live signal wires.
- **Hero Error Detection Status**: Unmistakable Pass/Fail notification with animated shield/warning icons, clear mathematical explanations, and bit counts.
- **ESP32 Hardware Error LED Indicator**: High-fidelity visual 5mm red LED showing GPIO 26 state, logic level (3.3V / 0.0V), and driver description.
- **Interactive 16-Row Truth Table**: All $2^4 = 16$ input combinations ($0000$ to $1111$) with an active row highlighter that dynamically tracks your hardware state in real time.
- **Audit Event Log**: Rolling chronological history of every switch flip, test vector, and error event.

---

## 🚀 Quick Start: Running & Previewing the Dashboard Locally

No complicated setup or build tools are needed. The dashboard is pure HTML, CSS, and modern JavaScript.

### Option 1: Direct File Preview
Simply double-click [`index.html`](file:///d:/New%20folder%20%282%29/Lcd_project/index.html) in your file manager to open it in Google Chrome, Microsoft Edge, Firefox, or Safari.

### Option 2: Local HTTP Server (Recommended)
Running through a local web server ensures seamless module and API fetch handling.

**Using Node.js (already installed):**
```bash
npx serve .
# Or:
npx http-server . -p 8080
```
Then open `http://localhost:8080` (or `http://localhost:3000`) in your browser.

**Using Python:**
```bash
python -m http.server 8080
```
Open `http://localhost:8080` in your browser.

---

## 🔌 Hardware Pin Mapping (ESP32)

| Component | ESP32 Pin | Logic Function | Description |
| :--- | :--- | :--- | :--- |
| **Switch 1** | **GPIO 18** | Input ($D_1$) | Data bit 1 (MSB) |
| **Switch 2** | **GPIO 19** | Input ($D_2$) | Data bit 2 |
| **Switch 3** | **GPIO 21** | Input ($D_3$) | Data bit 3 |
| **Switch 4** | **GPIO 22** | Input ($D_4$) | Data bit 4 (LSB) |
| **Switch 5** | **GPIO 25** | Input ($P_{RX}$) | Received Parity bit |
| **Error LED** | **GPIO 26** | Output (Active HIGH) | Red LED (via $330\,\Omega$ resistor) |

### DIP Switch Wiring Options:
- **Active-HIGH (Default in code)**: Connect one side of each switch to `3.3V` and the other side to the respective GPIO pin with a $10\,\text{k}\Omega$ pull-down resistor to GND (or use ESP32 internal `INPUT_PULLDOWN`).
- **Active-LOW**: Connect switch between GPIO and GND, set `#define SWITCHES_ACTIVE_HIGH false` in [`esp32_parity_guard.ino`](file:///d:/New%20folder%20%282%29/Lcd_project/esp32_parity_guard.ino) to use internal `INPUT_PULLUP`.

---

## 📐 Parity & XOR Logic Theory

Even parity requires that the total number of '1' bits across the entire 5-bit transmission frame ($D_1, D_2, D_3, D_4, P$) must be **even**.

$$P_{calc} = D_1 \oplus D_2 \oplus D_3 \oplus D_4$$

$$\text{Error Flag} = P_{calc} \oplus P_{rx}$$

### 7486 Quad 2-Input XOR Implementation:
1. **Gate 1**: $X_1 = D_1 \oplus D_2$
2. **Gate 2**: $X_2 = D_3 \oplus D_4$
3. **Gate 3**: $P_{calc} = X_1 \oplus X_2$
4. **Gate 4 (Comparator)**: $\text{Error} = P_{calc} \oplus P_{rx}$

- If $\text{Error} = 0 \implies P_{calc} == P_{rx}$ (**No Error**, GPIO 26 = LOW).
- If $\text{Error} = 1 \implies P_{calc} \ne P_{rx}$ (**Bit Error Detected**, GPIO 26 = HIGH).

---

## 🌐 ESP32 Wi-Fi & REST API Integration

When ready to connect to the actual ESP32 hardware:

1. Open [`esp32_parity_guard.ino`](file:///d:/New%20folder%20%282%29/Lcd_project/esp32_parity_guard.ino) in the **Arduino IDE**.
2. Select your ESP32 board (`DOIT ESP32 DEVKIT V1` or similar).
3. Connect your ESP32 via USB and click **Upload**.
4. Open the Serial Monitor at **115200 baud**.
5. The ESP32 will start an Access Point:
   - **SSID**: `PARITY_GUARD_AP`
   - **Password**: `12345678`
   - **IP Address**: `192.168.4.1`
6. Connect your laptop or phone to the `PARITY_GUARD_AP` Wi-Fi network.
7. Open the dashboard, switch the mode to **ESP32 Live**, and it will automatically poll `http://192.168.4.1/api/status` every 500ms!

### `/api/status` JSON Response Contract:
```json
{
  "d1": 1,
  "d2": 0,
  "d3": 1,
  "d4": 0,
  "received_parity": 0,
  "calculated_parity": 0,
  "error": false,
  "error_led": false,
  "uptime_ms": 28450
}
```

---

## 📁 Project Structure

```text
Lcd_project/
├── index.html              # Modern, responsive single-page dashboard
├── styles.css              # Dark navy glassmorphism & hardware design system
├── app.js                  # XOR parity logic, gate animations & ESP32 polling
├── esp32_parity_guard.ino  # Production-ready Arduino sketch for ESP32
└── README.md               # Complete project documentation and wiring guide
```

---

*Built with ESP32, 7486 XOR ICs and Arduino IDE for College Digital Electronics Laboratory Projects.*