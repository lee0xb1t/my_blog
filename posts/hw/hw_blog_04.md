---
title: SPI 通信协议
icon: ic:sharp-developer-board
date: 2026-05-03
updated: 2026-05-03
tags:
  - hardware
---

# SPI 通信协议

## 保存按钮状态

```c
int main(void)
{

  /* USER CODE BEGIN 1 */

  uint8_t res;
  uint8_t manufacturer;
  uint8_t device_id;

  GPIO_PinState StateBtn;
  GPIO_PinState StateLight;

  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */


  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_USART1_UART_Init();
  MX_SPI2_Init();
  /* USER CODE BEGIN 2 */

  StateLight = GPIO_PIN_RESET;
  
  res = w25qxx_basic_init(W25Q64, W25QXX_INTERFACE_SPI, W25QXX_BOOL_FALSE);
  if (res != 0)
  {
      return 1;
  }
      
  res = w25qxx_basic_get_id((uint8_t *)&manufacturer, (uint8_t *)&device_id);
  if (res != 0)
  {
      (void)w25qxx_basic_deinit();
      
      return 1;
  }
  w25qxx_interface_debug_print("w25qxx: manufacturer is 0x%02X device id is 0x%02X.\n", manufacturer, device_id);

  res = w25qxx_basic_read(0x00000000, (uint8_t *)&StateLight, 1);
  if (res != 0)
  {
      (void)w25qxx_basic_deinit();
      return 1;
  }
  HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, StateLight);

  StateBtn = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_7);
  
  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */

    if(HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_7) == GPIO_PIN_SET)  // 检测按下
    {
        HAL_Delay(15);  // 防抖
        if(HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_7) == GPIO_PIN_SET)  // 确认按下
        {
            // 等待松开
            while(HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_7) == GPIO_PIN_SET);
            HAL_Delay(10);  // 松开防抖
            
            // 执行操作
            StateLight = !StateLight;
            HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, StateLight);

            res = w25qxx_basic_write(0x00000000, (uint8_t *)&StateLight, 1);
            if (res != 0)
            {
                (void)w25qxx_basic_deinit();
                return 1;
            }
        }
    }
    
  }
  /* USER CODE END 3 */
}
```
