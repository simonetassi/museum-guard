#include "http_server.h"

#include <string.h>
#include <time.h>
#include "esp_http_server.h"
#include "esp_log.h"
#include "cJSON.h"
#include "actuator.h"

static const char *TAG = "http_server";

#define MAX_BODY_LEN 128

static int read_body(httpd_req_t *req, char *buf, size_t buf_size) {
  if (req->content_len >= buf_size) {
    return -1;
  }
  int received = 0;
  while (received < req->content_len) {
    int r = httpd_req_recv(req, buf + received, req->content_len - received);
    if (r <= 0) {
      return -1;
    }
    received += r;
  }
  buf[received] = '\0';
  return received;
}

/* GET /actuator/state */
static esp_err_t get_state_handler(httpd_req_t *req) {
  actuator_state_t st; 
  actuator_get_state(&st);
  
  cJSON *root = cJSON_CreateObject();
  cJSON_AddNumberToObject(root, "variableLedIntensity", st.variable_led_intensity);
  cJSON_AddStringToObject(root, "fixedLedState", fixed_led_state_str(st.fixed_led_state));
  
  char ts[32];
  time_t now = time(NULL);
  struct tm tm; 
  gmtime_r(&now, &tm);
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", &tm);
  cJSON_AddStringToObject(root, "timestamp", ts);

  char *json = cJSON_PrintUnformatted(root);
  httpd_resp_set_type(req, "application/json");
  httpd_resp_sendstr(req, json);
  
  cJSON_free(json);
  cJSON_Delete(root);
  
  return ESP_OK;
}

/* POST /actuator/intensity */
static esp_err_t post_intensity_handler(httpd_req_t *req) {
  char body[MAX_BODY_LEN];
  if (read_body(req, body, sizeof(body)) < 0) {
    httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "invalid body");
    return ESP_OK;
  }

  cJSON *root = cJSON_Parse(body);
  if (root == NULL) {
    httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "malformed json");
    return ESP_OK;
  }

  cJSON *intensity = cJSON_GetObjectItemCaseSensitive(root, "intensity");
  if (!cJSON_IsNumber(intensity) ||
    intensity->valuedouble < 0 || intensity->valuedouble > 100) {
    cJSON_Delete(root);
    httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "intensity must be 0-100");
    return ESP_OK;
  }

  uint8_t value = (uint8_t)intensity->valuedouble;
  cJSON_Delete(root);

  if (actuator_set_intensity(value) != ESP_OK) {
    httpd_resp_send_500(req);
    return ESP_OK;
  }

  httpd_resp_set_status(req, "204 No Content");
  httpd_resp_send(req, NULL, 0);
  return ESP_OK;
}

/* POST /actuator/blink */
static esp_err_t post_blink_handler(httpd_req_t *req) {
  if (actuator_start_blink() != ESP_OK) {
    httpd_resp_send_500(req);
    return ESP_OK;
  }

  httpd_resp_set_status(req, "204 No Content");
  httpd_resp_send(req, NULL, 0);
  return ESP_OK;
}

/* POST /actuator/alarm */
static esp_err_t post_alarm_handler(httpd_req_t *req)
{
  if (actuator_activate_alarm() != ESP_OK) {
    httpd_resp_send_500(req);
    return ESP_OK;
  }

  httpd_resp_set_status(req, "204 No Content");
  httpd_resp_send(req, NULL, 0);
  return ESP_OK;
} 

/* POST /actuator/reset */
static esp_err_t post_reset_handler(httpd_req_t *req)
{
  if (actuator_reset() != ESP_OK) {
    httpd_resp_send_500(req);
    return ESP_OK;
  }

  httpd_resp_set_status(req, "204 No Content");
  httpd_resp_send(req, NULL, 0);
  return ESP_OK;
}

static const httpd_uri_t uris[] = {
  { .uri = "/actuator/state",     .method = HTTP_GET,  .handler = get_state_handler },
  { .uri = "/actuator/intensity", .method = HTTP_POST, .handler = post_intensity_handler },
  { .uri = "/actuator/blink",     .method = HTTP_POST, .handler = post_blink_handler },
  { .uri = "/actuator/alarm",     .method = HTTP_POST, .handler = post_alarm_handler },
  { .uri = "/actuator/reset",     .method = HTTP_POST, .handler = post_reset_handler },
};

esp_err_t http_server_start(void) {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.max_uri_handlers = 8;

  httpd_handle_t server = NULL;
  esp_err_t err = httpd_start(&server, &config);
  if (err != ESP_OK) {
    ESP_LOGE(TAG, "httpd_start failed: %s", esp_err_to_name(err));
    return err;
  }

  for (size_t i = 0; i < sizeof(uris) / sizeof(uris[0]); i++) {
    ESP_ERROR_CHECK(httpd_register_uri_handler(server, &uris[i]));
  }

  ESP_LOGI(TAG, "HTTP server listening on port %d", config.server_port);
  return ESP_OK;
}