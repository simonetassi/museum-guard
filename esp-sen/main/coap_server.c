#include "coap_server.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "cJSON.h"
#include "lwip/sockets.h"
#include "coap3/coap.h"

#include "sensor.h"

static const char *TAG = "coap_server";

#define COAP_LISTEN_PORT COAP_DEFAULT_PORT
#define JSON_BUF_LEN 128

static coap_context_t  *s_ctx;
static coap_resource_t *s_impact_res;
static coap_resource_t *s_theft_res;

static float  s_last_impact_value;
static time_t s_last_impact_time;
static float  s_last_theft_value;
static time_t s_last_theft_time;

static void iso8601(time_t t, char *buf, size_t len) {
  if (t == 0) t = time(NULL);
  struct tm tm_utc;
  gmtime_r(&t, &tm_utc);
  strftime(buf, len, "%Y-%m-%dT%H:%M:%SZ", &tm_utc);
}

static void respond_json(coap_resource_t *resource, coap_session_t *session,
                         const coap_pdu_t *request, const coap_string_t *query,
                         coap_pdu_t *response, const char *json) {
  coap_pdu_set_code(response, COAP_RESPONSE_CODE_CONTENT);
  coap_add_data_large_response(resource, session, request, response, query,
                               COAP_MEDIATYPE_APPLICATION_JSON, -1, 0,
                               strlen(json), (const uint8_t *)json, NULL, NULL);
}

static bool parse_value(const coap_pdu_t *request, float *out) {
  size_t size = 0;
  const uint8_t *data = NULL;
  if (coap_get_data(request, &size, &data) == 0 || size == 0) {
    return false;
  }
  cJSON *root = cJSON_ParseWithLength((const char *)data, size);
  if (root == NULL) {
    return false;
  }
  cJSON *v = cJSON_GetObjectItem(root, "value");
  bool ok = cJSON_IsNumber(v);
  if (ok) {
    *out = (float)v->valuedouble;
  }
  cJSON_Delete(root);
  return ok;
}

// GET sensor/light
static void get_light_handler(coap_resource_t *resource, coap_session_t *session,
                          const coap_pdu_t *request, const coap_string_t *query,
                          coap_pdu_t *response) {
  char ts[32], buf[JSON_BUF_LEN];
  iso8601(time(NULL), ts, sizeof(ts));
  snprintf(buf, sizeof(buf), "{\"lux\":%.2f,\"timestamp\":\"%s\"}",
           sensor_get_light(), ts);
  respond_json(resource, session, request, query, response, buf);
}

// GET sensor/acceleration
static void get_acceleration_handler(coap_resource_t *resource, coap_session_t *session,
                                 const coap_pdu_t *request, const coap_string_t *query,
                                 coap_pdu_t *response) {
  acceleration_t acc;
  sensor_get_acceleration(&acc);
  char ts[32], buf[JSON_BUF_LEN];
  iso8601(time(NULL), ts, sizeof(ts));
  snprintf(buf, sizeof(buf),
           "{\"x\":%.4f,\"y\":%.4f,\"z\":%.4f,\"timestamp\":\"%s\"}",
           acc.x, acc.y, acc.z, ts);
  respond_json(resource, session, request, query, response, buf);
}

// GET events/impact (observable)
static void get_impact_event_handler(coap_resource_t *resource, coap_session_t *session,
                                 const coap_pdu_t *request, const coap_string_t *query,
                                 coap_pdu_t *response) {
  char ts[32], buf[JSON_BUF_LEN];
  iso8601(s_last_impact_time, ts, sizeof(ts));
  snprintf(buf, sizeof(buf), "{\"value\":%.2f,\"timestamp\":\"%s\"}",
           s_last_impact_value, ts);
  respond_json(resource, session, request, query, response, buf);
}

// GET events/theft (observable)
static void get_theft_event_handler(coap_resource_t *resource, coap_session_t *session,
                                const coap_pdu_t *request, const coap_string_t *query,
                                coap_pdu_t *response) {
  char ts[32], buf[JSON_BUF_LEN];
  iso8601(s_last_theft_time, ts, sizeof(ts));
  snprintf(buf, sizeof(buf), "{\"value\":%.2f,\"timestamp\":\"%s\"}",
           s_last_theft_value, ts);
  respond_json(resource, session, request, query, response, buf);
}

// GET config/impact-threshold
static void get_impact_threshold_handler(coap_resource_t *resource, coap_session_t *session,
                                     const coap_pdu_t *request, const coap_string_t *query,
                                     coap_pdu_t *response) {
  char ts[32], buf[JSON_BUF_LEN];
  iso8601(time(NULL), ts, sizeof(ts));
  snprintf(buf, sizeof(buf), "{\"value\":%.2f,\"timestamp\":\"%s\"}",
           sensor_get_impact_threshold(), ts);
  respond_json(resource, session, request, query, response, buf);
}

// PUT config/impact-threshold
static void put_impact_threshold_handler(coap_resource_t *resource, coap_session_t *session,
                                     const coap_pdu_t *request, const coap_string_t *query,
                                     coap_pdu_t *response) {
  (void)resource; (void)session; (void)query;
  float value;
  if (!parse_value(request, &value)) {
    coap_pdu_set_code(response, COAP_RESPONSE_CODE_BAD_REQUEST);
    return;
  }
  sensor_set_impact_threshold(value);
  coap_pdu_set_code(response, COAP_RESPONSE_CODE_CHANGED);
}

// GET config/theft-threshold
static void get_theft_threshold_handler(coap_resource_t *resource, coap_session_t *session,
                                    const coap_pdu_t *request, const coap_string_t *query,
                                    coap_pdu_t *response) {
  char ts[32], buf[JSON_BUF_LEN];
  iso8601(time(NULL), ts, sizeof(ts));
  snprintf(buf, sizeof(buf), "{\"value\":%.2f,\"timestamp\":\"%s\"}",
           sensor_get_theft_threshold(), ts);
  respond_json(resource, session, request, query, response, buf);
}

// PUT config/theft-threshold
static void put_theft_threshold_handler(coap_resource_t *resource, coap_session_t *session,
                                    const coap_pdu_t *request, const coap_string_t *query,
                                    coap_pdu_t *response) {
  (void)resource; (void)session; (void)query;
  float value;
  if (!parse_value(request, &value)) {
    coap_pdu_set_code(response, COAP_RESPONSE_CODE_BAD_REQUEST);
    return;
  }
  sensor_set_theft_threshold(value);
  coap_pdu_set_code(response, COAP_RESPONSE_CODE_CHANGED);
}

static coap_resource_t *register_resource(const char *uri, int observable,
                                          coap_method_handler_t get_handler,
                                          coap_method_handler_t put_handler) {
  coap_resource_t *res = coap_resource_init(coap_make_str_const(uri), 0);
  if (res == NULL) {
    ESP_LOGE(TAG, "Failed to init resource %s", uri);
    return NULL;
  }
  if (get_handler) {
    coap_register_request_handler(res, COAP_REQUEST_GET, get_handler);
  }
  if (put_handler) {
    coap_register_request_handler(res, COAP_REQUEST_PUT, put_handler);
  }
  if (observable) {
    coap_resource_set_get_observable(res, 1);
  }
  coap_add_resource(s_ctx, res);
  return res;
}

static void coap_task(void *arg) {
  QueueHandle_t queue = sensor_event_queue();

  for (;;) {
    coap_io_process(s_ctx, 100);

    sensor_event_t ev;
    while (queue != NULL && xQueueReceive(queue, &ev, 0) == pdTRUE) {
      if (ev.type == SENSOR_EVENT_IMPACT) {
        s_last_impact_value = ev.value;
        s_last_impact_time = ev.timestamp;
        coap_resource_notify_observers(s_impact_res, NULL);
        ESP_LOGI(TAG, "impact event pushed to observers (value=%.2f)", ev.value);
      } else {
        s_last_theft_value = ev.value;
        s_last_theft_time = ev.timestamp;
        coap_resource_notify_observers(s_theft_res, NULL);
        ESP_LOGI(TAG, "theft event pushed to observers (value=%.2f)", ev.value);
      }
    }
  }
}

esp_err_t coap_server_start(void) {
  coap_startup();

  s_ctx = coap_new_context(NULL);
  if (s_ctx == NULL) {
    ESP_LOGE(TAG, "Failed to create CoAP context");
    return ESP_FAIL;
  }
  coap_context_set_block_mode(s_ctx, COAP_BLOCK_USE_LIBCOAP | COAP_BLOCK_SINGLE_BODY);

  coap_address_t addr;
  coap_address_init(&addr);
  addr.addr.sin.sin_family = AF_INET;
  addr.addr.sin.sin_addr.s_addr = INADDR_ANY;
  addr.addr.sin.sin_port = htons(COAP_LISTEN_PORT);

  if (coap_new_endpoint(s_ctx, &addr, COAP_PROTO_UDP) == NULL) {
    ESP_LOGE(TAG, "Failed to create CoAP UDP endpoint on port %d", COAP_LISTEN_PORT);
    coap_free_context(s_ctx);
    s_ctx = NULL;
    return ESP_FAIL;
  }

  register_resource("sensor/light", 0, get_light_handler, NULL);
  register_resource("sensor/acceleration", 0, get_acceleration_handler, NULL);
  s_impact_res = register_resource("events/impact", 1, get_impact_event_handler, NULL);
  s_theft_res  = register_resource("events/theft", 1, get_theft_event_handler, NULL);
  register_resource("config/impact-threshold", 0, get_impact_threshold_handler, put_impact_threshold_handler);
  register_resource("config/theft-threshold", 0, get_theft_threshold_handler, put_theft_threshold_handler);

  if (s_impact_res == NULL || s_theft_res == NULL) {
    ESP_LOGE(TAG, "Failed to register event resources");
    coap_free_context(s_ctx);
    s_ctx = NULL;
    return ESP_FAIL;
  }

  if (xTaskCreate(coap_task, "coap_task", 8192, NULL, 5, NULL) != pdPASS) {
    ESP_LOGE(TAG, "Failed to create coap task");
    coap_free_context(s_ctx);
    s_ctx = NULL;
    return ESP_FAIL;
  }

  ESP_LOGI(TAG, "CoAP server listening on UDP port %d", COAP_LISTEN_PORT);
  return ESP_OK;
}
