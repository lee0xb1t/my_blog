---
title: GPIO 中断
icon: ic:sharp-developer-board
date: 2026-05-04
updated: 2026-05-04
tags:
  - hardware
---

# GPIO 中断

## 按钮切换 LED

```c
GPIO_PinState light_state = GPIO_PIN_SET;

#define DEBOUNCE_DELAY 10
uint32_t last_press_time = 0;
uint32_t last_release_time = 0;
uint8_t press_confirmed = 0;

void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin) {
  if (GPIO_Pin != GPIO_PIN_7) return;

    GPIO_PinState pin_state = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_7);
    uint32_t now = HAL_GetTick();

    if (pin_state == GPIO_PIN_SET) {
        last_press_time = now;
        press_confirmed = 0;
    } else {
        if (press_confirmed == 0) {
            if ((now - last_press_time) >= DEBOUNCE_DELAY) {
                last_release_time = now; 
                press_confirmed = 1;
                
                light_state = !light_state;
                HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, light_state);
            }
        }
    }
}
```
