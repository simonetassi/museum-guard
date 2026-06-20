idf_component_register(SRCS "sensor.c" "main.c" "wifi_sta.c" "time_sync.c" "coap_server.c"
                    INCLUDE_DIRS "."
                    REQUIRES esp_event esp_wifi esp_netif nvs_flash coap esp_adc driver mpu6050 esp_timer json)