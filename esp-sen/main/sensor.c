#include "sensor.h"

#include <math.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "esp_adc/adc_oneshot.h"
#include "driver/i2c.h"
#include "mpu6050.h"
#include "esp_timer.h"
#include "esp_log.h"

static const char *TAG = "sensor";

#define LIGHT_ADC_UNIT ADC_UNIT_1
#define LIGHT_ADC_CHANNEL ADC_CHANNEL_6
#define LIGHT_ADC_ATTEN ADC_ATTEN_DB_12
#define LIGHT_ADC_MAX_RAW 4095.0f

#define LIGHT_R_FIXED 10000.0f // 10k divider resistor
#define LIGHT_V_REF 3.3f // ADC voltage
#define LIGHT_LUX_K 500000.0f // lux scale factor (lux = K / R_ldr)

#define MPU6050_I2C_PORT I2C_NUM_0
#define MPU6050_SDA_GPIO 21
#define MPU6050_SCL_GPIO 38
#define MPU6050_I2C_FREQ_HZ 400000
#define G_TO_MS2 9.80665f

#define DEFAULT_IMPACT_THRESHOLD 25.0f
#define DEFAULT_THEFT_THRESHOLD 12.0f

#define SAMPLE_PERIOD_MS 50
#define LIGHT_EVERY_N 20 // 20 * 50ms -> read light every 1s
#define IMPACT_COOLDOWN_US (1000 * 1000) // ignore repeat impacts for 1s
#define THEFT_MIN_SAMPLES 5 // vertical deviation must persist 250ms
#define THEFT_COOLDOWN_US (3000 * 1000) // ignore repeat thefts for 3s

typedef struct {
  float lux;
  float ax, ay, az;
  float impact_threshold;
  float theft_threshold;
} sensor_state_t;

static sensor_state_t s_state;
static SemaphoreHandle_t s_state_mutex;
static adc_oneshot_unit_handle_t s_adc;
static mpu6050_handle_t s_mpu;
static QueueHandle_t s_event_queue;

static float raw_to_lux(int raw) {
  float voltage = raw * LIGHT_V_REF / LIGHT_ADC_MAX_RAW;
  // V = V_ref * R_ldr / (R_fixed + R_ldr)  =>  R_ldr = R_fixed * V / (V_ref - V).
  float r_ldr = (voltage < LIGHT_V_REF - 0.01f)
                    ? LIGHT_R_FIXED * voltage / (LIGHT_V_REF - voltage)
                    : 999999.0f;
  return (r_ldr > 0.0f) ? LIGHT_LUX_K / r_ldr : 0.0f;
}

static float read_light_lux(void) {
  int raw = 0;
  esp_err_t err = adc_oneshot_read(s_adc, LIGHT_ADC_CHANNEL, &raw);
  if (err != ESP_OK) {
    ESP_LOGW(TAG, "ADC read failed: %s", esp_err_to_name(err));
    return 0.0f;
  }
  return raw_to_lux(raw);
}

float sensor_get_light(void) {
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  float lux = s_state.lux;
  xSemaphoreGive(s_state_mutex);
  return lux;
}

static esp_err_t i2c_bus_init(void) {
  i2c_config_t conf = {
    .mode             = I2C_MODE_MASTER,
    .sda_io_num       = MPU6050_SDA_GPIO,
    .scl_io_num       = MPU6050_SCL_GPIO,
    .sda_pullup_en    = true,
    .scl_pullup_en    = true,
    .master.clk_speed = MPU6050_I2C_FREQ_HZ,
  };
  esp_err_t err = i2c_param_config(MPU6050_I2C_PORT, &conf);
  if (err != ESP_OK) {
    return err;
  }
  return i2c_driver_install(MPU6050_I2C_PORT, conf.mode, 0, 0, 0);
}

static esp_err_t read_acceleration(acceleration_t *out) {
  mpu6050_acce_value_t acce;
  esp_err_t err = mpu6050_get_acce(s_mpu, &acce);
  if (err != ESP_OK) {
    ESP_LOGW(TAG, "MPU6050 read failed: %s", esp_err_to_name(err));
    return err;
  }

  out->x = acce.acce_x * G_TO_MS2;
  out->y = acce.acce_y * G_TO_MS2;
  out->z = acce.acce_z * G_TO_MS2;
  return ESP_OK;
}

void sensor_get_acceleration(acceleration_t *out) {
  if (out == NULL) return;
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  out->x = s_state.ax;
  out->y = s_state.ay;
  out->z = s_state.az;
  xSemaphoreGive(s_state_mutex);
}

float sensor_get_impact_threshold(void) {
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  float v = s_state.impact_threshold;
  xSemaphoreGive(s_state_mutex);
  return v;
}

void sensor_set_impact_threshold(float value) {
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  s_state.impact_threshold = value;
  xSemaphoreGive(s_state_mutex);
  ESP_LOGI(TAG, "impact threshold set to %.2f m/s^2", value);
}

float sensor_get_theft_threshold(void) {
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  float v = s_state.theft_threshold;
  xSemaphoreGive(s_state_mutex);
  return v;
}

void sensor_set_theft_threshold(float value) {
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  s_state.theft_threshold = value;
  xSemaphoreGive(s_state_mutex);
  ESP_LOGI(TAG, "theft threshold set to %.2f m/s^2", value);
}

QueueHandle_t sensor_event_queue(void) {
  return s_event_queue;
}

static void emit_event(sensor_event_type_t type, float value) {
  sensor_event_t ev = { .type = type, .value = value, .timestamp = time(NULL) };
  if (s_event_queue != NULL) {
    xQueueSend(s_event_queue, &ev, 0);
  }
  ESP_LOGW(TAG, "%s detected: value=%.2f m/s^2",
           type == SENSOR_EVENT_IMPACT ? "Impact" : "Theft", value);
}

static void sensor_task(void *arg) {
  (void)arg;
  acceleration_t acc = { 0 };
  float prev_ax = 0.0f;
  bool have_prev = false;
  int theft_streak = 0;
  int64_t last_impact_us = 0;
  int64_t last_theft_us = 0;
  uint32_t tick = 0;

  for (;;) {
    if (tick % LIGHT_EVERY_N == 0) {
      float lux = read_light_lux();
      xSemaphoreTake(s_state_mutex, portMAX_DELAY);
      s_state.lux = lux;
      xSemaphoreGive(s_state_mutex);
    }

    if (read_acceleration(&acc) == ESP_OK) {
      xSemaphoreTake(s_state_mutex, portMAX_DELAY);
      s_state.ax = acc.x;
      s_state.ay = acc.y;
      s_state.az = acc.z;
      float impact_thr = s_state.impact_threshold;
      float theft_thr = s_state.theft_threshold;
      xSemaphoreGive(s_state_mutex);

      int64_t now = esp_timer_get_time();

      // impact
      if (have_prev) {
        float jerk_x = fabsf(acc.x - prev_ax);
        if (jerk_x >= impact_thr && (now - last_impact_us) > IMPACT_COOLDOWN_US) {
          last_impact_us = now;
          emit_event(SENSOR_EVENT_IMPACT, jerk_x);
        }
      }
      prev_ax = acc.x;
      have_prev = true;

      // theft
      float vdev = fabsf(acc.z - G_TO_MS2);
      if (vdev >= theft_thr) {
        if (++theft_streak >= THEFT_MIN_SAMPLES && (now - last_theft_us) > THEFT_COOLDOWN_US) {
          last_theft_us = now;
          theft_streak = 0;
          emit_event(SENSOR_EVENT_THEFT, vdev);
        }
      } else {
        theft_streak = 0;
      }
    }

    tick++;
    vTaskDelay(pdMS_TO_TICKS(SAMPLE_PERIOD_MS));
  }
}

esp_err_t sensor_init(void) {
  s_state_mutex = xSemaphoreCreateMutex();
  s_event_queue = xQueueCreate(8, sizeof(sensor_event_t));
  if (s_state_mutex == NULL || s_event_queue == NULL) {
    ESP_LOGE(TAG, "Failed to allocate mutex/queue");
    return ESP_ERR_NO_MEM;
  }
  s_state.impact_threshold = DEFAULT_IMPACT_THRESHOLD;
  s_state.theft_threshold = DEFAULT_THEFT_THRESHOLD;

  // ADC
  adc_oneshot_unit_init_cfg_t unit_cfg = { .unit_id = LIGHT_ADC_UNIT };
  ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit_cfg, &s_adc));

  adc_oneshot_chan_cfg_t chan_cfg = {
      .atten    = LIGHT_ADC_ATTEN,
      .bitwidth = ADC_BITWIDTH_DEFAULT,
  };
  ESP_ERROR_CHECK(adc_oneshot_config_channel(s_adc, LIGHT_ADC_CHANNEL, &chan_cfg));

  s_state.lux = read_light_lux();
  ESP_LOGI(TAG, "Ambient light ADC ready (unit%d ch%d) — %.0f lux",
           LIGHT_ADC_UNIT + 1, LIGHT_ADC_CHANNEL, s_state.lux);

  // MPU6050
  ESP_ERROR_CHECK(i2c_bus_init());
  s_mpu = mpu6050_create(MPU6050_I2C_PORT, MPU6050_I2C_ADDRESS);
  if (s_mpu == NULL) {
    ESP_LOGE(TAG, "Failed to create MPU6050 device");
    return ESP_FAIL;
  }
  ESP_ERROR_CHECK(mpu6050_config(s_mpu, ACCE_FS_8G, GYRO_FS_500DPS));  // gyro unused
  ESP_ERROR_CHECK(mpu6050_wake_up(s_mpu));

  acceleration_t a0;
  if (read_acceleration(&a0) == ESP_OK) {
    s_state.ax = a0.x;
    s_state.ay = a0.y;
    s_state.az = a0.z;
  }
  ESP_LOGI(TAG, "MPU6050 ready (I2C%d SDA%d SCL%d addr0x%02x, +/-8g)",
           MPU6050_I2C_PORT, MPU6050_SDA_GPIO, MPU6050_SCL_GPIO, MPU6050_I2C_ADDRESS);

  if (xTaskCreate(sensor_task, "sensor_task", 4096, NULL, 5, NULL) != pdPASS) {
    ESP_LOGE(TAG, "Failed to create sensor task");
    return ESP_FAIL;
  }

  ESP_LOGI(TAG, "Sensors initialized");
  return ESP_OK;
}
