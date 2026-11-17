// Copyright (c) Meta Platforms, Inc. and affiliates.

/**
 * @file iconSlotValue.ts
 * @input An icon slot value: a semantic icon name, an icon component, or a node
 * @output Whether Icon draws the value, so its own element can carry props
 * @position Core-internal; shared by renderIconSlot and components that put a
 *   theming target on the Icon a slot draws. The package entry does not export it
 */

import type {ReactNode} from 'react';
import type {IconType} from './Icon';

/**
 * Whether a slot value is one Icon draws: a semantic icon name, or an icon
 * component (a function or a forwardRef object). Any other value is the
 * caller's own node, which Core renders as given.
 */
export function isDrawnIconValue(
  value: ReactNode | IconType,
): value is string | IconType {
  return (
    typeof value === 'string' ||
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && 'render' in value)
  );
}
