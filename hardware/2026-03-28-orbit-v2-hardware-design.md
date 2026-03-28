# Orbit V2 -- Hardware Design Specification

**Date:** 2026-03-28
**Author:** Dan Patterson + Claude
**Status:** Draft

---

## 1. Overview

Orbit V2 consolidates the original Orbit V1 prototype (Raspberry Pi Zero + Adafruit breakout boards) into a single custom PCB. The device is a standalone internet radio tuned by physical rotation -- GPS finds nearby stations, a magnetometer maps compass heading to station segments, and an accelerometer detects shake-to-shuffle. Audio streams over cellular data, decoded on-device, and plays through a built-in speaker.

### Design Goals
- Standalone device with cellular connectivity (no WiFi dependency)
- Support all station codecs: MP3, AAC, AAC+, HLS, OGG (1032 UK stations)
- Instant station switching via pre-buffered streams (up to 6 simultaneous)
- Circular pebble form factor, 90mm diameter, 30-40mm thick
- 1.5-2 hour battery life from 500mAh LiPo

---

## 2. System Architecture

### Block Diagram

```
USB-C (5V) --> MCP73871 Charger --> 500mAh LiPo
                                       |
                    +------------------+------------------+
                    |                                     |
              TPS61090 Boost (5V)                   3.3V LDO
                    |                                     |
              HT16K33 + 128 LEDs                   ESP32-S3-WROOM-1-N8R8
                                                         |
                              +--------+--------+--------+--------+
                              |        |        |        |        |
                           I2S out   I2C bus   UART    RMT/GPIO  WiFi/BLE
                              |        |        |        |        (PCB ant)
                        MAX98357A    LSM303AGR  SIM7670G  (spare)
                              |      DRV2605L     |
                           Speaker   HT16K33    Nano SIM
                                               U.FL ant x2
                                            (cellular + GNSS)
```

### Core Architecture
- **Core 0:** HTTP/cellular stream management, sensor polling, LED updates, haptics, FreeRTOS tasks
- **Core 1:** Dedicated audio decode (MP3/AAC/AAC+ via esp-adf, libhelix, libfdk-aac)
- **PSRAM:** Stream ring buffers (up to 6 x 128kbps x 30s = ~2.9MB), well within 8MB

---

## 3. Component Selection

### 3.1 MCU -- ESP32-S3-WROOM-1-N8R8

| Parameter | Value |
|-----------|-------|
| CPU | Dual-core Xtensa LX7, 240 MHz |
| Flash | 8 MB |
| PSRAM | 8 MB Octal SPI |
| Internal SRAM | 512 KB |
| I2S | 2 peripherals |
| I2C | 2 peripherals |
| UART | 3 peripherals |
| WiFi | 802.11 b/g/n 2.4 GHz |
| Bluetooth | BLE 5.0 |
| GPIO | 31+ usable (5 consumed by Octal PSRAM) |
| Module size | 18 x 25.5 x 3.2 mm |
| Antenna | PCB trace (WiFi/BLE) |
| Price | ~$3.50 qty 1 |

**Rationale:** Only ESP32 variant with dual cores + PSRAM + native I2S capable of real-time audio decode. The N8R8 is the standard variant for audio projects, best stocked across distributors. 8MB Octal PSRAM provides bandwidth for concurrent flash reads + decode + stream buffering.

### 3.2 Cellular -- SIM7670G

| Parameter | Value |
|-----------|-------|
| Category | LTE Cat-1 |
| Download | Up to 10 Mbps |
| GNSS | GPS + GLONASS + BeiDou |
| Interface | UART (AT commands) |
| Module size | 24 x 24 mm |
| Peak current | ~1A (transmit bursts) |
| Avg current (streaming) | ~100 mA |
| SIM | Nano SIM slot on PCB |
| Antenna | U.FL connectors (cellular + GNSS) |
| Price | ~$8-12 qty 1 |

**Rationale:** Cat-1 provides sufficient bandwidth for 6 simultaneous audio streams (~768 kbps). Built-in GNSS eliminates need for separate GPS module. Supported by ESP-IDF `esp_modem` component. Nano SIM keeps prototyping simple; eSIM is a future product decision.

### 3.3 Audio -- MAX98357A + Speaker

| Parameter | Value |
|-----------|-------|
| Amp IC | MAX98357A (I2S Class D mono) |
| Output power | 1.8W @ 8 ohm |
| I2S pins | DIN, BCLK, LRCLK |
| SD_MODE | GPIO controlled (shutdown when idle) |
| GAIN | Floating = 9 dB (default) |
| Speaker | 8 ohm, 1W, small rectangular form factor |
| Connector | Molex PicoBlade 1.25mm 2-pin |
| Price (amp) | ~$1.50 qty 1 |

**Rationale:** Proven on Karri V3.2 and Orbit V1. ESP32-S3 has native I2S. SD_MODE GPIO allows power-down when idle to save battery.

### 3.4 IMU -- LSM303AGR

| Parameter | Value |
|-----------|-------|
| Sensors | 3-axis accelerometer + 3-axis magnetometer |
| Interface | I2C (accel 0x19, mag 0x1E) |
| Supply | 1.71-3.6V |
| Current | ~0.5 mA |
| Package | LGA-12 (2x2mm) |
| Price | ~$2-3 qty 1 |

**Rationale:** Replaces BNO055 ($10-15, 12mA). Single chip provides compass heading (magnetometer) and shake detection (accelerometer). Tilt-compensated heading calculation is ~20 lines of code on the ESP32. Massive power savings on a 500mAh battery.

### 3.5 Haptics -- DRV2605L

| Parameter | Value |
|-----------|-------|
| IC | TI DRV2605LDGS |
| Interface | I2C (fixed 0x5A) |
| Waveforms | 123 built-in effects |
| Motor support | ERM and LRA |
| Supply | 2.5-5.5V |
| Circuit | IC + 1uF VDD + 1uF VREG |
| Price | ~$2 qty 1 |

**Rationale:** Carries over from V1. Minimal circuit, works at 3.3V, shares I2C bus.

### 3.6 LEDs -- 128x White 0402 + HT16K33

| Parameter | Value |
|-----------|-------|
| LEDs | 128x white 0402 (1.0 x 0.5 mm) |
| Layout | Circular ring around PCB circumference |
| Driver | HT16K33 (SSOP-24) |
| Interface | I2C (0x70) |
| Supply | 5V (from TPS61090 boost) |
| Dimming | 16-step PWM per LED |
| Matrix | 16 rows x 8 columns |
| Price (driver) | ~$1.50 qty 1 |
| Price (LEDs) | ~$1.50 for 128 pcs |

**Rationale:** Replaces WS2812B NeoPixel rings. No level shifting, no timing-critical protocol, I2C control on existing bus. Same approach proven on Karri V3.2 (243 LEDs, 4x HT16K33). One driver handles all 128 LEDs.

### 3.7 Power

#### Battery
- 500 mAh LiPo pouch cell (single cell, 3.7V nominal)
- ~30 x 40 x 5 mm typical footprint
- JST-PH 2-pin connector

#### Charger -- MCP73871
- USB-C input with **5.1K pulldown resistors on CC1 and CC2** (fixes V1/Karri issue)
- Charge current: 1000 mA (PROG1 resistor = 1.0K)
- Load sharing: device runs from USB when plugged in, battery when not
- Status outputs: STAT1 (charging), STAT2 (done) -- optional LEDs or ESP32 GPIO

#### 5V Boost -- TPS61090
- Input: VBAT (3.0-4.2V from LiPo)
- Output: 5.0V
- Max output current: 2A (load is <500 mA -- HT16K33 + LEDs only)
- Inductor: 6.8uH, 2A rated
- LBO threshold: ~3.2V (via resistor divider on LBI pin, signal to ESP32 GPIO)

#### 3.3V LDO
- Input: VBAT
- Output: 3.3V for ESP32, LSM303AGR, DRV2605L, MAX98357A
- TBD: Select LDO with sufficient current (ESP32 peaks ~500mA with radio active)
- Candidates: AP2112K-3.3 (600mA), RT9080-33 (600mA), or AMS1117-3.3 (1A)

#### Power Budget

| Subsystem | Avg current | Rail |
|-----------|------------|------|
| ESP32-S3 (active, WiFi off) | ~80 mA | 3.3V |
| SIM7670G (streaming) | ~100 mA | 3.3V/VBAT (check module spec) |
| MAX98357A + speaker | ~50-100 mA | 5V |
| HT16K33 + 128 LEDs | ~20-40 mA | 5V |
| LSM303AGR | ~0.5 mA | 3.3V |
| DRV2605L (idle) | ~5 mA | 3.3V |
| Boost converter overhead | ~10-20 mA | -- |
| **Total from battery** | **~270-340 mA** | |

**Estimated runtime:** 500 mAh / 300 mA = ~1.7 hours typical

---

## 4. I2C Bus Map

| Device | Address | Notes |
|--------|---------|-------|
| LSM303AGR (accel) | 0x19 | |
| LSM303AGR (mag) | 0x1E | |
| DRV2605L | 0x5A | Fixed, not configurable |
| HT16K33 | 0x70 | A0=0, A1=0 |

No address conflicts. Single I2C bus, 4.7K pullups to 3.3V.

---

## 5. GPIO Pin Assignment (Preliminary)

| Function | Pins | Peripheral |
|----------|------|-----------|
| I2S BCLK | GPIO x | I2S0 |
| I2S LRCLK | GPIO x | I2S0 |
| I2S DOUT | GPIO x | I2S0 |
| I2C SDA | GPIO x | I2C0 |
| I2C SCL | GPIO x | I2C0 |
| UART TX (to SIM7670G) | GPIO x | UART1 |
| UART RX (from SIM7670G) | GPIO x | UART1 |
| SD_MODE (amp shutdown) | GPIO x | Digital out |
| LBO (low battery) | GPIO x | Digital in |
| SIM7670G PWRKEY | GPIO x | Digital out |
| Spare | ~20 remaining | |

Pin numbers TBD during schematic capture. ESP32-S3 has flexible pin mapping (GPIO matrix).

---

## 6. Firmware Architecture (High Level)

- **Framework:** ESP-IDF + esp-adf (Espressif Audio Development Framework)
- **Audio pipeline:** esp-adf HTTP stream -> ring buffer (PSRAM) -> decoder element -> I2S output
- **Decoders:** libhelix-mp3, libfdk-aac (AAC-LC + HE-AAC/AAC+), esp-adf HLS parser
- **Multi-stream buffering:** Up to 6 concurrent HTTP connections, each writing to a separate ring buffer in PSRAM. Active station's buffer feeds the decoder; switch is instant (swap buffer pointer).
- **Sensor loop (Core 0):** Poll LSM303AGR at ~50 Hz, compute tilt-compensated heading, map heading to station segment, detect shake gesture from accelerometer threshold.
- **LED update (Core 0):** Write HT16K33 display buffer over I2C at ~30 Hz.
- **Cellular management (Core 0):** AT command interface via UART to SIM7670G. HTTP client runs over PPP or AT+HTTP commands.

---

## 7. Physical Design Notes

- 90 mm diameter circular PCB (or circular PCB inside circular enclosure)
- 30-40 mm total thickness (PCB + battery + speaker + enclosure walls)
- Component stack: enclosure base -> battery -> PCB -> speaker -> enclosure top
- 128 LEDs around circumference of PCB (visible through enclosure edge or top ring)
- U.FL pigtails routed to small patch antennas (cellular + GNSS) inside enclosure
- USB-C connector on edge for charging
- Nano SIM slot accessible (tray or slot in enclosure)
- No physical buttons in V2 (all interaction via tilt/rotate/shake) -- TBD

---

## 8. Design Fixes from V1/Karri

1. USB-C CC1/CC2 5.1K pulldowns (chargers now provide power reliably)
2. 3.3V LDO on board (V1 relied on Pi, Karri relied on Pi)
3. No 5V pull-ups on 3.3V GPIO lines
4. External pull-ups on any switch/sensor inputs
5. MAX98357A exposed pad connected to GND
6. Proper decoupling on all ICs
7. TVS diode or fuse on USB-C input (input protection)
8. Real thermistor on MCP73871 or proper thermal management

---

## 9. Open Items

- [ ] Exact LDO selection (need 600mA+ at 3.3V from VBAT)
- [ ] SIM7670G power rail -- confirm if it runs from 3.3V or needs VBAT direct
- [ ] Haptic motor selection (ERM vs LRA, form factor)
- [ ] Speaker final selection (rectangular, fits 90mm enclosure)
- [ ] LED ring layout geometry (128 LEDs at 90mm diameter = ~2.2mm pitch)
- [ ] Pin assignment during schematic capture
- [ ] Enclosure design (3D printed prototype)
- [ ] Antenna selection (cellular + GNSS patch antennas, size constraints)
