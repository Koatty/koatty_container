/*
 * @Description: Decorator metadata interface
 * @Usage: 
 * @Author: richen
 * @Date: 2024-01-17 16:00:00
 * @LastEditTime: 2024-01-17 16:00:00
 * @License: BSD (3-Clause)
 * @Copyright (c): <richenlin(at)gmail.com>
 */

/**
 * Decorator metadata interface
 */
export interface DecoratorMetadata {
  type: string;
  config: object;
  applied: boolean;
  priority: number;
}