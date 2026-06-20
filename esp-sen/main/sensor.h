#pragma once

#include <stdint.h>
#include <time.h>
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  float x;
  float y;
  float z;
} acceleration_t;

typedef enum {
  SENSOR_EVENT_IMPACT,
  SENSOR_EVENT_THEFT,
} sensor_event_type_t;

typedef struct {
  sensor_event_type_t type;
  float value;
  time_t timestamp;
} sensor_event_t;

esp_err_t sensor_init(void);

float sensor_get_light(void);
void sensor_get_acceleration(acceleration_t *out);

float sensor_get_impact_threshold(void);
void sensor_set_impact_threshold(float value);
float sensor_get_theft_threshold(void);
void sensor_set_theft_threshold(float value);

QueueHandle_t sensor_event_queue(void);

#ifdef __cplusplus
}
#endif
