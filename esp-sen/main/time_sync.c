#include "time_sync.h"

#include <time.h>
#include "freertos/FreeRTOS.h"
#include "esp_netif_sntp.h"
#include "esp_log.h"

static const char *TAG = "time_sync";

esp_err_t time_sync_init(void) {
  esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
  esp_netif_sntp_init(&config);

  // wait for the first sync so sensor/event payloads don't report 1970
  esp_err_t err = esp_netif_sntp_sync_wait(pdMS_TO_TICKS(10000));
  if (err != ESP_OK) {
    ESP_LOGW(TAG, "time not synced within 10s");
    return err;
  }

  setenv("TZ", "UTC0", 1);
  tzset();

  ESP_LOGI(TAG, "time synced: %lld", (long long)time(NULL));
  return ESP_OK;
}
