idf_component_register(SRCS "wifi_sta.c" "time_sync.c" "actuator.c" "main.c"
                       INCLUDE_DIRS "."
                       PRIV_REQUIRES esp_driver_gpio esp_driver_ledc esp_timer
                                     esp_http_server json
                                     esp_wifi esp_netif esp_event nvs_flash)
