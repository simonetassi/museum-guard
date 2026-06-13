#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

// start SNTP and wait for the clock to be set
esp_err_t time_sync_init(void);

#ifdef __cplusplus
}
#endif
