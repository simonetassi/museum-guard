#include <stdio.h>
#include <string.h>
#include <stdbool.h>

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"

#include "esp_timer.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_err.h"
#include "nvs_flash.h"
#include "cJSON.h"

#include <arpa/inet.h>
#include <coap3/coap.h>

// CUSTOMIZE!
#define WIFI_SSID       "iPhone di Simo"
#define WIFI_PASSWORD   "taxwifi01"

// CUSTOMIZE!
#define COAP_SERVER_IP  "130.136.2.70"

static const char *TAG = "ESP32_SKETCH";

static EventGroupHandle_t wifi_event_group;
static const int WIFI_CONNECTED_BIT = BIT0;

coap_context_t *ctx;
coap_session_t *session;
static volatile int waiting_response = 0;

/* ---------------- Wi-Fi management ---------------- */

static void wifi_event_handler(void *arg,
                               esp_event_base_t event_base,
                               int32_t event_id,
                               void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        ESP_LOGI(TAG, "Wi-Fi started, connecting...");
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "Wi-Fi disconnected, retrying...");
        xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

static void wifi_init_sta(void)
{
    wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT,
                                               ESP_EVENT_ANY_ID,
                                               &wifi_event_handler,
                                               NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT,
                                               IP_EVENT_STA_GOT_IP,
                                               &wifi_event_handler,
                                               NULL));

    wifi_config_t wifi_config = { 0 };
    strncpy((char *)wifi_config.sta.ssid, WIFI_SSID, sizeof(wifi_config.sta.ssid) - 1);
    strncpy((char *)wifi_config.sta.password, WIFI_PASSWORD, sizeof(wifi_config.sta.password) - 1);
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Waiting for Wi-Fi connection...");
    xEventGroupWaitBits(wifi_event_group, WIFI_CONNECTED_BIT,
                        pdFALSE, pdTRUE, portMAX_DELAY);
}

/* ---------------- CoAP ---------------- */

static coap_response_t response_handler(coap_session_t *session,
                                        const coap_pdu_t *sent,
                                        const coap_pdu_t *received,
                                        const coap_mid_t id)
{
    waiting_response = 0;
    return COAP_RESPONSE_OK;
}

static void nack_handler(coap_session_t *session,
                         const coap_pdu_t *sent,
                         coap_nack_reason_t reason,
                         const coap_mid_t id)
{
    waiting_response = 0;
}

void coap_init(void)
{
    coap_address_t dst;

    coap_startup();
    ctx = coap_new_context(NULL);

    coap_address_init(&dst);
    dst.addr.sin.sin_family      = AF_INET;
    dst.addr.sin.sin_port        = htons(5683);
    dst.addr.sin.sin_addr.s_addr = inet_addr(COAP_SERVER_IP);

    session = coap_new_client_session(ctx, NULL, &dst, COAP_PROTO_UDP);
    coap_register_response_handler(ctx, response_handler);
    coap_register_nack_handler(ctx, nack_handler);
}

void coap_send_json(coap_session_t *session, const char *payload, bool confirmable)
{
    coap_pdu_t *pdu = coap_pdu_init(
        confirmable ? COAP_MESSAGE_CON : COAP_MESSAGE_NON,
        COAP_REQUEST_CODE_POST,
        coap_new_message_id(session),
        coap_session_max_pdu_size(session)
    );

    uint8_t buf[4];
    size_t len = coap_encode_var_safe(buf, sizeof(buf), COAP_MEDIATYPE_APPLICATION_JSON);
    coap_add_option(pdu, COAP_OPTION_CONTENT_FORMAT, len, buf);
    coap_add_data(pdu, strlen(payload), (const uint8_t *)payload);

    int64_t deadline = esp_timer_get_time() + (int64_t)1000 * 1000;
    coap_send(session, pdu);
    waiting_response = 1;
    while (waiting_response && esp_timer_get_time() < deadline) {
        coap_io_process(ctx, 5);
    }
}

/* ---------------- Main ---------------- */

void app_main(void)
{
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    wifi_init_sta();
    coap_init();
}
