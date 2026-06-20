# Vendored copy of espressif/mpu6050 v1.2.1 (registry component, "as-is, no
# further development"). The upstream CMakeLists requires esp_driver_i2c on
# IDF >= 5.3, but mpu6050.c still uses the legacy I2C API (driver/i2c.h), so it
# fails to build on IDF 5.5. Pinning the requirement to the legacy `driver`
# component (which still ships driver/i2c.h) is the only change from upstream.
idf_component_register(
    SRCS "mpu6050.c"
    INCLUDE_DIRS "include"
    REQUIRES driver
)
