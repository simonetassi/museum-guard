#pragma once

#include <stdint.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    FIXED_LED_OFF = 0,
    FIXED_LED_BLINKING,
    FIXED_LED_ON,
} fixed_led_state_t;

typedef struct {
    uint8_t variable_led_intensity;
    fixed_led_state_t fixed_led_state;
} actuator_state_t;

esp_err_t actuator_init(void);

esp_err_t actuator_set_intensity(uint8_t percent); 
esp_err_t actuator_start_blink(void);
esp_err_t actuator_activate_alarm(void);
esp_err_t actuator_reset(void);

void actuator_get_state(actuator_state_t *out);

const char *fixed_led_state_str(fixed_led_state_t state);

#ifdef __cplusplus
}
#endif