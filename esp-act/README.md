# ESP-ACT

ESP32-S3 actuation node. Drives the artwork protection actuators (adaptive PWM
LED, impact-blink / theft-latch LED) and exposes them over HTTP on port 80 for
the WoT controller.

## Build and flash

Set the WiFi SSID/password in `main/wifi_sta.c` first, then:

```bash
. ~/esp/esp-idf/export.sh
idf.py set-target esp32s3        # first time only
idf.py -p /dev/ttyACM0 flash monitor
```

Or directly use ESP-IDF interface commands.

The monitor logs the acquired IP on boot — use it as `ESP_ACT_HOST` in
`wot-controller/.env`.
