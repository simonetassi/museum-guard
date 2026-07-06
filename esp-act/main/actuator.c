#include "actuator.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "driver/gpio.h"
#include "driver/ledc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <stdbool.h>

static const char *TAG = "actuator";

#define PWM_LED_GPIO 5
#define FIXED_LED_GPIO 6

#define PWM_TIMER LEDC_TIMER_0
#define PWM_MODE LEDC_LOW_SPEED_MODE
#define PWM_CHANNEL LEDC_CHANNEL_0
#define PWM_RESOLUTION LEDC_TIMER_13_BIT
#define PWM_FREQ_HZ 5000
#define PWM_DUTY_MAX ((1 << 13) - 1)

#define BLINK_PERIOD_MS 250
#define BLINK_DURATION_MS 20000

typedef enum {
  CMD_SET_INTENSITY,
  CMD_START_BLINK,
  CMD_ACTIVATE_ALARM,
  CMD_RESET,
} cmd_type_t;

typedef struct {
  cmd_type_t type;
  uint8_t intensity;
} actuator_cmd_t;

static QueueHandle_t s_cmd_queue;
static SemaphoreHandle_t s_state_mutex;
static actuator_state_t s_state;

// PWM LED
static void configure_pwm_led(void) {
  ledc_timer_config_t timer_config = {
    .speed_mode = PWM_MODE,
    .timer_num = PWM_TIMER,
    .duty_resolution = PWM_RESOLUTION,
    .freq_hz = PWM_FREQ_HZ,
    .clk_cfg = LEDC_AUTO_CLK,
  };
  ESP_ERROR_CHECK(ledc_timer_config(&timer_config));

  ledc_channel_config_t channel_config = {
    .speed_mode = PWM_MODE,
    .channel = PWM_CHANNEL,
    .timer_sel = PWM_TIMER,
    .intr_type = LEDC_INTR_DISABLE,
    .gpio_num = PWM_LED_GPIO,
    .duty = 0,
    .hpoint = 0,
  };
  ESP_ERROR_CHECK(ledc_channel_config(&channel_config));
}

static void apply_intensity(uint8_t percent) {
  if (percent > 100) {
      percent = 100;
  }
  uint32_t duty = (uint32_t)PWM_DUTY_MAX * percent / 100;
  ESP_ERROR_CHECK(ledc_set_duty(PWM_MODE, PWM_CHANNEL, duty));
  ESP_ERROR_CHECK(ledc_update_duty(PWM_MODE, PWM_CHANNEL));
  ESP_LOGI(TAG, "PWM LED (GPIO%d) intensity -> %u%% (duty %lu)",
           PWM_LED_GPIO, percent, (unsigned long)duty);
}

// FIXED LED
static void configure_fixed_led(void) {
  gpio_reset_pin(FIXED_LED_GPIO);
  gpio_set_direction(FIXED_LED_GPIO, GPIO_MODE_OUTPUT);
  gpio_set_level(FIXED_LED_GPIO, 0);
}

static void set_fixed_led(uint8_t on) {
  gpio_set_level(FIXED_LED_GPIO, on ? 1 : 0);
}

// PUBLISH STATE
static void publish_intensity(uint8_t percent) {
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  s_state.variable_led_intensity = percent;
  xSemaphoreGive(s_state_mutex);
}

static void publish_fixed_state(fixed_led_state_t state) {
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  s_state.fixed_led_state = state;
  xSemaphoreGive(s_state_mutex);
}

// RTOS TASK
static void control_task(void *arg) {
  actuator_cmd_t cmd;
  bool blinking = false;
  bool theft_latched = false;
  bool led_level =  false;
  int64_t blink_deadline_us = 0;

  for(;;) {
    TickType_t wait = blinking ? pdMS_TO_TICKS(BLINK_PERIOD_MS) : portMAX_DELAY;  
    if (xQueueReceive(s_cmd_queue, &cmd, wait) == pdTRUE) {
      switch (cmd.type) {
        case CMD_SET_INTENSITY:
          apply_intensity(cmd.intensity);
          publish_intensity(cmd.intensity);
          break;

        case CMD_START_BLINK:
          if (theft_latched) {
            break;
          }
          blinking = true;
          led_level = true;
          blink_deadline_us = esp_timer_get_time() + (int64_t)BLINK_DURATION_MS * 1000;
          set_fixed_led(true);
          publish_fixed_state(FIXED_LED_BLINKING);
          ESP_LOGW(TAG, "Impact: blinking fixed LED for %d ms", BLINK_DURATION_MS);
          break;

        case CMD_ACTIVATE_ALARM:
          blinking = false;
          theft_latched = true;
          set_fixed_led(true);
          publish_fixed_state(FIXED_LED_ON);
          ESP_LOGW(TAG, "Theft: fixed LED ON");
          break;

        case CMD_RESET:
          blinking = false;
          theft_latched = false;
          set_fixed_led(false);
          publish_fixed_state(FIXED_LED_OFF);
          ESP_LOGI(TAG, "Alarms reset: fixed LED OFF");
          break;
      }
      continue;
    }

    if (blinking) {
      if (esp_timer_get_time() >= blink_deadline_us) {
        blinking = false;
        set_fixed_led(false);
        publish_fixed_state(FIXED_LED_OFF);
        ESP_LOGI(TAG, "Impact blink finished: fixed LED OFF");
      } else {
        led_level = !led_level;
        set_fixed_led(led_level);
      }
    }
  }
}

// PUBLIC FUNCTIONS

esp_err_t actuator_init(void) {
  configure_pwm_led();
  configure_fixed_led();

  s_state.variable_led_intensity = 0;
  s_state.fixed_led_state = FIXED_LED_OFF;

  s_state_mutex = xSemaphoreCreateMutex();
  s_cmd_queue = xQueueCreate(8, sizeof(actuator_cmd_t));
  if (s_state_mutex == NULL || s_cmd_queue == NULL) {
    ESP_LOGE(TAG, "Failed to allocate mutex/queue");
    return ESP_ERR_NO_MEM;
  }

  if (xTaskCreate(control_task, "actuator_control", 3072, NULL, 5, NULL) != pdPASS) {
    ESP_LOGE(TAG, "Failed to create control task");
    return ESP_FAIL;
  }

  ESP_LOGI(TAG, "Actuator initialized (PWM GPIO%d, fixed GPIO%d)", PWM_LED_GPIO, FIXED_LED_GPIO);
  return ESP_OK;
}

static esp_err_t submit(const actuator_cmd_t *cmd) {
  if (s_cmd_queue == NULL) {
    return ESP_ERR_INVALID_STATE;
  }
  return xQueueSend(s_cmd_queue, cmd, pdMS_TO_TICKS(100)) == pdTRUE ? ESP_OK : ESP_FAIL;
}

esp_err_t actuator_set_intensity(uint8_t percent) {
  if (percent > 100) {
    return ESP_ERR_INVALID_ARG;
  }
  actuator_cmd_t cmd = { .type = CMD_SET_INTENSITY, .intensity = percent };
  return submit(&cmd);
}

esp_err_t actuator_start_blink(void) {
  actuator_cmd_t cmd = { .type = CMD_START_BLINK };
  return submit(&cmd);
}

esp_err_t actuator_activate_alarm(void) {
  actuator_cmd_t cmd = { .type = CMD_ACTIVATE_ALARM };
  return submit(&cmd);
}

esp_err_t actuator_reset(void) {
  actuator_cmd_t cmd = { .type = CMD_RESET };
  return submit(&cmd);
}

void actuator_get_state(actuator_state_t *out) {
  if (out == NULL) {
    return;
  }
  xSemaphoreTake(s_state_mutex, portMAX_DELAY);
  *out = s_state;
  xSemaphoreGive(s_state_mutex);
}

const char *fixed_led_state_str(fixed_led_state_t state) {
  switch (state) {
    case FIXED_LED_BLINKING: return "blinking";
    case FIXED_LED_ON: return "on";
    case FIXED_LED_OFF:
    default: return "off";
  }
}