#include "esp_log.h"
#include "nvs_flash.h"

#include "wifi_sta.h"
#include "time_sync.h"
#include "actuator.h"
#include "http_server.h"

static const char *TAG = "esp-act";

void app_main(void) {
  // nvs is needed by the wifi driver
  esp_err_t ret = nvs_flash_init();
  if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    ret = nvs_flash_init();
  }
  ESP_ERROR_CHECK(ret);

  ESP_ERROR_CHECK(wifi_init_sta());
  time_sync_init();
  ESP_ERROR_CHECK(actuator_init());
  ESP_ERROR_CHECK(http_server_start());

  ESP_LOGI(TAG, "ESP-ACT ready");
}
