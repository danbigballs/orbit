# Orbit V2 -- Shopping List

**Date:** 2026-03-28

---

## Prototyping (Breakout Boards + Dev Kits)

For breadboard / protoboard testing before PCB design.

### Core

| Item | Description | Source | ~Price |
|------|-------------|--------|--------|
| ESP32-S3-DevKitC-1 (N8R8) | Dev board with WROOM-1-N8R8 module | Mouser / Digikey / AliExpress | $10-15 |
| SIM7670G Dev Board | Cat-1 LTE + GNSS eval board with SIM slot + antennas | AliExpress / Waveshare | $15-25 |
| Nano SIM card | Pay-as-you-go data SIM (e.g. GiffGaff, Three) | Any UK carrier | Free-$5 |

### Audio

| Item | Description | Source | ~Price |
|------|-------------|--------|--------|
| Adafruit MAX98357A breakout | I2S Class D amp breakout | Adafruit / Pi Hut | $6 |
| Small speaker (8 ohm, 1W) | Rectangular, small form factor, PicoBlade connector | Pi Hut / Adafruit | $2-3 |

### Sensors

| Item | Description | Source | ~Price |
|------|-------------|--------|--------|
| Adafruit LSM303AGR breakout | Accel + mag combo breakout | Adafruit / Pi Hut | $8-10 |
| Adafruit DRV2605L breakout | Haptic driver breakout | Adafruit / Pi Hut | $8 |
| ERM or LRA vibration motor | Small coin/disc motor for haptics | Adafruit / AliExpress | $2-3 |

### LEDs

| Item | Description | Source | ~Price |
|------|-------------|--------|--------|
| Adafruit HT16K33 breakout | LED matrix driver breakout | Adafruit / Pi Hut | $6 |
| White LEDs (through-hole or 3mm) | For breadboard testing (not 0402) | Any | $2-3 |

*Note: 0402 LEDs are too small to breadboard. Use through-hole LEDs to test the HT16K33 driver, then move to 0402 on the PCB.*

### Power

| Item | Description | Source | ~Price |
|------|-------------|--------|--------|
| Adafruit PowerBoost 1000C | MCP73871 + TPS61090 on breakout (same circuit as V2 design) | Adafruit / Pi Hut | $20 |
| 500mAh LiPo battery | JST-PH connector | Adafruit / Pi Hut | $8-10 |
| USB-C breakout board | For testing charging with CC pulldowns | Adafruit / AliExpress | $2-3 |

### Misc

| Item | Description | Source | ~Price |
|------|-------------|--------|--------|
| Breadboard (full size) | For prototyping | Any | $5-8 |
| Jumper wires (M-M, M-F) | Assorted | Any | $3-5 |
| Header pins | For breakout boards | Any | $2 |

### Prototyping Total: ~$100-130

---

## PCB BOM (Bill of Materials)

Components for the custom Orbit V2 PCB. Quantities for 1 board.

### ICs

| Ref | Part | Package | Qty | Source | ~Price |
|-----|------|---------|-----|--------|--------|
| U1 | ESP32-S3-WROOM-1-N8R8 | Module (18x25.5mm) | 1 | Mouser / Digikey / LCSC | $3.50 |
| U2 | SIM7670G | Module (24x24mm) | 1 | AliExpress / LCSC | $8-12 |
| U3 | MAX98357A | TQFN-16 (3x3mm) | 1 | Mouser / Digikey | $1.50 |
| U4 | LSM303AGR | LGA-12 (2x2mm) | 1 | Mouser / Digikey | $2-3 |
| U5 | DRV2605LDGS | DGS-10 (3x3mm) | 1 | Mouser / Digikey | $2 |
| U6 | HT16K33 | SSOP-28 | 1 | Mouser / Digikey / LCSC | $1.50 |
| U7 | MCP73871 | VQFN-20 (4x4mm) | 1 | Mouser / Digikey | $2-3 |
| U8 | TPS61090RSAR | VQFN-16 (4x4mm) | 1 | Mouser / Digikey | $3-4 |
| U9 | 3.3V LDO (TBD -- AP2112K-3.3 or similar) | SOT-23-5 | 1 | Mouser / Digikey | $0.50 |

### Passives

| Ref | Part | Package | Qty | Notes |
|-----|------|---------|-----|-------|
| R_CC1, R_CC2 | 5.1K resistor | 0402 | 2 | USB-C CC pulldowns |
| R_I2C_SDA, R_I2C_SCL | 4.7K resistor | 0402 | 2 | I2C bus pullups |
| R_PROG | 1.0K resistor | 0402 | 1 | MCP73871 charge current (1A) |
| R_FB1, R_FB2 | 1.87M / 200K resistor | 0402 | 2 | TPS61090 feedback divider |
| R_LBI1, R_LBI2 | 1.87M / 340K resistor | 0402 | 2 | TPS61090 LBO threshold |
| R_NRESET | 10K resistor | 0402 | 1 | LSM303AGR reset pullup (if needed) |
| C_various | 0.1uF, 1uF, 10uF, 100uF ceramic/tantalum | 0402/0603/0805 | ~20 | Decoupling throughout |
| L1 | 6.8uH inductor | 5x5mm (e.g. VLC5045) | 1 | TPS61090 boost |
| FB1, FB2 | Ferrite bead | 0402 | 2 | MAX98357A output filter |
| C_SPK1, C_SPK2 | 220pF capacitor | 0402 | 2 | MAX98357A output EMI filter |

### Connectors

| Ref | Part | Qty | Notes |
|-----|------|-----|-------|
| J1 | USB-C receptacle (power only, e.g. GCT USB4135) | 1 | Charging input |
| J2 | JST-PH 2-pin | 1 | LiPo battery connector |
| J3 | Molex PicoBlade 1.25mm 2-pin | 1 | Speaker connector |
| J4 | Nano SIM card holder | 1 | For SIM7670G |
| J5, J6 | U.FL receptacle | 2 | Cellular + GNSS antennas |
| J7 | Haptic motor connector (2-pin) | 1 | For ERM/LRA motor |

### LEDs

| Ref | Part | Package | Qty | Notes |
|-----|------|---------|-----|-------|
| D1-D128 | White LED | 0402 | 128 | Ring layout around circumference |
| D_CHG | Orange LED (optional) | 0402 | 1 | Charging indicator |
| D_DONE | Green LED (optional) | 0402 | 1 | Charge complete indicator |

### Antennas

| Part | Qty | Notes |
|------|-----|-------|
| Cellular patch antenna (U.FL pigtail) | 1 | Small, internal mount |
| GNSS patch antenna (U.FL pigtail) | 1 | Active or passive, internal mount |

### Other

| Part | Qty | Notes |
|------|-----|-------|
| 500mAh LiPo pouch cell | 1 | JST-PH, ~30x40x5mm |
| 8 ohm 1W speaker | 1 | Small rectangular, PicoBlade terminated |
| ERM/LRA vibration motor | 1 | Coin type, for DRV2605L |

### PCB BOM Total: ~$35-50 (components only, excluding PCB fabrication)

---

## PCB Fabrication

| Item | Qty | Source | ~Price |
|------|-----|--------|--------|
| 2-layer PCB, 90mm circular, 1.6mm FR4 | 5 pcs min | JLCPCB / PCBWay | $5-15 |
| Stencil (solder paste) | 1 | JLCPCB / PCBWay | $5-10 |

---

## Summary

| Category | Estimated Cost |
|----------|---------------|
| Prototyping (breakout boards) | $100-130 |
| PCB BOM (per board) | $35-50 |
| PCB fabrication (5 boards + stencil) | $10-25 |
| **Total to get started** | **~$150-200** |
