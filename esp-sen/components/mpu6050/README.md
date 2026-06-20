# mpu6050 (vendored)

Local copy of the official **espressif/mpu6050** registry component, v1.2.1
(source `mpu6050.c` / `include/mpu6050.h` unchanged from upstream).

## Why it is vendored

Upstream v1.2.1 is published "as-is, with no further development" and does not
build on ESP-IDF 5.5: its `CMakeLists.txt` requires the new `esp_driver_i2c`
component on IDF >= 5.3, but the source still uses the **legacy** I2C API
(`#include "driver/i2c.h"`, `i2c_cmd_link_create`, `mpu6050_create(i2c_port_t, ...)`).
On IDF 5.5 the new-driver requirement leaves `driver/i2c.h` off the include path
and the component fails to compile.

The only change here vs. upstream is in `CMakeLists.txt`: the component now
requires the legacy `driver` component (which still ships `driver/i2c.h` in
IDF 5.5) instead of `esp_driver_i2c`.