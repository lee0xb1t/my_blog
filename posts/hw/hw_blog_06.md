---
title: 定时器
icon: ic:sharp-developer-board
date: 2026-05-04
updated: 2026-05-04
tags:
  - hardware
---

# 定时器

## 高级定时器、通用定时器、基本定时器

## 定时单元
### 分频器

## 计数器

* 上计数：0开始增加，到最大值后溢出。
* 下计数：最大值开始减少，到0后自动变为最大值。
* 中心对齐计数：0到最大值，最大值再到0

## PWM 信号

输出信号的占空比可以等效为一个电压。

PWM 信号由时钟加比较器产生，时钟计数器的值小于捕获比较器 CCR 值时，输出高电压，反之输出低电压。

## PWM 呼吸灯实验

```c
int main(void)
{

  /* USER CODE BEGIN 1 */

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
  MX_TIM1_Init();
  /* USER CODE BEGIN 2 */

  HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);
  HAL_TIMEx_PWMN_Start(&htim1, TIM_CHANNEL_1);
  
  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */

    uint32_t tick = HAL_GetTick();
    float t = tick * 1.0e-3f;
    float frequency = 0.7f;
    float duty = 0.5f * (sin(2.0f * 3.14f * frequency * t) + 1.0f);
    uint16_t ccr = duty * 1000;
    __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_1, ccr);
    
  }
  /* USER CODE END 3 */
}
```

## PWM 输入捕获
