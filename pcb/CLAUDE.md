# Orbit V2 PCB Design -- Claude Code Workflow

## What This Is
Custom PCB for Orbit V2 internet radio. KiCad 9 project. Claude Code assists with schematic entry, symbol/footprint creation, and BOM management. Human does visual layout, routing, and final review in KiCad GUI.

## Full Hardware Spec
Read the design spec before doing any PCB work:
`~/brain/projects/personal/orbit/docs/superpowers/specs/2026-03-28-orbit-v2-hardware-design.md`

## Component Summary (for quick reference)

| Ref | Part | I2C Addr | Notes |
|-----|------|----------|-------|
| U1 | ESP32-S3-WROOM-1-N8R8 | -- | MCU, 18x25.5mm module |
| U2 | SIM7670G | -- | Cat-1 LTE + GNSS, UART, 24x24mm |
| U3 | MAX98357A | -- | I2S Class D amp |
| U4 | LSM303AGR | 0x19/0x1E | Accel + mag (compass + shake) |
| U5 | DRV2605L | 0x5A | Haptic driver |
| U6 | IS31FL3731 | 0x74 | LED driver, 128 white LEDs, per-LED PWM |
| U7 | MCP73871 | -- | USB-C LiPo charger |
| U8 | TPS61090 | -- | 5V boost converter |
| U9 | AP2112K-3.3 | -- | 3.3V LDO |
| D1-128 | White 0402 LED | -- | Ring layout, charlieplexed via IS31FL3731 |
| D_RGB1-3 | SK6812-MINI-E | -- | RGB indicators, daisy-chained, 1 GPIO |

## KiCad File Structure
```
pcb/
  orbit-v2.kicad_pro        # Project file
  orbit-v2.kicad_sch        # Schematic (main sheet)
  orbit-v2.kicad_pcb        # PCB layout
  libs/
    orbit-v2.kicad_sym      # Custom symbol library
    orbit-v2.kicad_mod/     # Custom footprint library
```

## How Claude Code Helps

### Schematic Entry
- Claude can read and write `.kicad_sch` files directly (S-expression format)
- Add components: write symbol instances with correct pin assignments and values
- Wire nets: add wire segments and labels for I2C, I2S, UART, power rails
- After Claude edits, human reloads in KiCad (File > Revert or reopen)

### Symbol + Footprint Creation
- Claude can create `.kicad_sym` symbol files from datasheets
- Claude can create `.kicad_mod` footprint files with pad geometry
- Check KiCad's built-in libraries first before creating custom ones

### What Claude Should NOT Do
- Don't attempt PCB component placement (spatial/visual task)
- Don't attempt copper routing (spatial/visual task)
- Don't modify files while human has unsaved changes in KiCad

## Workflow
1. Human opens KiCad project
2. Human asks Claude to add/wire components via terminal
3. Claude edits `.kicad_sch` file
4. Human reloads in KiCad, reviews, adjusts layout
5. Human runs ERC, tells Claude about errors
6. Claude fixes, human reloads
7. Repeat until schematic is complete
8. Human does PCB layout and routing in KiCad GUI

## Reference Designs
- Karri V3.2 KiCad source: `~/projects/personal/import/Pentagram Karri V3.2 PCB Design EXPORT/`
- Adafruit Eagle libraries: `~/projects/personal/import/Adafruit-Eagle-Library-master/`
- Adafruit breakout schematics: `~/projects/personal/import/Schematics & Board Downloads/`

## Rules
- Always check KiCad built-in symbol/footprint libraries before creating custom
- Use KiCad 9 file format (version 20250114)
- Keep schematic readable -- group by subsystem (power, audio, sensors, MCU, cellular, LEDs)
- Name nets clearly: VCC_3V3, VCC_5V, VBAT, GND, I2C_SDA, I2C_SCL, etc.
- Commit after each major schematic milestone
