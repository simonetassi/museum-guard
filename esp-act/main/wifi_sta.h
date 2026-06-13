#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

// connect to wifi - blocks until it gets an IP
esp_err_t wifi_init_sta(void);

#ifdef __cplusplus
}
#endif
